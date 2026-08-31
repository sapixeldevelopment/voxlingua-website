-- Approved applications are permanent history, not a permanent eligibility
-- lock. Current Discord role membership is checked by the server API before a
-- new application is created. Only an open application remains unique.
drop index if exists public.applications_one_active_per_applicant_idx;

create unique index applications_one_active_per_applicant_idx
  on public.applications (server_id, applicant_user_id)
  where status in (
    'pending',
    'interviewing',
    'under_review',
    'role_pending',
    'role_failed'
  );

comment on index public.applications_one_active_per_applicant_idx is
  'Prevents duplicate open applications while allowing reapplication after an approved Discord role is lost.';
