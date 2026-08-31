export type Server = {
  id: string;
  owner_id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  discord_guild_id: string | null;
  discord_guild_name: string | null;
  staff_role_id: string | null;
  staff_role_name: string | null;
  approved_role_id: string | null;
  approved_role_name: string | null;
  welcome_message: string;
  application_retention_days: number;
  declined_reapply_cooldown_days: number;
  is_active: boolean;
  created_at: string;
};

export type ServerAdditionalRole = {
  id: string;
  server_id: string;
  role_id: string;
  name: string;
  created_at?: string;
  updated_at?: string;
};

export type Application = {
  id: string;
  server_id: string;
  applicant_user_id: string;
  discord_user_id: string | null;
  discord_username: string | null;
  player_name: string | null;
  game_name: string | null;
  experience: string | null;
  form_data?: Record<string, string>;
  status:
    | "pending"
    | "interviewing"
    | "under_review"
    | "approved"
    | "declined"
    | "role_pending"
    | "role_assigned"
    | "role_failed";
  role_error?: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  reviewer_role: "owner" | "admin" | "reviewer" | null;
  created_at: string;
  updated_at: string;
};

export type ApplicationField = {
  id: string;
  server_id: string;
  field_key: string;
  label: string;
  description: string | null;
  field_type: "text" | "textarea" | "select";
  placeholder: string | null;
  options: string[];
  is_required: boolean;
  is_active: boolean;
  order_index: number;
  created_at?: string;
  updated_at?: string;
};

export type Question = {
  id: string;
  server_id: string;
  prompt: string;
  scenario: string | null;
  order_index: number;
  is_active: boolean;
  created_by?: string;
};

export type InterviewSession = {
  id: string;
  application_id: string;
  server_id: string;
  status: "created" | "in_progress" | "completed" | "abandoned";
  summary: string | null;
  score: number | null;
  recording_path: string | null;
  recording_deleted_at: string | null;
  transcript: Array<{ role: "user" | "assistant"; text: string; at?: string }>;
  restart_count: number;
  started_at: string | null;
  completed_at: string | null;
};

export type InterviewAssessment = {
  status: "pending" | "processing" | "completed" | "failed";
  overallScore: number | null;
  rulesScore: number | null;
  communicationScore: number | null;
  maturityScore: number | null;
  confidence: "low" | "medium" | "high" | null;
  summary: string | null;
  strengths: string[];
  concerns: string[];
  rulesEvidence: string[];
  voiceAlterationScore: number | null;
  voiceAlterationConfidence: "low" | "medium" | "high" | null;
  voiceAnalysisResult: "natural" | "possible_alteration" | "insufficient_audio" | "not_assessed";
  voiceNotes: string | null;
  completedAt: string | null;
};
