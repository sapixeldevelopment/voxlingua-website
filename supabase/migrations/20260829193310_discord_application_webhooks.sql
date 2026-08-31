-- Keep Discord webhook bearer URLs out of the exposed client-facing tables.
-- Only the trusted Next.js server (service_role) can read or write these rows.
create table if not exists public.server_discord_webhooks (
  server_id uuid primary key references public.servers(id) on delete cascade,
  webhook_url text not null check (char_length(webhook_url) between 40 and 512),
  configured_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.server_discord_webhooks enable row level security;
revoke all on public.server_discord_webhooks from public, anon, authenticated;
grant select, insert, update, delete on public.server_discord_webhooks to service_role;

drop trigger if exists server_discord_webhooks_touch on public.server_discord_webhooks;
create trigger server_discord_webhooks_touch
  before update on public.server_discord_webhooks
  for each row execute procedure public.touch_updated_at();
