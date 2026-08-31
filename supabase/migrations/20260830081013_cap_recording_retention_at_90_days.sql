-- Recording audio is intentionally short-lived to control storage costs.
-- A value of 0 remains the explicit opt-out for automatic deletion.
update public.servers
set application_retention_days = 90
where application_retention_days > 90;

alter table public.servers
  drop constraint if exists servers_application_retention_days_check;

alter table public.servers
  add constraint servers_application_retention_days_check
  check (application_retention_days = 0 or application_retention_days between 7 and 90);
