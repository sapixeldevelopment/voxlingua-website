set local lock_timeout = '5s';

alter table public.interview_sessions
  add column restart_count integer not null default 0;

alter table public.interview_sessions
  add constraint interview_sessions_restart_count_check
  check (restart_count between 0 and 1);

create or replace function private.enforce_question_limit()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_count integer;
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(new.server_id::text, 0));

  select pg_catalog.count(*)::integer
    into v_count
    from public.question_bank
   where server_id = new.server_id;

  if v_count >= 8 then
    raise exception 'Each portal can configure up to 8 interview questions.' using errcode = 'P0001';
  end if;

  return new;
end;
$$;

revoke all on function private.enforce_question_limit() from public;

drop trigger if exists enforce_question_limit on public.question_bank;
create trigger enforce_question_limit
  before insert on public.question_bank
  for each row execute function private.enforce_question_limit();

create or replace function public.reset_interview_attempt(
  p_session_id uuid,
  p_user_id uuid
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_session record;
begin
  if p_user_id is null then
    raise exception 'Interview not found.' using errcode = 'P0001';
  end if;

  select i.id, i.application_id, i.status, i.recording_path, i.restart_count,
         a.applicant_user_id
    into v_session
    from public.interview_sessions i
    join public.applications a on a.id = i.application_id
   where i.id = p_session_id
   for update of i;

  if not found or v_session.applicant_user_id <> p_user_id then
    raise exception 'Interview not found.' using errcode = 'P0001';
  end if;
  if v_session.status not in ('created', 'in_progress') then
    raise exception 'A submitted interview cannot be restarted.' using errcode = 'P0001';
  end if;
  if v_session.restart_count >= 1 then
    raise exception 'This interview has already used its one allowed restart.' using errcode = 'P0001';
  end if;

  update public.interview_sessions
     set status = 'created',
         transcript = '[]'::jsonb,
         summary = null,
         score = null,
         started_at = null,
         completed_at = null,
         recording_path = null,
         recording_deleted_at = null,
         realtime_call_id = null,
         restart_count = restart_count + 1,
         updated_at = pg_catalog.now()
   where id = p_session_id;

  update public.applications
     set status = 'interviewing'
   where id = v_session.application_id;

  return pg_catalog.jsonb_build_object(
    'ok', true,
    'recording_path', v_session.recording_path,
    'restart_count', v_session.restart_count + 1,
    'restarts_remaining', 0
  );
end;
$$;

revoke all on function public.reset_interview_attempt(uuid, uuid) from public;
revoke execute on function public.reset_interview_attempt(uuid, uuid) from anon, authenticated;
grant execute on function public.reset_interview_attempt(uuid, uuid) to service_role;

create or replace function public.submit_interview(p_session_id uuid, p_transcript jsonb default '[]'::jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_session record;
  v_billing record;
  v_credit_source text;
  v_remaining integer;
  v_question_count integer;
  v_required_turns integer;
  v_substantive_turns integer;
  v_total_words integer;
  v_total_chars integer;
  v_time_limit_seconds integer;
begin
  if (select auth.uid()) is null then
    raise exception 'You must be signed in.' using errcode = 'P0001';
  end if;
  if pg_catalog.jsonb_typeof(p_transcript) <> 'array'
     or pg_catalog.jsonb_array_length(p_transcript) > 200
     or pg_catalog.pg_column_size(p_transcript) > 131072
     or exists (
       select 1 from pg_catalog.jsonb_array_elements(p_transcript) item
       where pg_catalog.jsonb_typeof(item) <> 'object'
          or item->>'role' not in ('user', 'assistant')
          or item->>'text' is null
          or pg_catalog.char_length(item->>'text') > 4000
     ) then
    raise exception 'The interview transcript is invalid or too large.' using errcode = 'P0001';
  end if;

  select i.id, i.status, i.application_id, i.server_id, i.started_at,
         i.recording_path, i.restart_count, a.applicant_user_id, s.owner_id
    into v_session
    from public.interview_sessions i
    join public.applications a on a.id = i.application_id
    join public.servers s on s.id = i.server_id
   where i.id = p_session_id
   for update of i;

  if not found or v_session.applicant_user_id <> (select auth.uid()) then
    raise exception 'Interview session not found.' using errcode = 'P0001';
  end if;
  if v_session.status = 'completed' then
    return pg_catalog.jsonb_build_object('ok', true, 'already_submitted', true);
  end if;
  if v_session.status not in ('created', 'in_progress') then
    raise exception 'This interview cannot be submitted.' using errcode = 'P0001';
  end if;
  if v_session.recording_path is null then
    raise exception 'The interview recording must finish uploading before submission.' using errcode = 'P0001';
  end if;
  if v_session.started_at is null then
    raise exception 'The interview was not started correctly.' using errcode = 'P0001';
  end if;

  select pg_catalog.count(*)::integer
    into v_question_count
    from public.question_bank
   where server_id = v_session.server_id and is_active = true;
  v_question_count := pg_catalog.greatest(1, pg_catalog.least(8, coalesce(nullif(v_question_count, 0), 3)));
  v_required_turns := pg_catalog.greatest(1, pg_catalog.ceil(v_question_count * 0.6)::integer);
  v_time_limit_seconds := 1200;

  select
    pg_catalog.count(*) filter (
      where pg_catalog.char_length(pg_catalog.btrim(item->>'text')) >= 12
        and pg_catalog.cardinality(pg_catalog.regexp_split_to_array(pg_catalog.btrim(item->>'text'), E'\\s+')) >= 3
        and (
          select pg_catalog.count(distinct pg_catalog.lower(word))
          from pg_catalog.regexp_split_to_table(
            pg_catalog.regexp_replace(item->>'text', '[^[:alnum:]''-]+', ' ', 'g'),
            E'\\s+'
          ) as words(word)
          where pg_catalog.char_length(word) >= 2
            and pg_catalog.lower(word) not in ('um', 'uh', 'erm', 'hmm', 'ah', 'like', 'okay', 'ok', 'yeah', 'yes', 'no')
        ) >= 2
    )::integer,
    coalesce(pg_catalog.sum(pg_catalog.cardinality(pg_catalog.regexp_split_to_array(pg_catalog.btrim(item->>'text'), E'\\s+'))), 0)::integer,
    coalesce(pg_catalog.sum(pg_catalog.char_length(pg_catalog.regexp_replace(item->>'text', E'\\s', '', 'g'))), 0)::integer
    into v_substantive_turns, v_total_words, v_total_chars
    from pg_catalog.jsonb_array_elements(p_transcript) item
   where item->>'role' = 'user'
     and pg_catalog.btrim(coalesce(item->>'text', '')) <> '';

  if v_substantive_turns < v_required_turns
     or v_total_words < pg_catalog.greatest(12, v_question_count * 4)
     or v_total_chars < pg_catalog.greatest(60, v_question_count * 18) then
    raise exception 'Please give clear spoken answers to the interview questions before submitting.' using errcode = 'P0001';
  end if;
  if pg_catalog.date_part('epoch', pg_catalog.now() - v_session.started_at) > v_time_limit_seconds + 120 then
    if v_session.restart_count < 1 then
      raise exception 'This interview attempt exceeded its time limit. Use your one allowed restart.' using errcode = 'P0001';
    end if;
    raise exception 'This interview attempt exceeded its time limit and cannot be restarted again.' using errcode = 'P0001';
  end if;

  select * into v_billing
    from public.owner_billing
   where user_id = v_session.owner_id
   for update;

  if not found or not (
    v_billing.status = 'active'
    or (v_billing.status = 'suspended' and current_date < v_billing.monthly_period_end)
  ) then
    raise exception 'The server subscription is not active.' using errcode = 'P0001';
  end if;

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
    update public.owner_billing
       set monthly_interviews_used = monthly_interviews_used + 1
     where id = v_billing.id
    returning monthly_interviews_used into v_billing.monthly_interviews_used;
    v_credit_source := 'monthly';
    v_remaining := v_billing.monthly_interview_limit - v_billing.monthly_interviews_used;
  elsif v_billing.prepaid_interviews > 0 then
    update public.owner_billing
       set prepaid_interviews = prepaid_interviews - 1
     where id = v_billing.id
    returning prepaid_interviews into v_billing.prepaid_interviews;
    v_credit_source := 'prepaid'; v_remaining := v_billing.prepaid_interviews;
  else
    raise exception 'No interview credits remaining.' using errcode = 'P0001';
  end if;

  update public.interview_sessions
     set status = 'completed', completed_at = coalesce(completed_at, pg_catalog.now()), transcript = p_transcript
   where id = p_session_id;
  update public.applications set status = 'under_review' where id = v_session.application_id;

  return pg_catalog.jsonb_build_object('ok', true, 'credit_source', v_credit_source, 'remaining', v_remaining);
end;
$$;

revoke all on function public.submit_interview(uuid, jsonb) from public;
revoke execute on function public.submit_interview(uuid, jsonb) from anon;
grant execute on function public.submit_interview(uuid, jsonb) to authenticated;
