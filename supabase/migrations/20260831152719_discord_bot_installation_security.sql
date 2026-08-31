-- Bind each portal to one verified Discord guild. The binding is private and
-- can only be written by the server-side service role after Discord checks.
create table if not exists public.server_discord_connections (
  server_id uuid primary key references public.servers(id) on delete cascade,
  guild_id text not null unique check (guild_id ~ '^[0-9]{15,25}$'),
  guild_name text,
  verified_at timestamptz not null default now(),
  verified_by uuid references auth.users(id) on delete set null
);

alter table public.server_discord_connections enable row level security;
revoke all on table public.server_discord_connections from anon, authenticated;
grant all on table public.server_discord_connections to service_role;

create index if not exists server_discord_connections_verified_by_idx
  on public.server_discord_connections(verified_by);

create or replace function public.protect_server_discord_fields()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  request_role text := coalesce(current_setting('request.jwt.claim.role', true), current_user);
begin
  if request_role <> 'service_role' then
    if tg_op = 'INSERT' and (new.discord_guild_id is not null or new.discord_guild_name is not null) then
      raise exception 'Discord connections must be verified by the server';
    end if;
    if tg_op = 'UPDATE' and (
      new.discord_guild_id is distinct from old.discord_guild_id or
      new.discord_guild_name is distinct from old.discord_guild_name
    ) then
      raise exception 'Discord connections must be verified by the server';
    end if;
  end if;
  return new;
end;
$$;

revoke execute on function public.protect_server_discord_fields() from public, anon, authenticated;
drop trigger if exists servers_protect_discord_fields on public.servers;
create trigger servers_protect_discord_fields
before insert or update on public.servers
for each row execute function public.protect_server_discord_fields();
