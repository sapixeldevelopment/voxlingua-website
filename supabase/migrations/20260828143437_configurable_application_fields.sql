create table public.application_fields (
  id uuid primary key default gen_random_uuid(),
  server_id uuid not null references public.servers(id) on delete cascade,
  field_key text not null check (field_key ~ '^[a-z][a-z0-9_]*$'),
  label text not null check (char_length(label) between 1 and 120),
  description text,
  field_type text not null default 'text' check (field_type in ('text', 'textarea', 'select')),
  placeholder text,
  options jsonb not null default '[]'::jsonb,
  is_required boolean not null default false,
  is_active boolean not null default true,
  order_index integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (server_id, field_key)
);

alter table public.applications
  add column if not exists form_data jsonb not null default '{}'::jsonb;

create or replace function private.is_server_manager(p_server_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.server_members sm
    where sm.server_id = p_server_id
      and sm.user_id = (select auth.uid())
      and sm.role in ('owner', 'admin', 'reviewer')
  );
$$;

revoke all on function private.is_server_manager(uuid) from public;
grant execute on function private.is_server_manager(uuid) to authenticated;

create index if not exists application_fields_server_order_idx
  on public.application_fields (server_id, order_index);

alter table public.application_fields enable row level security;
grant select, insert, update, delete on public.application_fields to authenticated;
grant select on public.application_fields to anon;

create policy "active application fields are public"
  on public.application_fields for select
  to anon, authenticated
  using (is_active = true);

create policy "managers see all application fields"
  on public.application_fields for select
  to authenticated
  using (private.is_server_manager(server_id));

create policy "owners manage application fields"
  on public.application_fields for all
  to authenticated
  using (private.is_server_manager(server_id))
  with check (private.is_server_manager(server_id));

create trigger application_fields_touch
before update on public.application_fields
for each row execute procedure public.touch_updated_at();

insert into public.application_fields (server_id, field_key, label, description, field_type, placeholder, is_required, order_index)
select s.id, v.field_key, v.label, v.description, v.field_type, v.placeholder, v.is_required, v.order_index
from public.servers s
cross join (values
  ('player_name', 'Player name', 'Your FiveM or in-game name.', 'text', 'Your in-game name', true, 0),
  ('game_name', 'Character name', 'The character you plan to play.', 'text', 'Optional', false, 1),
  ('experience', 'Tell us about your experience', 'Share your FiveM, roleplay, or community experience.', 'textarea', 'A few sentences is plenty.', false, 2)
) as v(field_key, label, description, field_type, placeholder, is_required, order_index)
where not exists (
  select 1 from public.application_fields af
  where af.server_id = s.id and af.field_key = v.field_key
);;
