-- Keep the service role out of auth.users. Identity is verified with the Auth
-- server API and registered here by server-only application code.
create table public.affiliate_customers (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text,
  joined_at timestamptz not null
);
alter table public.affiliate_customers enable row level security;
revoke all on public.affiliate_customers from public, anon, authenticated;
grant select,insert,update,delete on public.affiliate_customers to service_role;
create or replace function public.affiliate_attach(p_user uuid,p_code text default null,p_token_hash text default null)
returns boolean language plpgsql security invoker set search_path='' as $$
declare v_user public.affiliate_customers%rowtype; v_partner public.affiliate_partners%rowtype; v_visit public.affiliate_visits%rowtype;
begin
  select * into v_user from public.affiliate_customers where user_id=p_user for update;
  if not found then return false; end if;
  if exists(select 1 from public.affiliate_referrals where user_id=p_user) then return true; end if;
  if v_user.joined_at < (select launched_at from public.affiliate_program where id)
    or exists(select 1 from public.owner_billing where user_id=p_user and (paypal_subscription_id is not null or status='active'))
    or exists(select 1 from public.paypal_orders where user_id=p_user and status='completed')
    or exists(select 1 from public.affiliate_payments where user_id=p_user) then return false; end if;
  if p_code is not null then
    if v_user.joined_at < now()-interval '30 days' then return false; end if;
    select * into v_partner from public.affiliate_partners where code=p_code and status='approved';
  else
    select * into v_visit from public.affiliate_visits where token_hash=p_token_hash and expires_at>now();
    if not found or v_user.joined_at < v_visit.created_at-interval '5 minutes' then return false; end if;
    select * into v_partner from public.affiliate_partners where id=v_visit.partner_id and status='approved';
  end if;
  if v_partner.id is null or v_partner.user_id=p_user or lower(v_partner.payout_email)=lower(v_user.email) then return false; end if;
  insert into public.affiliate_referrals(partner_id,user_id,source) values(v_partner.id,p_user,case when p_code is null then 'link' else 'code' end);
  return true;
end $$;

create or replace function public.affiliate_record_payment(p_environment text,p_kind text,p_transaction text,p_user uuid,p_gross bigint,p_base bigint,p_paid_at timestamptz,p_label text,p_subscription text default null,p_payer_email text default null,p_payer_id text default null,p_review boolean default false)
returns uuid language plpgsql security invoker set search_path='' as $$
declare v_ref public.affiliate_referrals%rowtype; v_partner public.affiliate_partners%rowtype; v_id uuid; v_amount bigint:=0;
begin
  perform 1 from public.affiliate_customers where user_id=p_user for update;
  if not found then raise exception 'Customer unavailable'; end if;
  select * into v_ref from public.affiliate_referrals where user_id=p_user and created_at<=p_paid_at;
  if found then
    select * into v_partner from public.affiliate_partners where id=v_ref.partner_id for update;
    if p_environment='live' and v_partner.status='approved' and v_partner.user_id is not null and v_partner.user_id<>p_user
      and (p_payer_email is null or lower(p_payer_email)<>lower(v_partner.payout_email))
      and not exists(select 1 from public.affiliate_customers where user_id=v_partner.user_id and lower(email)=lower(p_payer_email))
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
revoke all on function public.affiliate_attach(uuid,text,text) from public,anon,authenticated;
grant execute on function public.affiliate_attach(uuid,text,text) to service_role;
revoke all on function public.affiliate_record_payment(text,text,text,uuid,bigint,bigint,timestamptz,text,text,text,text,boolean) from public,anon,authenticated;
grant execute on function public.affiliate_record_payment(text,text,text,uuid,bigint,bigint,timestamptz,text,text,text,text,boolean) to service_role;
