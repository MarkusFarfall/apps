/**
 * Миграция текстов уже сохранённых подписок: пересчитывает тексты будущих
 * уведомлений по текущей логике (целые дни вместо округления вверх).
 *
 * Ключи событий не меняются — значит, уже отправленное не отправится повторно.
 * Запуск: BLOB_READ_WRITE_TOKEN=... npx tsx scripts/migrate-event-texts.ts
 */
import { get, list, put } from '@vercel/blob';
import { dueNotifications, type NotifySchedule } from '../src/lib/notify';
import { parseLocal } from '../src/lib/time';

interface StoredEvent {
  key: string;
  title: string;
  body: string;
  tag: string;
  ts: number;
}
interface StoredSub {
  endpoint: string;
  profile: { name: string; start: string; end: string; tz: string };
  events: StoredEvent[];
  sent: Record<string, number>;
}

const token = process.env.BLOB_READ_WRITE_TOKEN;
if (!token) throw new Error('нужен BLOB_READ_WRITE_TOKEN');

const host = (e: string) => {
  try {
    return new URL(e).host;
  } catch {
    return 'unknown';
  }
};

const { blobs } = await list({ prefix: 'subs/', limit: 1000, token });
console.log(`подписок в хранилище: ${blobs.length}\n`);

const now = Date.now();

for (const b of blobs) {
  const res = await get(b.pathname, { access: 'private', token, useCache: false });
  if (!res) {
    console.log(`— ${b.pathname}: не читается, пропускаю`);
    continue;
  }
  const sub = JSON.parse(await new Response(res.stream).text()) as StoredSub;
  const events = sub.events ?? [];

  // интервал периодики = НОД разностей между ключами days:N (а не минимальный ключ)
  const dayNs = [
    ...new Set(
      events
        .map((e) => (e.key.startsWith('days:') ? Number(e.key.slice(5)) : NaN))
        .filter((n) => Number.isFinite(n) && n > 0)
    ),
  ].sort((a, b) => a - b);
  const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
  let everyNDays = 0;
  for (let i = 1; i < dayNs.length; i++) everyNDays = gcd(everyNDays, dayNs[i] - dayNs[i - 1]);
  if (dayNs.length === 1) everyNDays = dayNs[0]; // единственный ключ — другого источника нет
  const achievements = events.some((e) => e.key.startsWith('ach:'));

  const sch: NotifySchedule = {
    name: sub.profile?.name ?? '',
    start: sub.profile?.start ?? '',
    end: sub.profile?.end ?? '',
    tz: sub.profile?.tz ?? 'UTC',
    prefs: { achievements, everyNDays },
  };

  const fresh = dueNotifications(sch, parseLocal(sch.start) - 1, parseLocal(sch.end));
  const byKey = new Map(fresh.map((e) => [e.key, e]));

  let changed = 0;
  const changedKeys: string[] = [];
  let sample: { key: string; before: string; after: string } | null = null;

  const updated = events.map((ev) => {
    const f = byKey.get(ev.key);
    if (!f || ev.ts <= now) return ev;
    if (f.title === ev.title && f.body === ev.body) return ev;
    changed++;
    changedKeys.push(ev.key);
    if (!sample && ev.key.startsWith('days:')) sample = { key: ev.key, before: ev.body, after: f.body };
    return { ...ev, title: f.title, body: f.body };
  });

  console.log(`— ${host(sub.endpoint)}`);
  console.log(`   событий: ${events.length} (будущих обновлено: ${changed}), настройки: достижения=${achievements}, каждые ${everyNDays} дн`);
  if (changedKeys.length) console.log(`   ключи: ${changedKeys.join(', ')}`);
  if (sample) {
    console.log(`   было  [${sample.key}]: ${sample.before}`);
    console.log(`   стало [${sample.key}]: ${sample.after}`);
  }

  if (changed > 0) {
    await put(b.pathname, JSON.stringify({ ...sub, events: updated }), {
      access: 'private',
      token,
      contentType: 'application/json',
      addRandomSuffix: false,
      allowOverwrite: true,
      cacheControlMaxAge: 60,
    });
    console.log('   ✓ сохранено');
  } else {
    console.log('   изменений не требуется');
  }
  console.log();
}

console.log('миграция завершена');
