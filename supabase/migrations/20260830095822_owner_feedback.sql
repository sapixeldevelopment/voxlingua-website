create table public.owner_feedback (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  category text not null check (category in ('bug', 'suggestion', 'question', 'other')),
  subject text not null check (char_length(btrim(subject)) between 3 and 120),
  message text not null check (char_length(btrim(message)) between 10 and 5000),
  page_path text check (page_path is null or char_length(page_path) <= 500),
  status text not null default 'open' check (status in ('open', 'in_progress', 'resolved', 'closed')),
  created_at timestamptz not null default now()
);

create index owner_feedback_owner_created_idx
  on public.owner_feedback (owner_id, created_at desc);

alter table public.owner_feedback enable row level security;

create policy "Owners can read their own feedback"
  on public.owner_feedback
  for select
  to authenticated
  using ((select auth.uid()) = owner_id);

create policy "Owners can submit their own feedback"
  on public.owner_feedback
  for insert
  to authenticated
  with check ((select auth.uid()) = owner_id);

grant select, insert on public.owner_feedback to authenticated;
