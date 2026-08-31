-- Applicants need draft access while interviewing, but owner teams must not
-- receive or inspect an application, interview, or recording until submission.
drop policy if exists "applicants and managers see applications" on public.applications;
create policy "applicants and managers see applications"
  on public.applications
  for select
  to authenticated
  using (
    applicant_user_id = (select auth.uid())
    or (
      status <> 'interviewing'
      and exists (
        select 1
        from public.server_members sm
        where sm.server_id = applications.server_id
          and sm.user_id = (select auth.uid())
          and sm.role in ('owner', 'admin', 'reviewer')
      )
    )
  );

drop policy if exists "participants see interviews" on public.interview_sessions;
create policy "participants see interviews"
  on public.interview_sessions
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.applications a
      where a.id = interview_sessions.application_id
        and a.applicant_user_id = (select auth.uid())
    )
    or (
      status = 'completed'
      and exists (
        select 1
        from public.server_members sm
        where sm.server_id = interview_sessions.server_id
          and sm.user_id = (select auth.uid())
          and sm.role in ('owner', 'admin', 'reviewer')
      )
    )
  );

drop policy if exists "participants read interview recordings" on storage.objects;
create policy "participants read interview recordings"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'interview-recordings'
    and exists (
      select 1
      from public.interview_sessions i
      join public.applications a on a.id = i.application_id
      where i.server_id::text = (storage.foldername(objects.name))[1]
        and i.id::text = (storage.foldername(objects.name))[2]
        and (
          a.applicant_user_id = (select auth.uid())
          or (
            i.status = 'completed'
            and exists (
              select 1
              from public.server_members sm
              where sm.server_id = i.server_id
                and sm.user_id = (select auth.uid())
                and sm.role in ('owner', 'admin', 'reviewer')
            )
          )
        )
    )
  );
