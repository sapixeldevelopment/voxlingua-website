-- Financial data is server-only. All functions are INVOKER and service_role-only.
create table public.affiliate_program (
  id boolean primary key default true check (id),
  launched_at timestamptz not null default now()
);
insert into public.affiliate_program(id) values (true);
create table public.affiliate_partners (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references auth.users(id) on delete set null,
  code text not null unique check (code ~ '^[a-z0-9]{12}$'),
  display_name text not null check (length(display_name) between 2 and 80),
  promotion text not null check (length(promotion) between 20 and 1500),
  country text not null check (country ~ '^[A-Z]{2}$'),
  payout_email text not null check (length(payout_email) between 3 and 254),
  payout_verified boolean not null default false,
  payout_updated_at timestamptz not null default now(),
  status text not null default 'pending' check (status in ('pending','approved','suspended','rejected')),
  rate_bps integer not null default 1500 check (rate_bps = 1500),
  terms_version text not null check (terms_version = '2026-09-02'),
  created_at timestamptz not null default now()
);
create table public.affiliate_visits (
  token_hash text primary key check (token_hash ~ '^[a-f0-9]{64}$'),
  partner_id uuid not null references public.affiliate_partners(id),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '30 days')
);
create index affiliate_visits_expiry on public.affiliate_visits(expires_at);
create index affiliate_visits_partner on public.affiliate_visits(partner_id);
create table public.affiliate_referrals (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.affiliate_partners(id),
  user_id uuid unique references auth.users(id) on delete set null,
  rate_bps integer not null default 1500 check (rate_bps = 1500),
  source text not null check (source in ('link','code')),
  created_at timestamptz not null default now()
);
create index affiliate_referrals_partner on public.affiliate_referrals(partner_id,created_at);
create table public.affiliate_payments (
  id uuid primary key default gen_random_uuid(),
  environment text not null check (environment in ('live','sandbox')),
  kind text not null check (kind in ('sale','capture')),
  transaction_id text not null check (length(transaction_id) between 1 and 100),
  subscription_id text,
  user_id uuid references auth.users(id) on delete set null,
  referral_id uuid references public.affiliate_referrals(id),
  gross_cents bigint not null check (gross_cents between 1 and 100000000),
  base_cents bigint not null check (base_cents between 0 and gross_cents),
  refunded_cents bigint not null default 0 check (refunded_cents between 0 and gross_cents),
  commission_cents bigint not null default 0 check (commission_cents >= 0),
  reversed_commission_cents bigint not null default 0,
  review_required boolean not null default false,
  currency text not null check (currency = 'USD'),
  label text not null check (length(label) <= 100),
  paid_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique(environment,kind,transaction_id),
  check (reversed_commission_cents between 0 and commission_cents)
);
create index affiliate_payments_user on public.affiliate_payments(user_id);
create index affiliate_payments_referral on public.affiliate_payments(referral_id);
create table public.affiliate_payouts (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.affiliate_partners(id),
  amount_cents bigint not null check (amount_cents >= 2500),
  payout_email text not null,
  currency text not null default 'USD' check (currency = 'USD'),
  status text not null default 'reserved' check (status in ('reserved','paid','cancelled')),
  payment_reference text unique,
  created_at timestamptz not null default now(),
  paid_at timestamptz
);
create unique index affiliate_one_open_payout on public.affiliate_payouts(partner_id) where status='reserved';
create index affiliate_payouts_partner on public.affiliate_payouts(partner_id,created_at);
create table public.affiliate_ledger (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.affiliate_partners(id),
  payment_id uuid not null references public.affiliate_payments(id),
  entry_key text not null unique,
  amount_cents bigint not null check (amount_cents <> 0),
  available_at timestamptz not null,
  payout_id uuid references public.affiliate_payouts(id),
  created_at timestamptz not null default now()
);
create index affiliate_ledger_balance on public.affiliate_ledger(partner_id,available_at) where payout_id is null;
create index affiliate_ledger_payment on public.affiliate_ledger(payment_id);
create index affiliate_ledger_payout on public.affiliate_ledger(payout_id);
create table public.affiliate_refunds (
  refund_key text primary key,
  payment_id uuid not null references public.affiliate_payments(id),
  amount_cents bigint not null check (amount_cents >= 0),
  created_at timestamptz not null default now()
);
create index affiliate_refunds_payment on public.affiliate_refunds(payment_id);
create table public.affiliate_events (
  event_id text primary key,
  payload jsonb not null,
  attempts integer not null default 0,
  processed_at timestamptz,
  last_error text,
  next_attempt_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index affiliate_events_retry on public.affiliate_events(next_attempt_at) where processed_at is null;
create table public.affiliate_audit (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users(id) on delete set null,
  partner_id uuid references public.affiliate_partners(id),
  action text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index affiliate_audit_partner on public.affiliate_audit(partner_id,created_at);
create index affiliate_audit_actor on public.affiliate_audit(actor_id);

-- API routes enforce authenticated ownership/admin access and return minimal projections.
do $$ declare t text; begin
  foreach t in array array['affiliate_program','affiliate_partners','affiliate_visits','affiliate_referrals','affiliate_payments','affiliate_payouts','affiliate_ledger','affiliate_refunds','affiliate_events','affiliate_audit'] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('revoke all on public.%I from public, anon, authenticated',t);
    execute format('grant select, insert, update, delete on public.%I to service_role',t);
  end loop;
end $$;

create function public.affiliate_attach(p_user uuid, p_code text default null, p_token_hash text default null)
returns boolean language plpgsql security invoker set search_path='' as $$
declare v_user auth.users%rowtype; v_partner public.affiliate_partners%rowtype; v_visit public.affiliate_visits%rowtype;
begin
  select * into v_user from auth.users where id=p_user for update;
  if not found then return false; end if;
  if exists(select 1 from public.affiliate_referrals where user_id=p_user) then return true; end if;
  if v_user.created_at < (select launched_at from public.affiliate_program where id)
    or exists(select 1 from public.owner_billing where user_id=p_user and (paypal_subscription_id is not null or status='active'))
    or exists(select 1 from public.paypal_orders where user_id=p_user and status='completed')
    or exists(select 1 from public.affiliate_payments where user_id=p_user) then return false; end if;
  if p_code is not null then
    if v_user.created_at < now()-interval '30 days' then return false; end if;
    select * into v_partner from public.affiliate_partners where code=p_code and status='approved';
  else
    select * into v_visit from public.affiliate_visits where token_hash=p_token_hash and expires_at>now();
    if not found or v_user.created_at < v_visit.created_at-interval '5 minutes' then return false; end if;
    select * into v_partner from public.affiliate_partners where id=v_visit.partner_id and status='approved';
  end if;
  if v_partner.id is null or v_partner.user_id=p_user or lower(v_partner.payout_email)=lower(v_user.email) then return false; end if;
  insert into public.affiliate_referrals(partner_id,user_id,source) values(v_partner.id,p_user,case when p_code is null then 'link' else 'code' end);
  return true;
end $$;

create function public.affiliate_record_payment(p_environment text,p_kind text,p_transaction text,p_user uuid,p_gross bigint,p_base bigint,p_paid_at timestamptz,p_label text,p_subscription text default null,p_payer_email text default null,p_payer_id text default null,p_review boolean default false)
returns uuid language plpgsql security invoker set search_path='' as $$
declare v_ref public.affiliate_referrals%rowtype; v_partner public.affiliate_partners%rowtype; v_id uuid; v_amount bigint:=0;
begin
  -- Shared lock order: customer -> partner -> payment. Duplicates cannot mint money.
  perform 1 from auth.users where id=p_user for update;
  if not found then raise exception 'Customer unavailable'; end if;
  select * into v_ref from public.affiliate_referrals where user_id=p_user and created_at<=p_paid_at;
  if found then
    select * into v_partner from public.affiliate_partners where id=v_ref.partner_id for update;
    if p_environment='live' and v_partner.status='approved' and v_partner.user_id is not null and v_partner.user_id<>p_user
      and (p_payer_email is null or lower(p_payer_email)<>lower(v_partner.payout_email))
      and not exists(select 1 from auth.users where id=v_partner.user_id and lower(email)=lower(p_payer_email))
      and not exists(select 1 from public.owner_billing where user_id=v_partner.user_id and paypal_payer_id=p_payer_id) then
      v_amount:=round(p_base::numeric*v_ref.rate_bps/10000)::bigint;
    end if;
  end if;
  select id into v_id from public.affiliate_payments where environment=p_environment and kind=p_kind and transaction_id=p_transaction;
  if found then
    if p_review then update public.affiliate_payments set review_required=true where id=v_id; end if;
    return v_id;
  end if;
  insert into public.affiliate_payments(environment,kind,transaction_id,user_id,referral_id,gross_cents,base_cents,commission_cents,currency,label,paid_at,subscription_id,review_required)
  values(p_environment,p_kind,p_transaction,p_user,v_ref.id,p_gross,p_base,v_amount,'USD',p_label,p_paid_at,p_subscription,p_review)
  returning id into v_id;
  if v_amount>0 then
    insert into public.affiliate_ledger(partner_id,payment_id,entry_key,amount_cents,available_at)
    values(v_ref.partner_id,v_id,'payment:'||v_id,v_amount,greatest(p_paid_at,now())+interval '30 days');
  end if;
  return v_id;
end $$;

create function public.affiliate_record_refund(p_environment text,p_kind text,p_transaction text,p_refund text,p_cents bigint,p_full boolean default false)
returns void language plpgsql security invoker set search_path='' as $$
declare v_pay public.affiliate_payments%rowtype; v_partner uuid; v_total bigint; v_reverse bigint; v_key text;
begin
  select p.* into v_pay from public.affiliate_payments p where environment=p_environment and kind=p_kind and transaction_id=p_transaction;
  if not found then raise exception 'Payment not yet recorded'; end if;
  select partner_id into v_partner from public.affiliate_referrals where id=v_pay.referral_id;
  perform 1 from public.affiliate_partners where id=v_partner for update;
  select * into v_pay from public.affiliate_payments where id=v_pay.id for update;
  v_key:=p_environment||':'||p_kind||':'||p_refund;
  if exists(select 1 from public.affiliate_refunds where refund_key=v_key) then return; end if;
  if p_cents<0 then raise exception 'Invalid refund'; end if;
  insert into public.affiliate_refunds(refund_key,payment_id,amount_cents) values(v_key,v_pay.id,p_cents);
  v_total:=case when p_full then v_pay.gross_cents else least(v_pay.gross_cents,v_pay.refunded_cents+p_cents) end;
  v_reverse:=round(v_pay.commission_cents::numeric*v_total/v_pay.gross_cents)::bigint;
  if v_reverse>v_pay.reversed_commission_cents then
    insert into public.affiliate_ledger(partner_id,payment_id,entry_key,amount_cents,available_at)
    values(v_partner,v_pay.id,'refund:'||v_key,-(v_reverse-v_pay.reversed_commission_cents),now());
  end if;
  update public.affiliate_payments set refunded_cents=v_total,reversed_commission_cents=v_reverse where id=v_pay.id;
end $$;

create function public.affiliate_admin_action(p_actor uuid,p_partner uuid,p_action text,p_note text,p_payout uuid default null,p_reference text default null)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare v_partner public.affiliate_partners%rowtype; v_payout public.affiliate_payouts%rowtype; v_balance bigint; v_id uuid;
begin
  if not exists(select 1 from public.platform_staff where user_id=p_actor and is_active and role='admin') then raise exception 'Admin required'; end if;
  if length(trim(p_note))<10 or length(p_note)>1000 then raise exception 'An audit note is required'; end if;
  select * into v_partner from public.affiliate_partners where id=p_partner for update;
  if not found then raise exception 'Partner unavailable'; end if;
  if p_action='review_refunds' then
    if exists(select 1 from public.affiliate_payments p join public.affiliate_referrals r on r.id=p.referral_id where r.partner_id=p_partner and p.review_required and p.refunded_cents=0) then raise exception 'Replay the missing verified refund events first'; end if;
    update public.affiliate_payments p set review_required=false from public.affiliate_referrals r where p.referral_id=r.id and r.partner_id=p_partner and p.review_required;
  elsif p_action in ('approve','suspend','reject','verify_payout') then
    if p_action='verify_payout' then
      update public.affiliate_partners set payout_verified=true where id=p_partner;
    else
      update public.affiliate_partners set status=case p_action when 'approve' then 'approved' when 'suspend' then 'suspended' else 'rejected' end where id=p_partner;
    end if;
  elsif p_action='reserve' then
    if v_partner.status<>'approved' or not v_partner.payout_verified or v_partner.user_id is null then raise exception 'Approve partner and verify payout details first'; end if;
    if v_partner.payout_updated_at>now()-interval '48 hours' then raise exception 'Payout details have a 48-hour security hold'; end if;
    if exists(select 1 from public.affiliate_events where processed_at is null)
      or exists(select 1 from public.affiliate_payments p join public.affiliate_referrals r on r.id=p.referral_id where r.partner_id=p_partner and p.review_required) then raise exception 'Resolve outstanding financial events and refund reviews before payouts'; end if;
    if exists(select 1 from public.affiliate_payouts where partner_id=p_partner and (status='reserved' or (status='paid' and paid_at>=date_trunc('month',now())))) then raise exception 'A payout is already open or was paid this month'; end if;
    select coalesce(sum(amount_cents),0) into v_balance from public.affiliate_ledger where partner_id=p_partner and payout_id is null and available_at<=now();
    if v_balance<2500 then raise exception 'Available balance is below $25'; end if;
    insert into public.affiliate_payouts(partner_id,amount_cents,payout_email) values(p_partner,v_balance,v_partner.payout_email) returning id into v_id;
    update public.affiliate_ledger set payout_id=v_id where partner_id=p_partner and payout_id is null and available_at<=now();
  elsif p_action in ('paid','cancel_payout') then
    select * into v_payout from public.affiliate_payouts where id=p_payout and partner_id=p_partner for update;
    if not found or v_payout.status<>'reserved' then raise exception 'Open payout required'; end if;
    if p_action='paid' then
      if v_partner.status<>'approved' or not v_partner.payout_verified or v_partner.payout_email<>v_payout.payout_email then raise exception 'Payout recipient requires review'; end if;
      if exists(select 1 from public.affiliate_events where processed_at is null)
        or exists(select 1 from public.affiliate_payments p join public.affiliate_referrals r on r.id=p.referral_id where r.partner_id=p_partner and p.review_required) then raise exception 'Resolve outstanding financial events and refund reviews before payouts'; end if;
      if p_reference is null or p_reference !~ '^[A-Za-z0-9-]{8,100}$' then raise exception 'Valid payment receipt reference required'; end if;
      select coalesce(sum(amount_cents),0) into v_balance from public.affiliate_ledger where partner_id=p_partner and payout_id is null and available_at<=now();
      if v_balance<0 then raise exception 'Refund adjustment received: cancel and recalculate this payout before sending'; end if;
      update public.affiliate_payouts set status='paid',paid_at=now(),payment_reference=p_reference where id=p_payout;
    else
      update public.affiliate_ledger set payout_id=null where payout_id=p_payout;
      update public.affiliate_payouts set status='cancelled' where id=p_payout;
    end if;
    v_id:=p_payout;
  else raise exception 'Unknown action'; end if;
  insert into public.affiliate_audit(actor_id,partner_id,action,details) values(p_actor,p_partner,p_action,jsonb_build_object('note',p_note,'payout_id',v_id,'reference',p_reference));
  return jsonb_build_object('ok',true,'payout_id',v_id);
end $$;

create function public.affiliate_update_payout(p_user uuid,p_email text)
returns void language plpgsql security invoker set search_path='' as $$
declare v_id uuid;
begin
  select id into v_id from public.affiliate_partners where user_id=p_user for update;
  if not found then raise exception 'Partner unavailable'; end if;
  if exists(select 1 from public.affiliate_payouts where partner_id=v_id and status='reserved') then raise exception 'Contact support while a payout is being processed'; end if;
  update public.affiliate_partners set payout_email=p_email,payout_verified=false,payout_updated_at=now() where id=v_id;
  insert into public.affiliate_audit(actor_id,partner_id,action) values(p_user,v_id,'payout_details_changed');
end $$;

create function public.affiliate_summary(p_partner uuid)
returns jsonb language sql security invoker set search_path='' as $$
  select jsonb_build_object(
    'referrals',(select count(*) from public.affiliate_referrals where partner_id=p_partner),
    'customers',(select count(distinct p.referral_id) from public.affiliate_payments p join public.affiliate_referrals r on r.id=p.referral_id where r.partner_id=p_partner and p.environment='live' and p.commission_cents>0),
    'pending_cents',coalesce((select sum(amount_cents) from public.affiliate_ledger where partner_id=p_partner and payout_id is null and available_at>now()),0),
    'available_cents',coalesce((select sum(amount_cents) from public.affiliate_ledger where partner_id=p_partner and payout_id is null and available_at<=now()),0),
    'reserved_cents',coalesce((select sum(amount_cents) from public.affiliate_payouts where partner_id=p_partner and status='reserved'),0),
    'paid_cents',coalesce((select sum(amount_cents) from public.affiliate_payouts where partner_id=p_partner and status='paid'),0),
    'referred_revenue_cents',coalesce((select sum(p.gross_cents-p.refunded_cents) from public.affiliate_payments p join public.affiliate_referrals r on r.id=p.referral_id where r.partner_id=p_partner and p.environment='live'),0)
  );
$$;
do $$ declare f record; begin
  for f in select p.oid::regprocedure as signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like 'affiliate_%' loop
    execute format('revoke all on function %s from public, anon, authenticated',f.signature);
    execute format('grant execute on function %s to service_role',f.signature);
  end loop;
end $$;
