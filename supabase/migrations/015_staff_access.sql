-- Owner-managed staff access. Staff authenticate with Discord, then redeem a
-- one-time invite code. The database remains the source of truth for caps.
alter table public.servers
  add column if not exists staff_role_id text,
  add column if not exists staff_role_name text;

alter table public.owner_billing
  add column if not exists staff_limit integer not null default 5
  check (staff_limit = -1 or staff_limit >= 1);

update public.owner_billing
set staff_limit = case plan_key
  when 'small' then 5
  when 'medium' then 15
  when 'pro' then 30
  when 'ultra' then -1
end;

create table if not exists public.server_staff_invites (
  id uuid primary key default gen_random_uuid(),
  server_id uuid not null references public.servers(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete cascade,
  code_hash text not null unique,
  role text not null default 'admin' check (role in ('admin', 'reviewer')),
  expires_at timestamptz not null default (now() + interval '7 days'),
  accepted_at timestamptz,
  accepted_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.server_staff_invites enable row level security;
revoke all on public.server_staff_invites from anon, authenticated;

create index if not exists server_staff_invites_server_idx
  on public.server_staff_invites(server_id, accepted_at, expires_at);

create or replace function private.can_add_staff(p_server_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.servers s
    join public.owner_billing b on b.user_id = s.owner_id
    where s.id = p_server_id
      and s.owner_id = (select auth.uid())
      and b.status = 'active'
      and (
        b.staff_limit = -1
        or (
          select count(*)
          from public.server_members sm
          where sm.server_id = s.id and sm.role <> 'owner'
        ) + (
          select count(*)
          from public.server_staff_invites i
          where i.server_id = s.id
            and i.accepted_at is null
            and i.expires_at > now()
        ) < b.staff_limit
      )
  );
$$;

revoke all on function private.can_add_staff(uuid) from public;
grant execute on function private.can_add_staff(uuid) to authenticated;

drop function if exists public.create_staff_invite(uuid, text, text);

create function public.create_staff_invite(
  p_server_id uuid,
  p_code_hash text,
  p_owner_id uuid,
  p_role text default 'admin'
)
returns table(id uuid, expires_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner uuid;
  v_limit integer;
  v_count integer;
  v_id uuid;
  v_expires timestamptz;
begin
  if p_owner_id is null then
    raise exception 'A verified owner is required.' using errcode = 'P0001';
  end if;
  if p_role not in ('admin', 'reviewer') then
    raise exception 'Invalid staff role.' using errcode = 'P0001';
  end if;
  if p_code_hash is null or char_length(p_code_hash) <> 64 then
    raise exception 'Invalid invite code.' using errcode = 'P0001';
  end if;

  select s.owner_id into v_owner
  from public.servers s
  where s.id = p_server_id;
  if v_owner is null or v_owner <> p_owner_id then
    raise exception 'Only the server owner can add staff.' using errcode = 'P0001';
  end if;

  -- Lock the billing row so concurrent invite requests cannot oversubscribe.
  select b.staff_limit into v_limit
  from public.owner_billing b
  where b.user_id = v_owner and b.status = 'active'
  for update;
  if not found then
    raise exception 'An active subscription is required to add staff.' using errcode = 'P0001';
  end if;

  select count(*) into v_count
  from public.server_members sm
  where sm.server_id = p_server_id and sm.role <> 'owner';
  v_count := v_count + (
    select count(*)
    from public.server_staff_invites i
    where i.server_id = p_server_id
      and i.accepted_at is null
      and i.expires_at > now()
  );
  if v_limit <> -1 and v_count >= v_limit then
    raise exception 'Your plan has reached its staff limit.' using errcode = 'P0001';
  end if;

  v_expires := now() + interval '7 days';
  insert into public.server_staff_invites(server_id, created_by, code_hash, role, expires_at)
  values (p_server_id, p_owner_id, p_code_hash, p_role, v_expires)
  returning server_staff_invites.id, server_staff_invites.expires_at
  into v_id, v_expires;
  return query select v_id, v_expires;
exception
  when unique_violation then
    raise exception 'Could not create the invite. Please try again.' using errcode = 'P0001';
end;
$$;

revoke all on function public.create_staff_invite(uuid, text, uuid, text) from public;
revoke execute on function public.create_staff_invite(uuid, text, uuid, text) from anon, authenticated;
grant execute on function public.create_staff_invite(uuid, text, uuid, text) to service_role;

create or replace function public.accept_staff_invite(
  p_code_hash text,
  p_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_invite record;
  v_existing_role text;
  v_staff_count integer;
begin
  if p_user_id is null then
    raise exception 'A verified user is required.' using errcode = 'P0001';
  end if;

  select i.id, i.server_id, i.role, i.accepted_at, i.expires_at,
         s.name as server_name, s.is_active, b.status as billing_status,
         b.staff_limit
    into v_invite
    from public.server_staff_invites i
    join public.servers s on s.id = i.server_id
    join public.owner_billing b on b.user_id = s.owner_id
   where i.code_hash = p_code_hash
     and i.accepted_at is null
     and i.expires_at > now()
     and s.is_active = true
   for update of i, b;

  if not found then
    raise exception 'This invite is invalid, expired, or has already been used.' using errcode = 'P0001';
  end if;
  if v_invite.billing_status <> 'active' then
    raise exception 'The server subscription is not active.' using errcode = 'P0001';
  end if;

  select sm.role into v_existing_role
  from public.server_members sm
  where sm.server_id = v_invite.server_id and sm.user_id = p_user_id;
  if v_existing_role = 'owner' then
    update public.server_staff_invites
       set accepted_at = now(), accepted_by = p_user_id
     where id = v_invite.id;
    return jsonb_build_object('ok', true, 'already_member', true, 'server_id', v_invite.server_id, 'server_name', v_invite.server_name, 'role', 'owner');
  elsif v_existing_role is not null then
    update public.server_members
       set role = v_invite.role
     where server_id = v_invite.server_id and user_id = p_user_id;
    update public.server_staff_invites
       set accepted_at = now(), accepted_by = p_user_id
     where id = v_invite.id;
    return jsonb_build_object('ok', true, 'already_member', true, 'server_id', v_invite.server_id, 'server_name', v_invite.server_name, 'role', v_invite.role);
  end if;

  select count(*) into v_staff_count
  from public.server_members sm
  where sm.server_id = v_invite.server_id and sm.role <> 'owner';
  if v_invite.staff_limit <> -1 and v_staff_count >= v_invite.staff_limit then
    raise exception 'Your plan has reached its staff limit.' using errcode = 'P0001';
  end if;

  insert into public.server_members(server_id, user_id, role)
  values (v_invite.server_id, p_user_id, v_invite.role);
  update public.server_staff_invites
     set accepted_at = now(), accepted_by = p_user_id
   where id = v_invite.id;
  return jsonb_build_object('ok', true, 'server_id', v_invite.server_id, 'server_name', v_invite.server_name, 'role', v_invite.role);
end;
$$;

revoke all on function public.accept_staff_invite(text, uuid) from public;
revoke execute on function public.accept_staff_invite(text, uuid) from anon, authenticated;
grant execute on function public.accept_staff_invite(text, uuid) to service_role;
