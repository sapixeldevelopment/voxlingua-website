import { after } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { sendDiscordWebhook } from "@/lib/discord-webhook";
import { assessInterviewTranscript, normalizeInterviewQuestionCount } from "@/lib/interview-policy";
import { consumeRateLimit, isUuid, noStoreJson, readJsonBody, rejectCrossOrigin } from "@/lib/security";
import { analyzeInterviewSession } from "@/lib/interview-analysis";

export const maxDuration = 60;

type TranscriptLine = { role?: unknown; text?: unknown; at?: unknown };

export async function POST(request: Request) {
  const crossOrigin = rejectCrossOrigin(request);
  if (crossOrigin) return crossOrigin;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return noStoreJson({ error: "You must be signed in." }, { status: 401 });
  if (!(await consumeRateLimit(`interview-submit:${auth.user.id}`, 12, 3600))) {
    return noStoreJson({ error: "Too many interview submission attempts. Please wait before trying again." }, { status: 429 });
  }
  const body = await readJsonBody<{ sessionId?: string; transcript?: unknown }>(request, 140_000);
  if (!body || !isUuid(body.sessionId) || !Array.isArray(body.transcript) || body.transcript.length > 200) {
    return noStoreJson({ error: "Missing or invalid interview submission details." }, { status: 400 });
  }
  const transcript = body.transcript as TranscriptLine[];
  const invalidLine = transcript.some((line) => !line || typeof line !== "object" || !["user", "assistant"].includes(String(line.role)) || typeof line.text !== "string" || line.text.length > 4_000 || (line.at !== undefined && typeof line.at !== "string"));
  if (invalidLine) return noStoreJson({ error: "The interview transcript is invalid." }, { status: 400 });
  const admin = createAdminClient();
  const { data: readySession } = await supabase
    .from("interview_sessions")
    .select("server_id,recording_path,started_at,status,restart_count")
    .eq("id", body.sessionId)
    .maybeSingle();
  if (!readySession || !["created", "in_progress", "completed"].includes(readySession.status)) {
    return noStoreJson({ error: "This interview cannot be submitted." }, { status: 409 });
  }
  // A retry after a lost response must reach the idempotent, ownership-checked
  // RPC even if requirements have changed since the original submission.
  if (readySession.status !== "completed") {
    const { count: configuredQuestionCount, error: questionCountError } = await admin
      .from("question_bank")
      .select("id", { count: "exact", head: true })
      .eq("server_id", readySession.server_id)
      .eq("is_active", true);
    if (questionCountError) {
      return noStoreJson({ error: "The interview requirements could not be checked." }, { status: 500 });
    }
    const questionCount = normalizeInterviewQuestionCount(configuredQuestionCount || 0);
    const assessment = assessInterviewTranscript(transcript, questionCount);
    if (!assessment.eligible) {
      return noStoreJson({ error: assessment.message, assessment }, { status: 422 });
    }
    // The RPC checks the server-controlled recording upload time. Time spent
    // reviewing or retrying an already-saved recording is not interview time.
    if (!readySession?.recording_path) {
      return noStoreJson({ error: "The interview recording must finish uploading before submission." }, { status: 422 });
    }
  }
  const { data, error } = await supabase.rpc("submit_interview", {
    p_session_id: body.sessionId,
    p_transcript: transcript,
  });
  if (error) {
    const expectedMessages = new Set([
      "The server subscription is not active.",
      "This plan has reached its daily interview limit. Please try again tomorrow.",
      "No interview credits remaining.",
      "Interview session not found.",
      "This interview cannot be submitted.",
      "The interview recording must finish uploading before submission.",
      "The interview was not started correctly.",
      "The interview transcript is invalid or too large.",
      "Please give clear spoken answers to the interview questions before submitting.",
      "This interview attempt exceeded its time limit. Use your one allowed restart.",
      "This interview attempt exceeded its time limit and cannot be restarted again.",
    ]);
    if (error.code === "P0001" && expectedMessages.has(error.message)) {
      const noCredits = /no interview credits|subscription is not active|daily interview limit/i.test(error.message);
      return noStoreJson({ error: error.message }, { status: noCredits ? 402 : 422 });
    }
    // Never log transcript contents or expose database/provider details.
    console.error("Interview submission failed", { sessionId: body.sessionId, code: error.code });
    return noStoreJson({ error: "We couldn't save your submission yet. Your recording is saved; keep this page open and try Submit interview again." }, { status: 500 });
  }
  const result = data as { ok?: boolean; already_submitted?: boolean } | null;
  if (!result?.ok) return noStoreJson({ error: "Submission was not confirmed. Keep this page open and try again." }, { status: 500 });
  if (!result.already_submitted) {
    // Saving and billing have committed. Notification/analysis failures must
    // never turn that successful submission into an error or hold the UI open.
    after(async () => {
      try {
        const { data: session } = await admin
          .from("interview_sessions")
          .select("application_id,server_id")
          .eq("id", body.sessionId)
          .maybeSingle();
        if (session) {
          const { error: assessmentError } = await admin.from("interview_assessments").upsert({
            session_id: body.sessionId,
            application_id: session.application_id,
            server_id: session.server_id,
            status: "pending",
            error_message: null,
          }, { onConflict: "session_id" });
          if (assessmentError) {
            console.error("Interview assessment could not be queued", { sessionId: body.sessionId, message: assessmentError.message });
          }
          const [{ data: application }, { data: server }] = await Promise.all([
            admin.from("applications").select("player_name,discord_username").eq("id", session.application_id).maybeSingle(),
            admin.from("servers").select("name").eq("id", session.server_id).maybeSingle(),
          ]);
          const notification = await sendDiscordWebhook(session.server_id, {
            embeds: [{
              title: "New application ready for review",
              description: `A completed application has been submitted to **${server?.name || "your server"}**.`,
              color: 0x27845f,
              fields: [
                { name: "Applicant", value: (application?.player_name || "Discord applicant").slice(0, 256), inline: true },
                { name: "Discord", value: application?.discord_username ? `@${application.discord_username}`.slice(0, 256) : "Not provided", inline: true },
                { name: "Status", value: "Ready for review", inline: true },
              ],
              timestamp: new Date().toISOString(),
              footer: { text: "Dexlyy applications" },
            }],
          });
          if (notification.configured && !notification.ok) {
            console.warn("Discord application notification failed", { serverId: session.server_id, status: notification.status });
          }
          if (!assessmentError) await analyzeInterviewSession(body.sessionId!);
        }
      } catch {
        console.error("Interview follow-up processing failed", { sessionId: body.sessionId });
      }
    });
  }
  return noStoreJson(result);
}
