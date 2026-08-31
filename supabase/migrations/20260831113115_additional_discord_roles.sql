-- Owners can define optional Discord roles and reviewers can select them when
-- approving an application. The existing servers.approved_role_id remains the
-- mandatory approval role and is intentionally kept separate.
create table if not exists public.server_additional_roles (
  id uuid primary key default gen_random_uuid(),
  server_id uuid not null references public.servers(id) on delete cascade,
  role_id text not null check (role_id ~ '^[0-9]{15,25}$'),
  name text not null check (char_length(btrim(name)) between 1 and 80),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (server_id, role_id),
  unique (server_id, name)
);

create index if not exists server_additional_roles_server_id_idx
  on public.server_additional_roles(server_id);

alter table public.server_additional_roles enable row level security;

drop policy if exists "members see additional Discord roles" on public.server_additional_roles;
create policy "members see additional Discord roles"
  on public.server_additional_roles
  for select to authenticated
  using (
    exists (
      select 1
      from public.server_members sm
      where sm.server_id = server_additional_roles.server_id
        and sm.user_id = (select auth.uid())
        and sm.role in ('owner', 'admin', 'reviewer')
    )
  );

drop policy if exists "managers create additional Discord roles" on public.server_additional_roles;
create policy "managers create additional Discord roles"
  on public.server_additional_roles
  for insert to authenticated
  with check (
    exists (
      select 1
      from public.server_members sm
      where sm.server_id = server_additional_roles.server_id
        and sm.user_id = (select auth.uid())
        and sm.role in ('owner', 'admin')
    )
  );

drop policy if exists "managers update additional Discord roles" on public.server_additional_roles;
create policy "managers update additional Discord roles"
  on public.server_additional_roles
  for update to authenticated
  using (
    exists (
      select 1
      from public.server_members sm
      where sm.server_id = server_additional_roles.server_id
        and sm.user_id = (select auth.uid())
        and sm.role in ('owner', 'admin')
    )
  )
  with check (
    exists (
      select 1
      from public.server_members sm
      where sm.server_id = server_additional_roles.server_id
        and sm.user_id = (select auth.uid())
        and sm.role in ('owner', 'admin')
    )
  );

drop policy if exists "managers delete additional Discord roles" on public.server_additional_roles;
create policy "managers delete additional Discord roles"
  on public.server_additional_roles
  for delete to authenticated
  using (
    exists (
      select 1
      from public.server_members sm
      where sm.server_id = server_additional_roles.server_id
        and sm.user_id = (select auth.uid())
        and sm.role in ('owner', 'admin')
    )
  );

grant select, insert, update, delete on public.server_additional_roles to authenticated;

drop trigger if exists server_additional_roles_touch on public.server_additional_roles;
create trigger server_additional_roles_touch
  before update on public.server_additional_roles
  for each row execute procedure public.touch_updated_at();
