-- Guided Voice is an independent entitlement. Existing sessions stay Realtime.
alter table public.owner_billing drop constraint owner_billing_plan_key_check;
alter table public.owner_billing add constraint owner_billing_plan_key_check
 check (plan_key in ('starter','small','medium','pro','ultra','free','flexi','flow','boost','scale','network'));
alter table public.interview_sessions add column interview_mode text not null default 'realtime'
 check (interview_mode in ('realtime','guided'));
alter table public.interview_sessions add column guided_questions jsonb;
-- Session lifecycle and mode changes are only made by trusted API handlers.
revoke insert, update on public.interview_sessions from authenticated;

insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('guided-question-audio','guided-question-audio',false,3000000,array['audio/mpeg'])
on conflict (id) do nothing;

-- Prevent the legacy RPC being used to store transcripts on Guided Voice.
do $$
declare definition text;
begin
 select pg_get_functiondef('public.submit_interview(uuid,jsonb)'::regprocedure) into definition;
 definition := replace(definition, '  if p_transcript is null', E'  if exists (select 1 from public.interview_sessions where id = p_session_id and interview_mode = ''guided'') then\n    raise exception ''Use Guided Voice submission.'';\n  end if;\n  if p_transcript is null');
 execute definition;
end $$;

create function public.submit_guided_interview(p_session_id uuid, p_user_id uuid)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare s record; b record; uploaded timestamptz; bytes bigint;
begin
 select i.*, a.applicant_user_id, v.owner_id, v.is_active into s
 from public.interview_sessions i join public.applications a on a.id=i.application_id
 join public.servers v on v.id=i.server_id where i.id=p_session_id for update of i;
 if not found or p_user_id is null or s.applicant_user_id <> p_user_id or s.interview_mode <> 'guided' then
   raise exception 'Interview not found.';
 end if;
 if s.status='completed' then return jsonb_build_object('ok',true,'already_submitted',true); end if;
 if s.status <> 'in_progress' or s.started_at is null or s.guided_questions is null or not s.is_active then
   raise exception 'Interview is not ready.';
 end if;
 select updated_at,(metadata->>'size')::bigint into uploaded,bytes from storage.objects
 where bucket_id='interview-recordings' and name=s.recording_path
 and name=s.server_id::text || '/' || s.id::text || '/recording.webm';
 if uploaded is null or bytes < 1000 or bytes > 15000000 or uploaded < s.started_at
 or extract(epoch from uploaded-s.started_at) > 1320 then
   raise exception 'A valid recording must be uploaded within the interview time limit.';
 end if;
 select * into b from public.owner_billing where user_id=s.owner_id for update;
 if not found or b.plan_key not in ('free','flexi','flow','boost','scale','network')
 or not (b.status='active' or (b.status='suspended' and current_date < b.subscription_period_end)) then
   raise exception 'Guided Voice plan is not active.';
 end if;
 if current_date >= b.monthly_period_end then
   update public.owner_billing set monthly_interviews_used=0,
    monthly_period_start=date_trunc('month',current_date)::date,
    monthly_period_end=(date_trunc('month',current_date)+interval '1 month')::date
    where id=b.id returning * into b;
 end if;
 if b.monthly_interviews_used >= b.monthly_interview_limit then raise exception 'No interview credits remaining.'; end if;
 update public.owner_billing set monthly_interviews_used=monthly_interviews_used+1 where id=b.id;
 update public.interview_sessions set status='completed', completed_at=now(),transcript='[]'::jsonb,summary=null,score=null where id=s.id;
 update public.applications set status='under_review' where id=s.application_id;
 return jsonb_build_object('ok',true);
end $$;
revoke all on function public.submit_guided_interview(uuid,uuid) from public,anon,authenticated;
grant execute on function public.submit_guided_interview(uuid,uuid) to service_role;

-- Immutable completed recordings; applicants can upload only their two known files.
drop policy if exists "participants upload interview recordings" on storage.objects;
create policy "participants upload interview recordings" on storage.objects for insert to authenticated
with check (bucket_id='interview-recordings' and exists (
 select 1 from public.interview_sessions i join public.applications a on a.id=i.application_id
 where a.applicant_user_id=(select auth.uid()) and i.status in ('created','in_progress')
 and (storage.objects.name=i.server_id::text||'/'||i.id::text||'/recording.webm'
 or (i.interview_mode='realtime' and storage.objects.name=i.server_id::text||'/'||i.id::text||'/voice-sample.wav'))));
drop policy if exists "participants update interview recordings" on storage.objects;
create policy "participants update interview recordings" on storage.objects for update to authenticated
using (bucket_id='interview-recordings' and exists (
 select 1 from public.interview_sessions i join public.applications a on a.id=i.application_id
 where a.applicant_user_id=(select auth.uid()) and i.status in ('created','in_progress')
 and storage.objects.name in (i.server_id::text||'/'||i.id::text||'/recording.webm',i.server_id::text||'/'||i.id::text||'/voice-sample.wav')))
with check (bucket_id='interview-recordings' and exists (
 select 1 from public.interview_sessions i join public.applications a on a.id=i.application_id
 where a.applicant_user_id=(select auth.uid()) and i.status in ('created','in_progress')
 and storage.objects.name in (i.server_id::text||'/'||i.id::text||'/recording.webm',i.server_id::text||'/'||i.id::text||'/voice-sample.wav')));
