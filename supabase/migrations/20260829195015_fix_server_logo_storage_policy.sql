-- The original logo policy accidentally resolved `name` to public.servers.name
-- inside its EXISTS query. Qualify storage.objects.name so the policy checks
-- the first folder of the uploaded object path (the server id).
drop policy if exists "Owners upload server logos" on storage.objects;
create policy "Owners upload server logos"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'server-logos'
    and exists (
      select 1
      from public.servers s
      where s.id::text = (storage.foldername(storage.objects.name))[1]
        and s.owner_id = (select auth.uid())
    )
  );

drop policy if exists "Owners delete server logos" on storage.objects;
create policy "Owners delete server logos"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'server-logos'
    and exists (
      select 1
      from public.servers s
      where s.id::text = (storage.foldername(storage.objects.name))[1]
        and s.owner_id = (select auth.uid())
    )
  );
