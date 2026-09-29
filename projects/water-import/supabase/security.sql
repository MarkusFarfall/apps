-- Выполнить в Supabase → SQL Editor ПОСЛЕ schema.sql.
-- Игра обращается к базе напрямую (роль postgres — владелец таблиц, RLS её не ограничивает).
-- Включённый RLS без политик полностью закрывает таблицы от публичного REST/GraphQL API Supabase,
-- поэтому хэши паролей и токены сессий недоступны по anon-ключу.
alter table public.users    enable row level security;
alter table public.sessions enable row level security;
alter table public.players  enable row level security;
alter table public.saves    enable row level security;
alter table public.catches  enable row level security;

revoke all on public.users, public.sessions, public.players, public.saves, public.catches from anon, authenticated;

-- Периодическая уборка просроченных сессий (если включено расширение pg_cron):
-- select cron.schedule('zv-sessions-cleanup', '0 4 * * *', $$delete from public.sessions where expires_at < now()$$);
