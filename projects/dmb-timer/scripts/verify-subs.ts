import { get, list } from '@vercel/blob';
import { DAY, parseLocal, calc } from '../src/lib/time';
import { num, plural, W } from '../src/lib/format';

const token = process.env.BLOB_READ_WRITE_TOKEN!;
const { blobs } = await list({ prefix: 'subs/', token });
const now = Date.now();
let problems = 0;

for (const [i, b] of blobs.entries()) {
  const res = await get(b.pathname, { access: 'private', token, useCache: false });
  if (!res) continue;
  const sub = JSON.parse(await new Response(res.stream).text());
  const s = parseLocal(sub.profile.start), e = parseLocal(sub.profile.end);
  const left = Math.max(0, e - now);
  const c = calc(s, e, now);
  console.log(`— подписка ${i + 1}: ${sub.profile.name || '(без имени)'}`);
  console.log(`   срок: ${sub.profile.start.replace('T', ' ')} → ${sub.profile.end.replace('T', ' ')} (${sub.profile.tz})`);
  console.log(`   сейчас: пройдено ${(c.pct * 100).toFixed(2)}% · осталось ${Math.floor(left / DAY)} дн — столько же покажет приложение`);
  const future = sub.events.filter((x: any) => x.ts > now).sort((a: any, z: any) => a.ts - z.ts);
  for (const ev of future.slice(0, 3)) {
    const expect = Math.floor((e - ev.ts) / DAY);
    const ok = ev.body.includes(`${num(expect)} ${plural(expect, W.day)}`) || ev.body.includes('ДМБ');
    if (!ok) problems++;
    console.log(`   ${ok ? '✓' : '✗'} ${new Date(ev.ts).toISOString().slice(0, 16).replace('T', ' ')} | ${ev.title}`);
    console.log(`      ${ev.body}`);
  }
  console.log();
}
console.log(problems === 0 ? '✓ все будущие уведомления содержат целые дни, совпадающие с приложением' : `✗ проблемных событий: ${problems}`);
