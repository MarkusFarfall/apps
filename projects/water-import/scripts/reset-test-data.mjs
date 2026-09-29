/**
 * Удаляет данные, созданные проверкой scripts/smoke.sh.
 * Запуск: node scripts/reset-test-data.mjs <имя_пользователя> <playerId>
 * Строка подключения берётся из .env.local / .env / окружения (DATABASE_URL).
 */
import { readFileSync, existsSync } from 'node:fs';
import pg from 'pg';

for (const file of ['.env.local', '.env']) {
  if (!existsSync(file)) continue;
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?([^"\n]*)"?\s*$/i);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}

const [username, playerId] = process.argv.slice(2);
if (!username && !playerId) {
  console.error('Укажите имя пользователя и/или playerId');
  process.exit(1);
}

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL не задан');
  process.exit(1);
}

const client = new pg.Client({
  connectionString: url,
  ssl: /sslmode=require|supabase\.(co|com)/i.test(url) ? { rejectUnauthorized: false } : undefined,
});
await client.connect();

const removed = {};
const run = async (label, sql, params) => {
  const r = await client.query(sql, params);
  removed[label] = (removed[label] ?? 0) + r.rowCount;
};

try {
  const ids = new Set([playerId].filter(Boolean));
  if (username) {
    const rows = await client.query('select p.id from players p join users u on u.id = p.user_id where u.username_lower = $1', [username.toLowerCase()]);
    for (const r of rows.rows) ids.add(r.id);
  }
  for (const id of ids) {
    await run('catches', 'delete from catches where player_id = $1', [id]);
    await run('saves', 'delete from saves where player_id = $1', [id]);
    await run('players', 'delete from players where id = $1', [id]);
  }
  if (username) {
    const u = await client.query('select id from users where username_lower = $1', [username.toLowerCase()]);
    for (const r of u.rows) await run('sessions', 'delete from sessions where user_id = $1', [r.id]);
    await run('users', 'delete from users where username_lower = $1', [username.toLowerCase()]);
  }
  console.log('✓ удалено:', Object.entries(removed).filter(([, n]) => n).map(([k, n]) => `${k}: ${n}`).join(', ') || 'ничего');
} finally {
  await client.end();
}
