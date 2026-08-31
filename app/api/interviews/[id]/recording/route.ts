import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { consumeRateLimit, isUuid, noStoreJson, readJsonBody, rejectCrossOrigin } from "@/lib/security";

type RecordingBody = { path?: string };

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const crossOrigin = rejectCrossOrigin(request);
  if (crossOrigin) return crossOrigin;
  const { id } = await params;
  if (!isUuid(id)) return noStoreJson({ error: "Interview not found." }, { status: 404 });

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return noStoreJson({ error: "You must be signed in." }, { status: 401 });
  if (!(await consumeRateLimit(`recording-link:${auth.user.id}`, 20, 600))) {
    return noStoreJson({ error: "Too many recording requests. Please wait a moment." }, { status: 429 });
  }
  const body = await readJsonBody<RecordingBody>(request, 2_048);
  if (!body?.path) return noStoreJson({ error: "Missing recording path." }, { status: 400 });

  const admin = createAdminClient();
  const { data: session } = await admin.from("interview_sessions").select("id,server_id,application_id,status,recording_path").eq("id", id).maybeSingle();
  if (!session) return noStoreJson({ error: "Interview not found." }, { status: 404 });
  const { data: application } = await admin.from("applications").select("applicant_user_id").eq("id", session.application_id).maybeSingle();
  if (application?.applicant_user_id !== auth.user.id) return noStoreJson({ error: "Interview not found." }, { status: 404 });
  if (!["created", "in_progress"].includes(session.status)) return noStoreJson({ error: "This recording can no longer be changed." }, { status: 409 });

  const expectedPath = `${session.server_id}/${session.id}/recording.webm`;
  if (body.path !== expectedPath) return noStoreJson({ error: "Invalid recording path." }, { status: 400 });
  const { data: files, error: listError } = await admin.storage.from("interview-recordings").list(`${session.server_id}/${session.id}`, { search: "recording.webm", limit: 2 });
  if (listError || !files?.some((file) => file.name === "recording.webm")) {
    return noStoreJson({ error: "The recording upload could not be verified." }, { status: 422 });
  }

  const { error } = await admin.from("interview_sessions").update({ recording_path: expectedPath }).eq("id", id);
  if (error) return noStoreJson({ error: "The recording could not be linked to the interview." }, { status: 500 });
  return noStoreJson({ ok: true, path: expectedPath });
}
