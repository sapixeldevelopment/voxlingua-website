create extension if not exists pgcrypto;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.servers (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 2 and 100),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  discord_guild_id text,
  discord_guild_name text,
  approved_role_id text,
  approved_role_name text,
  welcome_message text not null default 'Welcome to the VellaView interview portal.',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.server_members (
  server_id uuid not null references public.servers(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'admin' check (role in ('owner', 'admin', 'reviewer')),
  created_at timestamptz not null default now(),
  primary key (server_id, user_id)
);

create table public.question_bank (
  id uuid primary key default gen_random_uuid(),
  server_id uuid not null references public.servers(id) on delete cascade,
  prompt text not null,
  scenario text,
  order_index integer not null default 0,
  is_active boolean not null default true,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

create table public.applications (
  id uuid primary key default gen_random_uuid(),
  server_id uuid not null references public.servers(id) on delete cascade,
  applicant_user_id uuid not null references auth.users(id) on delete cascade,
  discord_user_id text,
  discord_username text,
  player_name text not null,
  game_name text,
  experience text,
  status text not null default 'pending' check (status in ('pending', 'interviewing', 'under_review', 'approved', 'declined', 'role_pending', 'role_assigned', 'role_failed')),
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.interview_sessions (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null unique references public.applications(id) on delete cascade,
  server_id uuid not null references public.servers(id) on delete cascade,
  status text not null default 'created' check (status in ('created', 'in_progress', 'completed', 'abandoned')),
  realtime_call_id text,
  transcript jsonb not null default '[]'::jsonb,
  summary text,
  score numeric(5,2),
  recording_path text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  server_id uuid not null references public.servers(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (new.id, new.raw_user_meta_data ->> 'display_name', new.raw_user_meta_data ->> 'avatar_url')
  on conflict (id) do nothing;
  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_touch before update on public.profiles for each row execute procedure public.touch_updated_at();
create trigger servers_touch before update on public.servers for each row execute procedure public.touch_updated_at();
create trigger applications_touch before update on public.applications for each row execute procedure public.touch_updated_at();
create trigger interview_sessions_touch before update on public.interview_sessions for each row execute procedure public.touch_updated_at();

alter table public.profiles enable row level security;
alter table public.servers enable row level security;
alter table public.server_members enable row level security;
alter table public.question_bank enable row level security;
alter table public.applications enable row level security;
alter table public.interview_sessions enable row level security;
alter table public.audit_logs enable row level security;

grant select, insert, update on public.profiles to authenticated;
grant select, insert, update, delete on public.servers to authenticated;
grant select, insert, update, delete on public.server_members to authenticated;
grant select, insert, update, delete on public.question_bank to authenticated;
grant select, insert, update on public.applications to authenticated;
grant select, insert, update on public.interview_sessions to authenticated;
grant select, insert on public.audit_logs to authenticated;
grant select on public.servers to anon;

create policy "profiles own row" on public.profiles for all to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

create policy "active portals are public" on public.servers for select to anon using (is_active = true);
create policy "members can see their servers" on public.servers for select to authenticated using (
  owner_id = (select auth.uid()) or exists (select 1 from public.server_members sm where sm.server_id = servers.id and sm.user_id = (select auth.uid()))
);
create policy "owners create servers" on public.servers for insert to authenticated with check (owner_id = (select auth.uid()));
create policy "owners update servers" on public.servers for update to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy "owners delete servers" on public.servers for delete to authenticated using (owner_id = (select auth.uid()));

create policy "members see their membership" on public.server_members for select to authenticated using (
  user_id = (select auth.uid()) or exists (select 1 from public.servers s where s.id = server_members.server_id and s.owner_id = (select auth.uid()))
);
create policy "owners add membership" on public.server_members for insert to authenticated with check (
  user_id = (select auth.uid()) and role = 'owner' and exists (select 1 from public.servers s where s.id = server_members.server_id and s.owner_id = (select auth.uid()))
);
create policy "owners manage membership" on public.server_members for update to authenticated using (exists (select 1 from public.servers s where s.id = server_members.server_id and s.owner_id = (select auth.uid()))) with check (true);
create policy "owners remove membership" on public.server_members for delete to authenticated using (exists (select 1 from public.servers s where s.id = server_members.server_id and s.owner_id = (select auth.uid())));

create policy "managers see questions" on public.question_bank for select to authenticated using (exists (select 1 from public.server_members sm where sm.server_id = question_bank.server_id and sm.user_id = (select auth.uid()) and sm.role in ('owner','admin','reviewer')));
create policy "managers create questions" on public.question_bank for insert to authenticated with check (created_by = (select auth.uid()) and exists (select 1 from public.server_members sm where sm.server_id = question_bank.server_id and sm.user_id = (select auth.uid()) and sm.role in ('owner','admin')));
create policy "managers update questions" on public.question_bank for update to authenticated using (exists (select 1 from public.server_members sm where sm.server_id = question_bank.server_id and sm.user_id = (select auth.uid()) and sm.role in ('owner','admin'))) with check (true);
create policy "managers delete questions" on public.question_bank for delete to authenticated using (exists (select 1 from public.server_members sm where sm.server_id = question_bank.server_id and sm.user_id = (select auth.uid()) and sm.role in ('owner','admin')));

create policy "applicants and managers see applications" on public.applications for select to authenticated using (
  applicant_user_id = (select auth.uid()) or exists (select 1 from public.server_members sm where sm.server_id = applications.server_id and sm.user_id = (select auth.uid()) and sm.role in ('owner','admin','reviewer'))
);
create policy "authenticated users submit applications" on public.applications for insert to authenticated with check (
  applicant_user_id = (select auth.uid()) and exists (select 1 from public.servers s where s.id = applications.server_id and s.is_active = true)
);
create policy "managers review applications" on public.applications for update to authenticated using (exists (select 1 from public.server_members sm where sm.server_id = applications.server_id and sm.user_id = (select auth.uid()) and sm.role in ('owner','admin','reviewer'))) with check (true);

create policy "participants see interviews" on public.interview_sessions for select to authenticated using (
  exists (select 1 from public.applications a where a.id = interview_sessions.application_id and a.applicant_user_id = (select auth.uid())) or exists (select 1 from public.server_members sm where sm.server_id = interview_sessions.server_id and sm.user_id = (select auth.uid()) and sm.role in ('owner','admin','reviewer'))
);
create policy "participants create interviews" on public.interview_sessions for insert to authenticated with check (
  exists (select 1 from public.applications a where a.id = interview_sessions.application_id and a.applicant_user_id = (select auth.uid()) and a.server_id = interview_sessions.server_id) or exists (select 1 from public.server_members sm where sm.server_id = interview_sessions.server_id and sm.user_id = (select auth.uid()) and sm.role in ('owner','admin'))
);
create policy "participants update interviews" on public.interview_sessions for update to authenticated using (
  exists (select 1 from public.applications a where a.id = interview_sessions.application_id and a.applicant_user_id = (select auth.uid())) or exists (select 1 from public.server_members sm where sm.server_id = interview_sessions.server_id and sm.user_id = (select auth.uid()) and sm.role in ('owner','admin','reviewer'))
) with check (true);

create policy "managers see audit logs" on public.audit_logs for select to authenticated using (exists (select 1 from public.server_members sm where sm.server_id = audit_logs.server_id and sm.user_id = (select auth.uid()) and sm.role in ('owner','admin','reviewer')));
create policy "managers write audit logs" on public.audit_logs for insert to authenticated with check (actor_user_id = (select auth.uid()) and exists (select 1 from public.server_members sm where sm.server_id = audit_logs.server_id and sm.user_id = (select auth.uid()) and sm.role in ('owner','admin')));

insert into storage.buckets (id, name, public) values ('interview-recordings', 'interview-recordings', false) on conflict (id) do nothing;

;
