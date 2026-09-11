-- Private workflow data must never be exposed through applicant SELECT policies.
-- Applied to VellaView on 2026-09-11; filename matches the remote migration history.
create table public.application_review_work (
 application_id uuid primary key references public.applications(id) on delete cascade,
 assignee_id uuid references auth.users(id) on delete set null,
 updated_at timestamptz not null default now()
);
create table public.application_team_notes (
 id uuid primary key default gen_random_uuid(),
 application_id uuid not null references public.applications(id) on delete cascade,
 author_id uuid references auth.users(id) on delete set null,
 body text not null check (length(body) between 1 and 2000),
 created_at timestamptz not null default now()
);
create index application_team_notes_application_idx on public.application_team_notes(application_id,created_at);
create table public.application_notification_preferences (
 application_id uuid primary key references public.applications(id) on delete cascade,
 enabled boolean not null default false
);
create table public.server_service_preferences (
 server_id uuid primary key references public.servers(id) on delete cascade,
 reminders_enabled boolean not null default false
);
create table public.service_notifications (
 id uuid primary key default gen_random_uuid(),
 application_id uuid references public.applications(id) on delete cascade,
 server_id uuid not null references public.servers(id) on delete cascade,
 kind text not null check (kind in ('applicant_status','review_reminder')),
 event_key text not null unique,
 attempts integer not null default 0,
 available_at timestamptz not null default now(),
 delivered_at timestamptz,
 created_at timestamptz not null default now()
);
create index service_notifications_pending_idx on public.service_notifications(available_at) where delivered_at is null and attempts < 5;
create index service_notifications_application_idx on public.service_notifications(application_id);
create index service_notifications_server_idx on public.service_notifications(server_id);
create index application_review_work_assignee_idx on public.application_review_work(assignee_id);
create index application_team_notes_author_idx on public.application_team_notes(author_id);
create index if not exists applications_server_created_service_idx on public.applications(server_id,created_at);
do $$ declare t text; begin
 foreach t in array array['application_review_work','application_team_notes','application_notification_preferences','server_service_preferences','service_notifications'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on table public.%I from public,anon,authenticated',t);
  execute format('grant select,insert,update,delete on table public.%I to service_role',t);
 end loop;
end $$;

create function public.save_application_review_work(p_application uuid,p_actor uuid,p_assign boolean,p_assignee uuid,p_note text)
returns void language plpgsql security invoker set search_path='' as $$
declare sid uuid; begin
 select server_id into sid from public.applications where id=p_application for update;
 if sid is null or not exists(select 1 from public.server_members where server_id=sid and user_id=p_actor and role in ('owner','admin','reviewer')) then raise exception 'Not allowed'; end if;
 if p_assign then
  if p_assignee is not null and not exists(select 1 from public.server_members where server_id=sid and user_id=p_assignee and role in ('owner','admin','reviewer')) then raise exception 'Reviewer not available'; end if;
  insert into public.application_review_work(application_id,assignee_id) values(p_application,p_assignee)
  on conflict(application_id) do update set assignee_id=excluded.assignee_id,updated_at=now();
 end if;
 if p_note is not null then
  if length(trim(p_note)) not between 1 and 2000 then raise exception 'Invalid note'; end if;
  insert into public.application_team_notes(application_id,author_id,body) values(p_application,p_actor,trim(p_note));
 end if;
end $$;
revoke all on function public.save_application_review_work(uuid,uuid,boolean,uuid,text) from public,anon,authenticated;
grant execute on function public.save_application_review_work(uuid,uuid,boolean,uuid,text) to service_role;

create function public.queue_application_status_notification() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if new.status is distinct from old.status and new.status in ('under_review','declined','approved','role_assigned','role_failed')
 and exists(select 1 from public.application_notification_preferences where application_id=new.id and enabled) then
  insert into public.service_notifications(application_id,server_id,kind,event_key)
  values(new.id,new.server_id,'applicant_status',new.id::text||':'||new.status) on conflict(event_key) do nothing;
 end if;
 return new;
end $$;
revoke all on function public.queue_application_status_notification() from public,anon,authenticated;
create trigger application_status_notification after update of status on public.applications for each row execute function public.queue_application_status_notification();

create function public.service_overdue_count(p_server uuid) returns bigint language sql stable security invoker set search_path='' as $$
 select count(*) from public.applications a left join public.interview_sessions i on i.application_id=a.id
 where a.server_id=p_server and a.status in ('pending','under_review','role_pending','role_failed')
 and coalesce(i.completed_at,a.created_at)<now()-interval '48 hours';
$$;
revoke all on function public.service_overdue_count(uuid) from public,anon,authenticated;
grant execute on function public.service_overdue_count(uuid) to service_role;

create function public.claim_service_notifications() returns setof public.service_notifications language plpgsql security invoker set search_path='' as $$
begin
 insert into public.service_notifications(server_id,kind,event_key)
 select s.id,'review_reminder',s.id::text||':reminder:'||current_date::text from public.servers s
 join public.server_service_preferences p on p.server_id=s.id and p.reminders_enabled
 where s.is_active and public.service_overdue_count(s.id)>0
 on conflict(event_key) do nothing;
 return query update public.service_notifications n set attempts=n.attempts+1,available_at=now()+interval '15 minutes'
 where n.id in(select id from public.service_notifications where delivered_at is null and attempts<5 and available_at<=now() order by available_at for update skip locked limit 10)
 returning n.*;
end $$;
revoke all on function public.claim_service_notifications() from public,anon,authenticated;
grant execute on function public.claim_service_notifications() to service_role;

create function public.server_service_metrics(p_server uuid,p_actor uuid) returns jsonb language plpgsql security invoker set search_path='' as $$
declare result jsonb; begin
 if not exists(select 1 from public.server_members where server_id=p_server and user_id=p_actor and role in ('owner','admin','reviewer')) then raise exception 'Not allowed'; end if;
 select jsonb_build_object(
  'applications',count(*),'submitted',count(*) filter(where i.status='completed'),
  'unfinished',count(*) filter(where a.status='interviewing'),
  'notStarted',count(*) filter(where a.status='interviewing' and i.started_at is null),
  'interviewIncomplete',count(*) filter(where a.status='interviewing' and i.started_at is not null),
  'stale',count(*) filter(where a.status='interviewing' and a.created_at<now()-interval '24 hours'),
  'waiting',count(*) filter(where a.status in ('pending','under_review','role_pending','role_failed')),
  'overdue',count(*) filter(where a.status in ('pending','under_review','role_pending','role_failed') and coalesce(i.completed_at,a.created_at)<now()-interval '48 hours'),
  'reviewHours',round((avg(extract(epoch from a.reviewed_at-coalesce(i.completed_at,a.created_at))/3600) filter(where a.reviewed_at>=coalesce(i.completed_at,a.created_at)))::numeric,1),
  'periodDays',30
 ) into result from public.applications a left join public.interview_sessions i on i.application_id=a.id
 where a.server_id=p_server and a.created_at>=now()-interval '30 days';
 return result;
end $$;
revoke all on function public.server_service_metrics(uuid,uuid) from public,anon,authenticated;
grant execute on function public.server_service_metrics(uuid,uuid) to service_role;
