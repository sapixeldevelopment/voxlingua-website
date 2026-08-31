-- Keep paused portals available through the paid period, while preventing
-- access after that period ends. Configuration is locked in the UI/API while
-- the billing row remains suspended.
create or replace function private.has_active_subscription(p_owner_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.owner_billing b
    where b.user_id = p_owner_id
      and (
        b.status = 'active'
        or (b.status = 'suspended' and current_date < b.monthly_period_end)
      )
  );
$$;

revoke all on function private.has_active_subscription(uuid) from public;
grant execute on function private.has_active_subscription(uuid) to anon, authenticated;

-- Only an active subscriber can mutate portal configuration. Read access to
-- existing reviews and configuration remains separate from this write gate.
create or replace function private.can_configure_server(p_server_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.servers s
    join public.server_members sm on sm.server_id = s.id
    join public.owner_billing b on b.user_id = s.owner_id
    where s.id = p_server_id
      and sm.user_id = (select auth.uid())
      and sm.role in ('owner', 'admin')
      and b.status = 'active'
  );
$$;

revoke all on function private.can_configure_server(uuid) from public;
grant execute on function private.can_configure_server(uuid) to authenticated;

drop policy if exists "owners update servers" on public.servers;
create policy "owners update servers"
  on public.servers for update
  to authenticated
  using (
    owner_id = (select auth.uid())
    and private.can_configure_server(id)
  )
  with check (
    owner_id = (select auth.uid())
    and private.can_configure_server(id)
  );

drop policy if exists "owners manage application fields" on public.application_fields;
drop policy if exists "owners insert application fields" on public.application_fields;
drop policy if exists "owners update application fields" on public.application_fields;
drop policy if exists "owners delete application fields" on public.application_fields;

create policy "owners insert application fields"
  on public.application_fields for insert
  to authenticated
  with check (private.can_configure_server(server_id));

create policy "owners update application fields"
  on public.application_fields for update
  to authenticated
  using (private.can_configure_server(server_id))
  with check (private.can_configure_server(server_id));

create policy "owners delete application fields"
  on public.application_fields for delete
  to authenticated
  using (private.can_configure_server(server_id));

drop policy if exists "managers create questions" on public.question_bank;
drop policy if exists "managers update questions" on public.question_bank;
drop policy if exists "managers delete questions" on public.question_bank;

create policy "managers create questions"
  on public.question_bank for insert
  to authenticated
  with check (
    created_by = (select auth.uid())
    and private.can_configure_server(server_id)
  );

create policy "managers update questions"
  on public.question_bank for update
  to authenticated
  using (private.can_configure_server(server_id))
  with check (private.can_configure_server(server_id));

create policy "managers delete questions"
  on public.question_bank for delete
  to authenticated
  using (private.can_configure_server(server_id));

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
