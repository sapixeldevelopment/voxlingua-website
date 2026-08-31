create policy "participants upload interview recordings"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'interview-recordings'
    and exists (
      select 1
      from public.interview_sessions i
      join public.applications a on a.id = i.application_id
      where i.server_id::text = (storage.foldername(name))[1]
        and i.id::text = (storage.foldername(name))[2]
        and (
          a.applicant_user_id = (select auth.uid())
          or exists (
            select 1 from public.server_members sm
            where sm.server_id = i.server_id
              and sm.user_id = (select auth.uid())
              and sm.role in ('owner', 'admin', 'reviewer')
          )
        )
    )
  );

create policy "participants read interview recordings"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'interview-recordings'
    and exists (
      select 1
      from public.interview_sessions i
      join public.applications a on a.id = i.application_id
      where i.server_id::text = (storage.foldername(name))[1]
        and i.id::text = (storage.foldername(name))[2]
        and (
          a.applicant_user_id = (select auth.uid())
          or exists (
            select 1 from public.server_members sm
            where sm.server_id = i.server_id
              and sm.user_id = (select auth.uid())
              and sm.role in ('owner', 'admin', 'reviewer')
          )
        )
    )
  );

create policy "participants update interview recordings"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'interview-recordings'
    and exists (
      select 1
      from public.interview_sessions i
      join public.applications a on a.id = i.application_id
      where i.server_id::text = (storage.foldername(name))[1]
        and i.id::text = (storage.foldername(name))[2]
        and a.applicant_user_id = (select auth.uid())
    )
  )
  with check (bucket_id = 'interview-recordings');
