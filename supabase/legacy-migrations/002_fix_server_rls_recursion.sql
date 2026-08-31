-- Keep the cross-table ownership checks outside the exposed public schema.
-- SECURITY DEFINER is intentional here: it lets the policies inspect the
-- related table without recursively re-entering the other table's RLS policy.
create schema if not exists private;

create or replace function private.is_server_owner(p_server_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.servers s
    where s.id = p_server_id
      and s.owner_id = (select auth.uid())
  );
$$;

create or replace function private.is_server_member(p_server_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.server_members sm
    where sm.server_id = p_server_id
      and sm.user_id = (select auth.uid())
  );
$$;

revoke all on function private.is_server_owner(uuid) from public;
revoke all on function private.is_server_member(uuid) from public;
grant execute on function private.is_server_owner(uuid) to authenticated;
grant execute on function private.is_server_member(uuid) to authenticated;

drop policy if exists "active portals are public" on public.servers;
drop policy if exists "members can see their servers" on public.servers;
drop policy if exists "owners add membership" on public.server_members;
drop policy if exists "members see their membership" on public.server_members;
drop policy if exists "owners manage membership" on public.server_members;
drop policy if exists "owners remove membership" on public.server_members;

create policy "active portals are public"
  on public.servers for select
  to anon, authenticated
  using (is_active = true);

create policy "members can see their servers"
  on public.servers for select
  to authenticated
  using (
    owner_id = (select auth.uid())
    or private.is_server_member(id)
  );

create policy "members see their membership"
  on public.server_members for select
  to authenticated
  using (
    user_id = (select auth.uid())
    or private.is_server_owner(server_id)
  );

create policy "owners add membership"
  on public.server_members for insert
  to authenticated
  with check (
    user_id = (select auth.uid())
    and role = 'owner'
    and private.is_server_owner(server_id)
  );

create policy "owners manage membership"
  on public.server_members for update
  to authenticated
  using (private.is_server_owner(server_id))
  with check (true);

create policy "owners remove membership"
  on public.server_members for delete
  to authenticated
  using (private.is_server_owner(server_id));
