/**
 * Общие помощники для серверных функций: хранилище подписок в Vercel Blob
 * и отправка push через web-push.
 *
 * Файлы с префиксом "_" не публикуются как отдельные маршруты —
 * это внутренний модуль для api/subscribe.ts, api/cron.ts и api/test.ts.
 */
import { createHash } from 'node:crypto';
import { del, get, list, put } from '@vercel/blob';
import webpush from 'web-push';
import type { NotifySchedule } from '../src/lib/notify';

export interface StoredSub {
  endpoint: string;
  keys: { p256dh: string; auth: string };
  schedule: NotifySchedule;
  /** ключ уведомления -> время отправки (защита от дублей) */
  sent: Record<string, number>;
  lastRunAt?: number;
  createdAt: number;
  ua?: string;
}

const PREFIX = 'subs/';
const MAX_NAME = 60;
const MAX_SENT_AGE_MS = 180 * 24 * 60 * 60 * 1000;

/** Путь в хранилище: хеш endpoint, чтобы не хранить его в имени файла */
export const subKey = (endpoint: string) =>
  PREFIX + createHash('sha256').update(endpoint).digest('hex').slice(0, 24) + '.json';

export function configureVapid() {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || 'mailto:noreply@example.com';
  if (!publicKey || !privateKey) throw new Error('VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY не заданы');
  webpush.setVapidDetails(subject, publicKey, privateKey);
}

export async function saveSub(sub: StoredSub): Promise<void> {
  await put(subKey(sub.endpoint), JSON.stringify(sub), {
    access: 'private',
    contentType: 'application/json',
    addRandomSuffix: false,
    allowOverwrite: true,
    cacheControlMaxAge: 60,
  });
}

export async function loadSub(endpoint: string): Promise<StoredSub | null> {
  const res = await get(subKey(endpoint), { access: 'private', useCache: false });
  if (!res) return null;
  try {
    return JSON.parse(await new Response(res.stream).text()) as StoredSub;
  } catch {
    return null;
  }
}

export async function loadSubs(): Promise<StoredSub[]> {
  const { blobs } = await list({ prefix: PREFIX, limit: 1000 });
  const out: StoredSub[] = [];
  for (const b of blobs) {
    const res = await get(b.pathname, { access: 'private', useCache: false }).catch(() => null);
    if (!res) continue;
    try {
      out.push(JSON.parse(await new Response(res.stream).text()) as StoredSub);
    } catch {
      /* пропускаем битую запись */
    }
  }
  return out;
}

export async function deleteSub(endpoint: string): Promise<void> {
  await del(subKey(endpoint)).catch(() => undefined);
}

export function pruneSent(sub: StoredSub, now: number): boolean {
  let changed = false;
  for (const key of Object.keys(sub.sent ?? {})) {
    if (now - sub.sent[key] > MAX_SENT_AGE_MS) {
      delete sub.sent[key];
      changed = true;
    }
  }
  return changed;
}

export type SendResult = 'ok' | 'gone' | 'error';

/** Отправить пуш. 'gone' означает, что подписка мертва и её нужно удалить. */
export async function sendPush(
  sub: Pick<StoredSub, 'endpoint' | 'keys'>,
  payload: Record<string, unknown>
): Promise<SendResult> {
  try {
    await webpush.sendNotification(
      { endpoint: sub.endpoint, keys: sub.keys },
      JSON.stringify(payload),
      { TTL: 12 * 60 * 60, urgency: 'normal' }
    );
    return 'ok';
  } catch (e) {
    const status = (e as { statusCode?: number }).statusCode;
    if (status === 404 || status === 410) return 'gone';
    return 'error';
  }
}

/** Разбор и проверка тела запроса подписки */
export function parseSubscribeBody(body: unknown):
  | { ok: true; subscription: { endpoint: string; keys: { p256dh: string; auth: string } }; schedule: NotifySchedule }
  | { ok: false; error: string } {
  const b = body as {
    subscription?: { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
    schedule?: {
      name?: string;
      start?: string;
      end?: string;
      tz?: string;
      prefs?: { achievements?: boolean; everyNDays?: number };
    };
  };
  const endpoint = b?.subscription?.endpoint;
  const p256dh = b?.subscription?.keys?.p256dh;
  const auth = b?.subscription?.keys?.auth;
  if (typeof endpoint !== 'string' || !endpoint.startsWith('https://')) return { ok: false, error: 'bad endpoint' };
  if (!p256dh || !auth) return { ok: false, error: 'bad keys' };

  const sch = b?.schedule;
  const start = sch?.start;
  const end = sch?.end;
  if (typeof start !== 'string' || typeof end !== 'string') return { ok: false, error: 'bad dates' };
  const s = new Date(start).getTime();
  const e = new Date(end).getTime();
  if (!Number.isFinite(s) || !Number.isFinite(e) || e <= s) return { ok: false, error: 'end must be after start' };

  const tz = typeof sch?.tz === 'string' && sch.tz.length < 64 ? sch.tz : 'UTC';
  const everyNDays = Math.max(0, Math.min(365, Math.floor(Number(sch?.prefs?.everyNDays) || 0)));
  const name = String(sch?.name ?? '').slice(0, MAX_NAME);

  return {
    ok: true,
    subscription: { endpoint, keys: { p256dh, auth } },
    schedule: { name, start, end, tz, prefs: { achievements: sch?.prefs?.achievements !== false, everyNDays } },
  };
}
