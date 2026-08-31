create or replace function public.complete_prepaid_order(p_order_id uuid, p_capture_id text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order record;
  v_billing record;
  v_balance integer;
begin
  select * into v_order from public.paypal_orders where id = p_order_id for update;
  if not found then raise exception 'Prepaid order not found.'; end if;
  if v_order.status = 'completed' then
    return jsonb_build_object('ok', true, 'credits', v_order.interview_credits, 'already_completed', true);
  end if;
  select * into v_billing from public.owner_billing where user_id = v_order.user_id for update;
  if not found then raise exception 'Billing record not found.'; end if;
  update public.owner_billing
     set prepaid_interviews = prepaid_interviews + v_order.interview_credits
   where user_id = v_order.user_id
  returning prepaid_interviews into v_balance;
  update public.paypal_orders
     set status = 'completed', paypal_capture_id = p_capture_id
   where id = p_order_id;
  return jsonb_build_object('ok', true, 'credits', v_order.interview_credits, 'balance', v_balance);
end;
$$;

revoke all on function public.complete_prepaid_order(uuid, text) from public;
revoke all on function public.complete_prepaid_order(uuid, text) from anon, authenticated;
grant execute on function public.complete_prepaid_order(uuid, text) to service_role;
