-- Keep one application open for a Discord user after approval. Declined
-- applications remain historical records but may be followed by a new
-- application once the server's configured cooldown has elapsed.
-- Remove only empty, unfinished applications that were incorrectly created
-- after an approval. Completed interviews and application history are kept.
delete from public.applications as duplicate
where duplicate.status in ('pending', 'interviewing', 'under_review', 'role_pending', 'role_failed')
  and exists (
    select 1
    from public.applications as approved
    where approved.server_id = duplicate.server_id
      and approved.applicant_user_id = duplicate.applicant_user_id
      and approved.id <> duplicate.id
      and approved.status in ('approved', 'role_assigned')
  )
  and not exists (
    select 1
    from public.interview_sessions as session
    where session.application_id = duplicate.id
      and (
        session.status = 'completed'
        or session.completed_at is not null
        or session.recording_path is not null
        or jsonb_array_length(coalesce(session.transcript, '[]'::jsonb)) > 0
      )
  );

drop index if exists public.applications_one_active_per_applicant_idx;

create unique index applications_one_active_per_applicant_idx
  on public.applications (server_id, applicant_user_id)
  where status in (
    'pending',
    'interviewing',
    'under_review',
    'approved',
    'role_pending',
    'role_assigned',
    'role_failed'
  );

comment on index public.applications_one_active_per_applicant_idx is
  'Prevents duplicate in-progress or approved applications for one applicant and server.';
