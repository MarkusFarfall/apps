/**
 * POST /api/test — отправить тестовое уведомление на конкретную подписку.
 * Нужен кнопке «Проверить» в настройках: пользователь сразу видит,
 * что путь «сервер → push-сервис → устройство» работает.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { configureVapid, loadSub, sendPush } from './_lib';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'method not allowed' });
  }

  const body = typeof req.body === 'string' ? safeJSON<{ endpoint?: string }>(req.body) : req.body;
  const endpoint = body?.endpoint;
  if (typeof endpoint !== 'string' || !endpoint.startsWith('https://')) {
    return res.status(400).json({ error: 'bad endpoint' });
  }

  try {
    configureVapid();
  } catch (e) {
    return res.status(500).json({ error: (e as Error).message });
  }

  const sub = await loadSub(endpoint);
  if (!sub) return res.status(404).json({ error: 'подписка не найдена' });

  const days = Math.max(0, Math.ceil((new Date(sub.schedule.end).getTime() - Date.now()) / 86400000));
  const result = await sendPush(sub, {
    title: '✅ Проверка связи',
    body: `${sub.schedule.name || 'Боец'}, уведомления работают. До дембеля ${days} дн.`,
    tag: 'dmb-test',
    icon: '/icon-192.png',
    badge: '/badge-72.png',
    url: './',
  });

  if (result === 'gone') return res.status(410).json({ error: 'подписка больше не действительна' });
  if (result === 'error') return res.status(502).json({ error: 'push-сервис отклонил отправку' });
  return res.status(200).json({ ok: true });
}

function safeJSON<T>(text: string): T | null {
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}
