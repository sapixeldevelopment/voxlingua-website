import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { consumeRateLimit, isUuid, noStoreJson, rejectCrossOrigin } from "@/lib/security";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const crossOrigin = rejectCrossOrigin(request);
  if (crossOrigin) return crossOrigin;
  const { id } = await params;
  if (!isUuid(id)) return noStoreJson({ error: "Interview not found." }, { status: 404 });

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return noStoreJson({ error: "You must be signed in." }, { status: 401 });
  if (!(await consumeRateLimit(`interview-reset:${auth.user.id}`, 8, 3600))) {
    return noStoreJson({ error: "Too many interview restarts. Please wait before trying again." }, { status: 429 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin.rpc("reset_interview_attempt", {
    p_session_id: id,
    p_user_id: auth.user.id,
  });
  if (error) {
    const status = /not found/i.test(error.message) ? 404 : /restart|submitted|cannot/i.test(error.message) ? 409 : 500;
    return noStoreJson({ error: status === 500 ? "The interview could not be restarted." : error.message }, { status });
  }
  const result = (data || {}) as { recording_path?: string | null; restart_count?: number; restarts_remaining?: number };
  if (result.recording_path) {
    const { error: removeError } = await admin.storage.from("interview-recordings").remove([result.recording_path]);
    if (removeError) console.error("Discarded interview recording cleanup failed", { sessionId: id, message: removeError.message });
  }
  return noStoreJson({
    ok: true,
    restartCount: result.restart_count ?? 1,
    restartsRemaining: result.restarts_remaining ?? 0,
  });
}
