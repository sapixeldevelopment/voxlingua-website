create table if not exists public.interview_assessments (
  session_id uuid primary key references public.interview_sessions(id) on delete cascade,
  application_id uuid not null references public.applications(id) on delete cascade,
  server_id uuid not null references public.servers(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'processing', 'completed', 'failed')),
  overall_score smallint check (overall_score between 0 and 100),
  rules_score smallint check (rules_score between 0 and 100),
  communication_score smallint check (communication_score between 0 and 100),
  maturity_score smallint check (maturity_score between 0 and 100),
  confidence text check (confidence in ('low', 'medium', 'high')),
  summary text,
  strengths text[] not null default '{}',
  concerns text[] not null default '{}',
  rules_evidence text[] not null default '{}',
  voice_alteration_score smallint check (voice_alteration_score between 0 and 100),
  voice_alteration_confidence text check (voice_alteration_confidence in ('low', 'medium', 'high')),
  voice_analysis_result text not null default 'not_assessed' check (voice_analysis_result in ('natural', 'possible_alteration', 'insufficient_audio', 'not_assessed')),
  voice_notes text,
  model text,
  audio_model text,
  analysis_version text not null default '1',
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (application_id)
);

create index if not exists interview_assessments_server_idx on public.interview_assessments(server_id);
create index if not exists interview_assessments_application_idx on public.interview_assessments(application_id);

drop trigger if exists interview_assessments_touch on public.interview_assessments;
create trigger interview_assessments_touch before update on public.interview_assessments
for each row execute procedure public.touch_updated_at();

alter table public.interview_assessments enable row level security;
revoke all on table public.interview_assessments from public, anon, authenticated;
grant all on table public.interview_assessments to service_role;

-- The browser uploads a short temporary WAV sample after a player explicitly
-- submits. Server-side analysis removes it immediately after processing.
update storage.buckets
set allowed_mime_types = array['audio/webm', 'audio/mp4', 'audio/ogg', 'audio/wav']::text[]
where id = 'interview-recordings';
