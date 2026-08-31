-- A portal is public while its owner has an active subscription or a paused
-- subscription whose already-paid billing period has not ended.
-- The helper is SECURITY DEFINER so the public servers policy can inspect
-- owner_billing without exposing billing rows to applicants or anon users.
create or replace function private.has_active_subscription(p_owner_id uuid)
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
      and (
        b.status = 'active'
        or (b.status = 'suspended' and current_date < b.monthly_period_end)
      )
  );
$$;

revoke all on function private.has_active_subscription(uuid) from public;
grant execute on function private.has_active_subscription(uuid) to anon, authenticated;

drop policy if exists "active portals are public" on public.servers;
drop policy if exists "members can see their servers" on public.servers;

create policy "active subscribed portals are public"
  on public.servers for select
  to anon, authenticated
  using (
    is_active = true
    and private.has_active_subscription(owner_id)
  );

create policy "subscribed members can see their servers"
  on public.servers for select
  to authenticated
  using (
    (
      owner_id = (select auth.uid())
      or private.is_server_member(id)
    )
    and private.has_active_subscription(owner_id)
  );
