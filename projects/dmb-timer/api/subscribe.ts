/**
 * POST /api/subscribe — сохранить или удалить подписку на уведомления.
 *   { subscription, profile, events }  — подписаться / обновить календарь событий
 *   { action: 'off', endpoint }        — отписаться
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { deleteSub, loadSub, parseSubscribeBody, saveSub, type StoredSub } from './_lib.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'method not allowed' });
  }

  const body = typeof req.body === 'string' ? safeJSON(req.body) : req.body;

  if (body?.action === 'off') {
    const endpoint = typeof body.endpoint === 'string' ? body.endpoint : '';
    if (!endpoint.startsWith('https://')) return res.status(400).json({ error: 'bad endpoint' });
    await deleteSub(endpoint);
    return res.status(200).json({ ok: true, off: true });
  }

  const parsed = parseSubscribeBody(body);
  if (!parsed.ok) return res.status(400).json({ error: parsed.error });

  const now = Date.now();
  const existing = await loadSub(parsed.subscription.endpoint);

  const stored: StoredSub = {
    endpoint: parsed.subscription.endpoint,
    keys: parsed.subscription.keys,
    profile: parsed.profile,
    events: parsed.events,
    sent: existing?.sent ?? {},
    lastRunAt: existing?.lastRunAt,
    createdAt: existing?.createdAt ?? now,
    ua: typeof req.headers['user-agent'] === 'string' ? req.headers['user-agent'].slice(0, 120) : undefined,
  };

  await saveSub(stored);
  return res.status(200).json({
    ok: true,
    createdAt: stored.createdAt,
    updated: Boolean(existing),
    events: stored.events.length,
  });
}

function safeJSON<T>(text: string): T | null {
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}
