/**
 * Проверка отправки push: поднимаем локальный HTTPS-приёмник, подсовываем его
 * вместо push-сервиса и смотрим, что web-push реально шлёт зашифрованный запрос
 * с корректными заголовками VAPID.
 * Запуск: npm run check:push  (нужны VAPID_PUBLIC_KEY и VAPID_PRIVATE_KEY в env)
 */
import { strict as assert } from 'node:assert';
import { execSync } from 'node:child_process';
import { generateKeyPairSync, randomBytes } from 'node:crypto';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import https from 'node:https';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { configureVapid, sendPush } from '../api/_lib';

configureVapid(); // серверные функции делают это перед отправкой

const dir = mkdtempSync(join(tmpdir(), 'dmb-push-'));
const key = join(dir, 'key.pem');
const cert = join(dir, 'cert.pem');

// самоподписанный сертификат для приёмника
execSync(
  `openssl req -x509 -newkey rsa:2048 -keyout ${key} -out ${cert} -days 1 -nodes -subj "/CN=localhost" 2>/dev/null`
);
assert.ok(existsSync(cert), 'не удалось создать сертификат');

type Captured = { method?: string; headers: Record<string, string | string[] | undefined>; body: Buffer };
const captured: Captured[] = [];

const server = https.createServer(
  { key: readFileSync(key), cert: readFileSync(cert) },
  (req, res) => {
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => chunks.push(c));
    req.on('end', () => {
      captured.push({ method: req.method, headers: req.headers, body: Buffer.concat(chunks) });
      res.writeHead(201, { location: 'https://example.invalid/receipt' });
      res.end();
    });
  }
);

await new Promise<void>((r) => server.listen(0, '127.0.0.1', () => r()));
const port = (server.address() as { port: number }).port;

// доверяем нашему самоподписанному сертификату глобально
https.globalAgent = new https.Agent({ rejectUnauthorized: false });

// синтетическая подписка браузера: настоящая P-256 пара + auth-секрет
const { publicKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
const spki = publicKey.export({ format: 'der', type: 'spki' }) as Buffer;
const p256dh = spki.subarray(spki.length - 65).toString('base64url'); // uncompressed point
const auth = randomBytes(16).toString('base64url');

const sub = { endpoint: `https://127.0.0.1:${port}/push/test-endpoint`, keys: { p256dh, auth } };

const result = await sendPush(sub, { title: '🏆 Экватор', body: 'Пройдено 50%', tag: 'ach-p50' });
assert.equal(result, 'ok', 'sendPush должен вернуть ok');

assert.equal(captured.length, 1, 'приёмник должен получить ровно один запрос');
const req = captured[0];

// шифрование payload
assert.equal(req.method, 'POST');
assert.equal(String(req.headers['content-encoding']), 'aes128gcm');
assert.ok(Number(req.headers['content-length']) > 100, 'тело должно содержать зашифрованный payload');
assert.ok(Number(req.headers.ttl) > 0, 'должен быть заголовок TTL');

// подпись VAPID
const authHeader = String(req.headers.authorization || '');
assert.ok(/^vapid /i.test(authHeader) || /^WebPush /i.test(authHeader), `заголовок VAPID: ${authHeader.slice(0, 30)}`);
assert.ok(authHeader.includes('k='), 'в заголовке должен быть публичный ключ');

// payload зашифрован — открытого текста в теле быть не должно
assert.ok(!req.body.toString('utf8').includes('Экватор'), 'payload не должен уходить открытым текстом');

// подписка с мёртвым endpoint определяется как gone (404/410 от push-сервиса)
const goneServer = https.createServer({ key: readFileSync(key), cert: readFileSync(cert) }, (_q, r) => {
  r.writeHead(410);
  r.end();
});
await new Promise<void>((r) => goneServer.listen(0, '127.0.0.1', () => r()));
const gonePort = (goneServer.address() as { port: number }).port;
const gone = await sendPush({ endpoint: `https://127.0.0.1:${gonePort}/dead`, keys: { p256dh, auth } }, { title: 'x' });
assert.equal(gone, 'gone', '404/410 должен маппиться в gone');

// недоступный хост → error (не падаем)
const err = await sendPush({ endpoint: 'https://127.0.0.1:1/nope', keys: { p256dh, auth } }, { title: 'x' });
assert.equal(err, 'error');

server.close();
goneServer.close();
rmSync(dir, { recursive: true, force: true });

console.log('✓ отправка push проверена: шифрование aes128gcm, подпись VAPID, TTL, обработка gone/error');
