-- Add the entry-level Starter subscription while keeping plan entitlements
-- server-controlled on owner_billing.
set local lock_timeout = '5s';

alter table public.owner_billing
  drop constraint if exists owner_billing_plan_key_check;

alter table public.owner_billing
  add constraint owner_billing_plan_key_check
  check (plan_key in ('starter', 'small', 'medium', 'pro', 'ultra'));
