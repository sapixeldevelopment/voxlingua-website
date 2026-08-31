-- Keep application-field identity server-scoped and database-owned.
-- The UUID primary key is globally unique. The field_key is the stable JSON
-- key used by applications and is unique per server, never across servers.

create or replace function private.assign_application_field_key()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
declare
  base_key text;
  candidate_key text;
  suffix integer := 1;
begin
  -- Serialize key allocation per portal so two simultaneous saves cannot
  -- receive the same generated field key.
  perform pg_advisory_xact_lock(hashtextextended(NEW.server_id::text, 0));

  base_key := lower(btrim(coalesce(NEW.field_key, '')));
  base_key := regexp_replace(base_key, '[^a-z0-9_]+', '_', 'g');
  base_key := regexp_replace(base_key, '^_+|_+$', '', 'g');
  if base_key = '' or base_key !~ '^[a-z]' then
    base_key := 'custom_field';
  end if;
  base_key := left(base_key, 80);
  candidate_key := base_key;

  while exists (
    select 1
      from public.application_fields existing
     where existing.server_id = NEW.server_id
       and existing.field_key = candidate_key
       and existing.id is distinct from NEW.id
  ) loop
    candidate_key := left(base_key, 70) || '_' || suffix::text;
    suffix := suffix + 1;
  end loop;

  NEW.field_key := candidate_key;
  return NEW;
end;
$$;

drop trigger if exists application_fields_assign_key on public.application_fields;
create trigger application_fields_assign_key
before insert or update of server_id, field_key on public.application_fields
for each row execute function private.assign_application_field_key();

-- Reassert the defaults used by new rows. Existing rows are unchanged.
alter table public.application_fields
  alter column id set default gen_random_uuid(),
  alter column created_at set default now(),
  alter column updated_at set default now();
