/**
 * Web Push со стороны приложения: подписка, синхронизация расписания с сервером,
 * отключение, тестовое уведомление и локальные уведомления (когда приложение открыто).
 *
 * Публичный VAPID-ключ не секрет — он по определению уходит в браузер.
 * Приватный ключ лежит только в переменных окружения Vercel.
 */
import type { NotifySchedule } from './notify';

export const VAPID_PUBLIC_KEY =
  import.meta.env.VITE_VAPID_PUBLIC_KEY ||
  'BEmk8JI24M-P73RmlyDT_du_YsIbfF8OMRDZxSryDF9H1t0ovfwcjYmpiBZExbGpaliTdIW_dIbk92s1B3VMxkM';

export const TZ_NAME =
  (typeof Intl !== 'undefined' && Intl.DateTimeFormat().resolvedOptions().timeZone) || 'UTC';

export const pushSupported = () =>
  typeof navigator !== 'undefined' &&
  'serviceWorker' in navigator &&
  'PushManager' in window &&
  'Notification' in window;

export const isStandalone = () =>
  typeof window !== 'undefined' &&
  (window.matchMedia?.('(display-mode: standalone)')?.matches === true ||
    (navigator as unknown as { standalone?: boolean }).standalone === true);

export const isIOS = () =>
  typeof navigator !== 'undefined' &&
  (/iphone|ipad|ipod/i.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));

export type PushFailure = 'unsupported' | 'denied' | 'ios-install' | 'error';
export type PushResult = { ok: true } | { ok: false; reason: PushFailure; message?: string };

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'));
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

async function registration(): Promise<ServiceWorkerRegistration> {
  return navigator.serviceWorker.ready;
}

export async function currentSubscription(): Promise<PushSubscription | null> {
  if (!pushSupported()) return null;
  try {
    const reg = await registration();
    return await reg.pushManager.getSubscription();
  } catch {
    return null;
  }
}

async function postJSON(path: string, body: unknown): Promise<Response> {
  return fetch(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

async function sendSchedule(sub: PushSubscription, schedule: NotifySchedule) {
  const res = await postJSON('/api/subscribe', { subscription: sub.toJSON(), schedule });
  if (!res.ok) throw new Error(`subscribe: HTTP ${res.status}`);
}

/** Включить пуши: спросить разрешение, подписаться и отдать расписание на сервер */
export async function enablePush(schedule: NotifySchedule): Promise<PushResult> {
  if (!pushSupported()) return { ok: false, reason: 'unsupported' };
  if (isIOS() && !isStandalone()) return { ok: false, reason: 'ios-install' };

  let permission: NotificationPermission;
  try {
    permission = await Notification.requestPermission();
  } catch (e) {
    return { ok: false, reason: 'error', message: String(e) };
  }
  if (permission !== 'granted') return { ok: false, reason: 'denied' };

  try {
    const reg = await registration();
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });
    }
    await sendSchedule(sub, schedule);
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: 'error', message: String(e) };
  }
}

/** Тихо обновить расписание на сервере (даты, имя, настройки) */
export async function syncSchedule(schedule: NotifySchedule): Promise<boolean> {
  const sub = await currentSubscription();
  if (!sub) return false;
  try {
    await sendSchedule(sub, schedule);
    return true;
  } catch {
    return false;
  }
}

/** Выключить пуши: снять подписку и на сервере, и в браузере */
export async function disablePush(): Promise<void> {
  const sub = await currentSubscription();
  if (!sub) return;
  const endpoint = sub.endpoint;
  try {
    await postJSON('/api/subscribe', { action: 'off', endpoint });
  } catch {
    /* даже если сервер недоступен — локально отписываемся */
  }
  try {
    await sub.unsubscribe();
  } catch {
    /* ignore */
  }
}

/** Попросить сервер отправить тестовое уведомление на эту подписку */
export async function sendTestPush(): Promise<{ ok: boolean; message?: string }> {
  const sub = await currentSubscription();
  if (!sub) return { ok: false, message: 'нет подписки' };
  try {
    const res = await postJSON('/api/test', { endpoint: sub.endpoint });
    const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
    if (res.ok && data.ok) return { ok: true };
    return { ok: false, message: data.error || `HTTP ${res.status}` };
  } catch (e) {
    return { ok: false, message: String(e) };
  }
}

/**
 * Уведомление в момент события, пока приложение открыто.
 * Закрытое приложение обслуживает серверный планировщик.
 */
export async function showLocalNotification(n: { title: string; body: string; tag?: string }) {
  if (!pushSupported() || Notification.permission !== 'granted') return;
  try {
    const reg = await registration();
    await reg.showNotification(n.title, {
      body: n.body,
      icon: './icon-192.png',
      badge: './badge-72.png',
      tag: n.tag,
      vibrate: [16, 80, 16],
      data: { url: './' },
    } as NotificationOptions);
  } catch {
    /* ignore */
  }
}
