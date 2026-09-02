create table public.platform_staff (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('support', 'admin')),
  display_name text check (display_name is null or char_length(btrim(display_name)) between 1 and 80),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index platform_staff_active_role_idx
  on public.platform_staff (is_active, role)
  where is_active = true;

alter table public.platform_staff enable row level security;

revoke all on table public.platform_staff from anon, authenticated;
grant select (user_id, role, display_name, is_active) on table public.platform_staff to authenticated;
grant all on table public.platform_staff to service_role;

create policy "Platform staff can read their own access record"
  on public.platform_staff
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

alter table public.owner_feedback
  add column submitter_email text,
  add column support_notes text not null default '' check (char_length(support_notes) <= 5000),
  add column updated_at timestamptz not null default now(),
  add column updated_by uuid references auth.users(id) on delete set null;

update public.owner_feedback as feedback
set submitter_email = users.email
from auth.users as users
where users.id = feedback.owner_id
  and feedback.submitter_email is null;

create index owner_feedback_status_created_idx
  on public.owner_feedback (status, created_at desc);

create index owner_feedback_updated_by_idx
  on public.owner_feedback (updated_by)
  where updated_by is not null;

comment on table public.platform_staff is 'Explicit allowlist for the private Dexlyy platform support workspace.';
comment on column public.owner_feedback.support_notes is 'Internal Dexlyy support notes; never returned to ticket submitters.';

