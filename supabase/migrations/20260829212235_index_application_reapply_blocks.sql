create index if not exists application_reapply_blocks_applicant_idx
  on public.application_reapply_blocks (applicant_user_id);

create index if not exists application_reapply_blocks_last_application_idx
  on public.application_reapply_blocks (last_application_id)
  where last_application_id is not null;
