grant delete on public.applications to authenticated;

create policy "managers delete decided applications"
  on public.applications for delete to authenticated
  using (
    status in ('approved', 'declined', 'role_assigned')
    and exists (
      select 1 from public.server_members sm
      where sm.server_id = applications.server_id
        and sm.user_id = (select auth.uid())
        and sm.role in ('owner', 'admin', 'reviewer')
    )
  );

create policy "managers delete decided interview recordings"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'interview-recordings'
    and exists (
      select 1
      from public.interview_sessions i
      join public.applications a on a.id = i.application_id
      where i.server_id::text = (storage.foldername(name))[1]
        and i.id::text = (storage.foldername(name))[2]
        and a.status in ('approved', 'declined', 'role_assigned')
        and exists (
          select 1 from public.server_members sm
          where sm.server_id = i.server_id
            and sm.user_id = (select auth.uid())
            and sm.role in ('owner', 'admin', 'reviewer')
        )
    )
  );
