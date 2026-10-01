-- Выполнить ПОСЛЕ schema.sql: в Supabase → SQL Editor, локально — node scripts/db-migrate.mjs.
-- Игра обращается к базе напрямую (роль postgres — владелец таблиц, RLS её не ограничивает).
-- Включённый RLS без политик полностью закрывает таблицы от публичного REST/GraphQL API Supabase,
-- поэтому хэши паролей и токены сессий недоступны по anon-ключу. Повторный запуск безопасен.
alter table public.users    enable row level security;
alter table public.sessions enable row level security;
alter table public.players  enable row level security;
alter table public.saves    enable row level security;
alter table public.catches  enable row level security;
alter table public.rate_limits enable row level security;

-- Отзываем права у публичных ролей Supabase. В обычном PostgreSQL (локальная разработка)
-- таких ролей нет — тогда шаг просто пропускается, а не роняет скрипт с ошибкой.
do $$
declare
  roles text;
begin
  select string_agg(quote_ident(r.rolname), ', ')
    into roles
    from pg_roles r
   where r.rolname in ('anon', 'authenticated');

  if roles is null then
    raise notice 'Роли anon/authenticated не найдены — это не Supabase, шаг с revoke пропущен';
    return;
  end if;

  execute format(
    'revoke all on public.users, public.sessions, public.players, public.saves, public.catches, public.rate_limits from %s',
    roles
  );
end
$$;

-- Периодическая уборка просроченных сессий (если включено расширение pg_cron):
-- select cron.schedule('zv-sessions-cleanup', '0 4 * * *', $$delete from public.sessions where expires_at < now()$$);
