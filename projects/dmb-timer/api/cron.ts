/**
 * GET /api/cron — планировщик уведомлений.
 *
 * Запускается Vercel Cron (см. vercel.json) и защищён заголовком
 * Authorization: Bearer <CRON_SECRET>, который Vercel подставляет сам.
 * Тот же endpoint можно дёргать внешним планировщиком (например, раз в час),
 * чтобы уведомления приходили точнее: обработка идемпотентна — каждое событие
 * отправляется один раз, состояние хранится в подписке.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { DAY } from '../src/lib/time';
import { dueNotifications } from '../src/lib/notify';
import { configureVapid, deleteSub, loadSubs, pruneSent, saveSub, sendPush } from './_lib';

const MAX_PER_RUN = 3;
const MAX_FIRST_LOOKBACK = 2 * DAY;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const secret = process.env.CRON_SECRET;
  const auth = String(req.headers.authorization || '');
  if (!secret) return res.status(500).json({ error: 'CRON_SECRET не задан' });
  if (auth !== `Bearer ${secret}`) return res.status(401).json({ error: 'unauthorized' });

  try {
    configureVapid();
  } catch (e) {
    return res.status(500).json({ error: (e as Error).message });
  }

  const now = Date.now();
  const subs = await loadSubs();

  let sent = 0;
  let gone = 0;
  let failed = 0;
  let skipped = 0;
  const details: string[] = [];

  for (const sub of subs) {
    const from = sub.lastRunAt ?? now - MAX_FIRST_LOOKBACK;
    const due = dueNotifications(sub.schedule, from, now).filter((n) => !sub.sent?.[n.key]);

    if (due.length === 0) {
      skipped++;
      sub.lastRunAt = now;
      sub.sent = sub.sent ?? {};
      pruneSent(sub, now);
      await saveSub(sub);
      continue;
    }

    let dead = false;
    for (const n of due.slice(0, MAX_PER_RUN)) {
      const result = await sendPush(sub, {
        title: n.title,
        body: n.body,
        tag: n.tag,
        icon: '/icon-192.png',
        badge: '/badge-72.png',
        url: './',
      });
      if (result === 'ok') {
        sub.sent[n.key] = now;
        sent++;
        details.push(`${n.key} → ok`);
      } else if (result === 'gone') {
        details.push(`${n.key} → gone (подписка удалена)`);
        await deleteSub(sub.endpoint);
        dead = true;
        gone++;
        break;
      } else {
        failed++;
        details.push(`${n.key} → error`);
      }
    }

    if (!dead) {
      sub.sent = sub.sent ?? {};
      pruneSent(sub, now);
      sub.lastRunAt = now;
      await saveSub(sub);
    }
  }

  return res.status(200).json({
    ok: true,
    at: new Date(now).toISOString(),
    subscriptions: subs.length,
    sent,
    skipped,
    gone,
    failed,
    details: details.slice(0, 20),
  });
}
