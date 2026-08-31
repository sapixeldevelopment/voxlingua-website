-- A deleted verifier should not make a valid Discord connection impossible to
-- delete. The portal itself remains the owner-scoped source of truth.
alter table public.server_discord_connections
  alter column verified_by drop not null;
