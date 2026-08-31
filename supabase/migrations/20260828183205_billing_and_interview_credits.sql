create table public.owner_billing (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  plan_key text not null check (plan_key in ('small', 'medium', 'pro', 'ultra')),
  status text not null default 'pending' check (status in ('pending', 'active', 'suspended', 'cancelled', 'expired', 'past_due')),
  paypal_subscription_id text unique,
  paypal_plan_id text,
  paypal_payer_id text,
  monthly_interview_limit integer not null check (monthly_interview_limit = -1 or monthly_interview_limit >= 0),
  monthly_interviews_used integer not null default 0 check (monthly_interviews_used >= 0),
  monthly_period_start date not null default date_trunc('month', current_date)::date,
  monthly_period_end date not null default (date_trunc('month', current_date) + interval '1 month')::date,
  prepaid_interviews integer not null default 0 check (prepaid_interviews >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.paypal_orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  paypal_order_id text not null unique,
  paypal_capture_id text,
  add_on_key text not null check (add_on_key in ('pack_10', 'pack_25', 'pack_50', 'pack_100')),
  interview_credits integer not null check (interview_credits > 0),
  amount numeric(10, 2) not null check (amount > 0),
  currency text not null default 'USD' check (char_length(currency) = 3),
  status text not null default 'created' check (status in ('created', 'completed', 'failed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.owner_billing enable row level security;
alter table public.paypal_orders enable row level security;
grant select on public.owner_billing to authenticated;
grant select on public.paypal_orders to authenticated;
create policy "owners see their billing" on public.owner_billing for select to authenticated using (user_id = (select auth.uid()));
create policy "owners see their PayPal orders" on public.paypal_orders for select to authenticated using (user_id = (select auth.uid()));
create trigger owner_billing_touch before update on public.owner_billing for each row execute procedure public.touch_updated_at();
create trigger paypal_orders_touch before update on public.paypal_orders for each row execute procedure public.touch_updated_at();

drop policy if exists "owners create servers" on public.servers;
create policy "subscribed owners create servers" on public.servers for insert to authenticated with check (owner_id = (select auth.uid()) and exists (select 1 from public.owner_billing b where b.user_id = (select auth.uid()) and b.status = 'active'));

create or replace function public.submit_interview(p_session_id uuid, p_transcript jsonb default '[]'::jsonb)
returns jsonb language plpgsql security definer set search_path = public
as $$
declare
  v_session record;
  v_billing record;
  v_credit_source text;
  v_remaining integer;
begin
  if (select auth.uid()) is null then raise exception 'You must be signed in.' using errcode = 'P0001'; end if;
  select i.id, i.status, i.application_id, a.applicant_user_id, s.owner_id into v_session
    from public.interview_sessions i join public.applications a on a.id = i.application_id join public.servers s on s.id = i.server_id
   where i.id = p_session_id for update of i;
  if not found or v_session.applicant_user_id <> (select auth.uid()) then raise exception 'Interview session not found.' using errcode = 'P0001'; end if;
  if v_session.status = 'completed' then return jsonb_build_object('ok', true, 'already_submitted', true); end if;
  select * into v_billing from public.owner_billing where user_id = v_session.owner_id for update;
  if not found or v_billing.status <> 'active' then raise exception 'The server subscription is not active.' using errcode = 'P0001'; end if;
  if current_date >= v_billing.monthly_period_end then
    update public.owner_billing set monthly_interviews_used = 0, monthly_period_start = date_trunc('month', current_date)::date, monthly_period_end = (date_trunc('month', current_date) + interval '1 month')::date where id = v_billing.id returning * into v_billing;
  end if;
  if v_billing.monthly_interview_limit = -1 then
    v_credit_source := 'monthly'; v_remaining := -1;
  elsif v_billing.monthly_interviews_used < v_billing.monthly_interview_limit then
    update public.owner_billing set monthly_interviews_used = monthly_interviews_used + 1 where id = v_billing.id returning monthly_interviews_used into v_billing.monthly_interviews_used;
    v_credit_source := 'monthly'; v_remaining := v_billing.monthly_interview_limit - v_billing.monthly_interviews_used;
  elsif v_billing.prepaid_interviews > 0 then
    update public.owner_billing set prepaid_interviews = prepaid_interviews - 1 where id = v_billing.id returning prepaid_interviews into v_billing.prepaid_interviews;
    v_credit_source := 'prepaid'; v_remaining := v_billing.prepaid_interviews;
  else raise exception 'No interview credits remaining.' using errcode = 'P0001'; end if;
  update public.interview_sessions set status = 'completed', completed_at = coalesce(completed_at, now()), transcript = coalesce(p_transcript, '[]'::jsonb) where id = p_session_id;
  update public.applications set status = 'under_review' where id = v_session.application_id;
  return jsonb_build_object('ok', true, 'credit_source', v_credit_source, 'remaining', v_remaining);
end;
$$;
revoke all on function public.submit_interview(uuid, jsonb) from public;
grant execute on function public.submit_interview(uuid, jsonb) to authenticated;;
