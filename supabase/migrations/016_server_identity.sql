-- Let each server brand its player-facing portal with a name and logo.
alter table public.servers
  add column if not exists logo_url text;

-- Logos are intentionally public because players visit the portal before they
-- have authenticated. Writes remain restricted to the server owner.
insert into storage.buckets (
  id,
  name,
  public,
  allowed_mime_types,
  file_size_limit
)
values (
  'server-logos',
  'server-logos',
  true,
  array['image/png', 'image/jpeg', 'image/webp', 'image/gif']::text[],
  2097152
)
on conflict (id) do update
set public = true,
    allowed_mime_types = excluded.allowed_mime_types,
    file_size_limit = excluded.file_size_limit;

drop policy if exists "Owners upload server logos" on storage.objects;
create policy "Owners upload server logos"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'server-logos'
    and exists (
      select 1
      from public.servers s
      where s.id::text = (storage.foldername(name))[1]
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
      where s.id::text = (storage.foldername(name))[1]
        and s.owner_id = (select auth.uid())
    )
  );
