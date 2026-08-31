create table public.discord_moderation_events (
  id uuid primary key default gen_random_uuid(),
  server_id uuid not null references public.servers(id) on delete cascade,
  discord_user_id text not null check (discord_user_id ~ '^[0-9]{15,25}$'),
  event_type text not null check (event_type in ('kick', 'ban', 'unban')),
  discord_audit_log_id text not null check (discord_audit_log_id ~ '^[0-9]{15,25}$'),
  moderator_discord_user_id text check (moderator_discord_user_id is null or moderator_discord_user_id ~ '^[0-9]{15,25}$'),
  moderator_name text,
  reason text,
  occurred_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique (server_id, discord_audit_log_id)
);

create index discord_moderation_events_player_idx
  on public.discord_moderation_events (server_id, discord_user_id, occurred_at desc);

alter table public.discord_moderation_events enable row level security;
revoke all on table public.discord_moderation_events from anon, authenticated;
grant select on table public.discord_moderation_events to authenticated;

create policy "server staff can view moderation history"
  on public.discord_moderation_events for select
  to authenticated
  using (private.is_server_member(server_id));

create table public.discord_moderation_sync_state (
  server_id uuid primary key references public.servers(id) on delete cascade,
  last_synced_at timestamptz not null default now(),
  last_status text not null check (last_status in ('synced', 'fresh', 'not_configured', 'missing_permission', 'rate_limited', 'failed')),
  last_error text,
  updated_at timestamptz not null default now()
);

alter table public.discord_moderation_sync_state enable row level security;
revoke all on table public.discord_moderation_sync_state from anon, authenticated;

create policy "no direct moderation sync state access"
  on public.discord_moderation_sync_state for select
  to authenticated
  using (false);

create trigger discord_moderation_sync_state_touch_updated_at
before update on public.discord_moderation_sync_state
for each row execute procedure public.touch_updated_at();

comment on table public.discord_moderation_events is
  'Server-scoped Discord kick, ban, and unban audit events retained for application safety review.';
