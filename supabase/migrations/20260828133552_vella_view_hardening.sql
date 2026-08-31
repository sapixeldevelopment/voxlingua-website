
alter function public.touch_updated_at() set search_path = public, pg_temp;
revoke all on function public.handle_new_user() from public;
revoke all on function public.handle_new_user() from anon;
revoke all on function public.handle_new_user() from authenticated;
alter function public.handle_new_user() set search_path = public, pg_temp;

create index if not exists applications_applicant_user_id_idx on public.applications (applicant_user_id);
create index if not exists applications_reviewed_by_idx on public.applications (reviewed_by);
create index if not exists applications_server_id_idx on public.applications (server_id);
create index if not exists audit_logs_actor_user_id_idx on public.audit_logs (actor_user_id);
create index if not exists audit_logs_server_id_idx on public.audit_logs (server_id);
create index if not exists interview_sessions_server_id_idx on public.interview_sessions (server_id);
create index if not exists question_bank_created_by_idx on public.question_bank (created_by);
create index if not exists question_bank_server_id_idx on public.question_bank (server_id);
create index if not exists server_members_user_id_idx on public.server_members (user_id);
create index if not exists servers_owner_id_idx on public.servers (owner_id);
;
