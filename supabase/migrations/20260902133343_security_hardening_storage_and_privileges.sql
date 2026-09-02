-- Applied through Supabase MCP; filename matches the verified migration history.
-- Keep browser roles at the minimum privileges required by the current UI.
-- RLS remains the row-level authorization boundary; grants control which table
-- operations can reach that boundary at all.
revoke all privileges on all tables in schema public from anon;

revoke truncate, references, trigger on all tables in schema public from authenticated;

revoke delete on public.applications, public.interview_sessions, public.owner_feedback, public.servers from authenticated;
revoke insert, update, delete on public.audit_logs, public.owner_billing, public.paypal_orders, public.profiles from authenticated;

-- Upsert needs SELECT + UPDATE, but the resulting path must still belong to the
-- authenticated applicant's exact session. Only the two application-generated
-- filenames are accepted.
drop policy if exists "participants update interview recordings" on storage.objects;
create policy "participants update interview recordings"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'interview-recordings'
    and exists (
      select 1
      from public.interview_sessions i
      join public.applications a on a.id = i.application_id
      where i.server_id::text = (storage.foldername(storage.objects.name))[1]
        and i.id::text = (storage.foldername(storage.objects.name))[2]
        and a.applicant_user_id = (select auth.uid())
    )
  )
  with check (
    bucket_id = 'interview-recordings'
    and exists (
      select 1
      from public.interview_sessions i
      join public.applications a on a.id = i.application_id
      where a.applicant_user_id = (select auth.uid())
        and storage.objects.name in (
          i.server_id::text || '/' || i.id::text || '/recording.webm',
          i.server_id::text || '/' || i.id::text || '/voice-sample.wav'
        )
    )
  );
