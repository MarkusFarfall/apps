/**
 * Общие помощники серверных функций: хранилище подписок в Vercel Blob и отправка push.
 *
 * Важно: здесь нет импортов из src/ — функции собираются в ESM, и код вне папки api/
 * в рантайме недоступен. Календарь уведомлений присылает клиент (см. src/lib/notify.ts),
 * сервер только хранит его и рассылает по наступлении момента.
 */
import { createHash } from 'node:crypto';
import { del, get, list, put } from '@vercel/blob';
import webpush from 'web-push';

export interface NotifyEvent {
  key: string;
  title: string;
  body: string;
  tag: string;
  ts: number;
}

export interface StoredProfile {
  name: string;
  start: string;
  end: string;
  tz: string;
}

export interface StoredSub {
  endpoint: string;
  keys: { p256dh: string; auth: string };
  profile: StoredProfile;
  events: NotifyEvent[];
  /** ключ уведомления -> время отправки (защита от дублей) */
  sent: Record<string, number>;
  lastRunAt?: number;
  createdAt: number;
  ua?: string;
}

const PREFIX = 'subs/';
const MAX_NAME = 60;
const MAX_EVENTS = 300;
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
      /* битую запись пропускаем */
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
  | { ok: true; subscription: { endpoint: string; keys: { p256dh: string; auth: string } }; profile: StoredProfile; events: NotifyEvent[] }
  | { ok: false; error: string } {
  const b = body as {
    subscription?: { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
    profile?: { name?: string; start?: string; end?: string; tz?: string };
    events?: unknown;
  };

  const endpoint = b?.subscription?.endpoint;
  const p256dh = b?.subscription?.keys?.p256dh;
  const auth = b?.subscription?.keys?.auth;
  if (typeof endpoint !== 'string' || !endpoint.startsWith('https://')) return { ok: false, error: 'bad endpoint' };
  if (typeof p256dh !== 'string' || typeof auth !== 'string' || !p256dh || !auth) return { ok: false, error: 'bad keys' };

  const start = b?.profile?.start;
  const end = b?.profile?.end;
  if (typeof start !== 'string' || typeof end !== 'string') return { ok: false, error: 'bad dates' };
  const s = new Date(start).getTime();
  const e = new Date(end).getTime();
  if (!Number.isFinite(s) || !Number.isFinite(e) || e <= s) return { ok: false, error: 'end must be after start' };

  if (!Array.isArray(b?.events)) return { ok: false, error: 'bad events' };
  const events: NotifyEvent[] = [];
  for (const raw of b.events.slice(0, MAX_EVENTS)) {
    const ev = raw as Partial<NotifyEvent>;
    if (
      typeof ev?.key !== 'string' ||
      typeof ev?.title !== 'string' ||
      typeof ev?.body !== 'string' ||
      typeof ev?.tag !== 'string' ||
      typeof ev?.ts !== 'number' ||
      !Number.isFinite(ev.ts)
    ) {
      continue;
    }
    events.push({
      key: ev.key.slice(0, 80),
      title: ev.title.slice(0, 120),
      body: ev.body.slice(0, 300),
      tag: ev.tag.slice(0, 80),
      ts: ev.ts,
    });
  }
  if (events.length === 0) return { ok: false, error: 'no events' };

  const tz = typeof b?.profile?.tz === 'string' && b.profile.tz.length < 64 ? b.profile.tz : 'UTC';
  const name = String(b?.profile?.name ?? '').slice(0, MAX_NAME);

  return { ok: true, subscription: { endpoint, keys: { p256dh, auth } }, profile: { name, start, end, tz }, events };
}
