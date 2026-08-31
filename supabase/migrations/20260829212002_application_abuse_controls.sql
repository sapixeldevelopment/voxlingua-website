alter table public.servers
  add column if not exists application_retention_days integer not null default 90,
  add column if not exists declined_reapply_cooldown_days integer not null default 30;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'servers_application_retention_days_check'
      and conrelid = 'public.servers'::regclass
  ) then
    alter table public.servers
      add constraint servers_application_retention_days_check
      check (application_retention_days = 0 or application_retention_days between 7 and 730);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'servers_declined_reapply_cooldown_days_check'
      and conrelid = 'public.servers'::regclass
  ) then
    alter table public.servers
      add constraint servers_declined_reapply_cooldown_days_check
      check (declined_reapply_cooldown_days between 0 and 365);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'servers_retention_covers_cooldown_check'
      and conrelid = 'public.servers'::regclass
  ) then
    alter table public.servers
      add constraint servers_retention_covers_cooldown_check
      check (
        application_retention_days = 0
        or application_retention_days >= declined_reapply_cooldown_days
      );
  end if;
end
$$;

create table if not exists public.application_reapply_blocks (
  server_id uuid not null references public.servers(id) on delete cascade,
  applicant_user_id uuid not null references auth.users(id) on delete cascade,
  last_application_id uuid references public.applications(id) on delete set null,
  blocked_until timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (server_id, applicant_user_id)
);

alter table public.application_reapply_blocks enable row level security;
revoke all on public.application_reapply_blocks from anon, authenticated;
grant all on public.application_reapply_blocks to service_role;

drop policy if exists "service role manages reapply blocks" on public.application_reapply_blocks;
create policy "service role manages reapply blocks"
  on public.application_reapply_blocks
  for all
  to service_role
  using (true)
  with check (true);

create index if not exists application_reapply_blocks_expiry_idx
  on public.application_reapply_blocks (blocked_until);

create unique index if not exists applications_one_active_per_applicant_idx
  on public.applications (server_id, applicant_user_id)
  where status in ('pending', 'interviewing', 'under_review', 'role_pending', 'role_failed');

create index if not exists applications_retention_cleanup_idx
  on public.applications (server_id, reviewed_at)
  where status in ('approved', 'declined', 'role_assigned') and reviewed_at is not null;

update public.applications
set reviewed_at = updated_at
where status in ('approved', 'declined', 'role_assigned')
  and reviewed_at is null;

create or replace function public.sync_application_reapply_block()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_cooldown_days integer;
begin
  if new.status = 'declined' and old.status is distinct from 'declined' then
    select s.declined_reapply_cooldown_days
      into v_cooldown_days
    from public.servers s
    where s.id = new.server_id;

    insert into public.application_reapply_blocks (
      server_id,
      applicant_user_id,
      last_application_id,
      blocked_until,
      updated_at
    )
    values (
      new.server_id,
      new.applicant_user_id,
      new.id,
      now() + make_interval(days => coalesce(v_cooldown_days, 30)),
      now()
    )
    on conflict (server_id, applicant_user_id)
    do update set
      last_application_id = excluded.last_application_id,
      blocked_until = excluded.blocked_until,
      updated_at = now();
  end if;

  return new;
end;
$$;

drop trigger if exists applications_sync_reapply_block on public.applications;
create trigger applications_sync_reapply_block
after update of status on public.applications
for each row
execute function public.sync_application_reapply_block();

comment on column public.servers.application_retention_days is
  'Days to retain decided applications. Zero keeps history until manually deleted.';
comment on column public.servers.declined_reapply_cooldown_days is
  'Days a declined applicant must wait before applying to this server again.';
comment on table public.application_reapply_blocks is
  'Server-side cooldown records retained independently from application history.';
