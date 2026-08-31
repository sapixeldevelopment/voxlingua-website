create or replace function public.submit_interview(p_session_id uuid, p_transcript jsonb default '[]'::jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
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
  if not found or not (
    v_billing.status = 'active'
    or (v_billing.status = 'suspended' and current_date < v_billing.monthly_period_end)
  ) then raise exception 'The server subscription is not active.' using errcode = 'P0001'; end if;
  if current_date >= v_billing.monthly_period_end then
    update public.owner_billing
       set monthly_interviews_used = 0,
           monthly_period_start = monthly_period_end,
           monthly_period_end = (monthly_period_end + interval '1 month')::date
     where id = v_billing.id
    returning * into v_billing;
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
revoke execute on function public.submit_interview(uuid, jsonb) from anon;
grant execute on function public.submit_interview(uuid, jsonb) to authenticated;
