import { getServerRole } from "@/lib/access";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { isUuid, noStoreJson } from "@/lib/security";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) return noStoreJson({ error: "Application not found." }, { status: 404 });

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return noStoreJson({ error: "You must be signed in." }, { status: 401 });

  const admin = createAdminClient();
  const { data: application } = await admin.from("applications").select("server_id").eq("id", id).maybeSingle();
  if (!application) return noStoreJson({ error: "Application not found." }, { status: 404 });
  if (!(await getServerRole(application.server_id, auth.user.id))) {
    return noStoreJson({ error: "You are not allowed to review this application." }, { status: 403 });
  }

  const { data, error } = await admin
    .from("interview_assessments")
    .select("status,overall_score,rules_score,communication_score,maturity_score,confidence,summary,strengths,concerns,rules_evidence,voice_alteration_score,voice_alteration_confidence,voice_analysis_result,voice_notes,completed_at")
    .eq("application_id", id)
    .maybeSingle();
  if (error) return noStoreJson({ error: "Interview signals could not be loaded." }, { status: 500 });
  if (!data) return noStoreJson({ assessment: null });

  return noStoreJson({
    assessment: {
      status: data.status,
      overallScore: data.overall_score,
      rulesScore: data.rules_score,
      communicationScore: data.communication_score,
      maturityScore: data.maturity_score,
      confidence: data.confidence,
      summary: data.summary,
      strengths: data.strengths || [],
      concerns: data.concerns || [],
      rulesEvidence: data.rules_evidence || [],
      voiceAlterationScore: data.voice_alteration_score,
      voiceAlterationConfidence: data.voice_alteration_confidence,
      voiceAnalysisResult: data.voice_analysis_result,
      voiceNotes: data.voice_notes,
      completedAt: data.completed_at,
    },
  });
}
