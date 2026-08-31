-- Store the server allowance on the billing record so enforcement is not
-- dependent on client-provided plan data.
alter table public.owner_billing
  add column if not exists server_limit integer not null default 1
  check (server_limit = -1 or server_limit >= 1);

update public.owner_billing
set server_limit = case plan_key
  when 'small' then 1
  when 'medium' then 1
  when 'pro' then 3
  when 'ultra' then 15
end;

create or replace function private.can_create_server(p_owner_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.owner_billing b
    where b.user_id = p_owner_id
      and b.status = 'active'
      and (
        b.server_limit = -1
        or (
          select count(*)
          from public.servers s
          where s.owner_id = p_owner_id
        ) < b.server_limit
      )
  );
$$;

create or replace function private.enforce_server_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_limit integer;
  v_existing integer;
begin
  select b.server_limit
    into v_limit
    from public.owner_billing b
   where b.user_id = new.owner_id
     and b.status = 'active'
   for update;

  if not found then
    raise exception 'An active subscription is required to create a server.' using errcode = 'P0001';
  end if;

  select count(*)
    into v_existing
    from public.servers s
   where s.owner_id = new.owner_id;

  if v_limit <> -1 and v_existing >= v_limit then
    raise exception 'Your current plan allows a maximum of % server(s).', v_limit using errcode = 'P0001';
  end if;

  return new;
end;
$$;

revoke all on function private.can_create_server(uuid) from public;
revoke all on function private.enforce_server_limit() from public;
grant execute on function private.can_create_server(uuid) to authenticated;

drop trigger if exists enforce_server_plan_limit on public.servers;
create trigger enforce_server_plan_limit
  before insert on public.servers
  for each row execute function private.enforce_server_limit();

drop policy if exists "subscribed owners create servers" on public.servers;
create policy "subscribed owners create servers"
  on public.servers for insert
  to authenticated
  with check (
    owner_id = (select auth.uid())
    and private.can_create_server((select auth.uid()))
  );;
