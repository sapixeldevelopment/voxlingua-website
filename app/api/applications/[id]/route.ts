import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getServerRole } from "@/lib/access";
import { consumeRateLimit, isUuid, noStoreJson, rejectCrossOrigin } from "@/lib/security";

const RECORDINGS_BUCKET = "interview-recordings";
const DELETABLE_STATUSES = ["approved", "declined", "role_assigned"];

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const crossOrigin = rejectCrossOrigin(request);
  if (crossOrigin) return crossOrigin;

  const { id } = await params;
  if (!isUuid(id)) return noStoreJson({ error: "Application not found." }, { status: 404 });

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return noStoreJson({ error: "You must be signed in." }, { status: 401 });
  if (!(await consumeRateLimit(`application-delete:${auth.user.id}`, 30, 600))) {
    return noStoreJson({ error: "Too many delete requests. Please wait a moment." }, { status: 429 });
  }

  const admin = createAdminClient();
  const { data: application, error: applicationError } = await admin
    .from("applications")
    .select("id,server_id,status")
    .eq("id", id)
    .maybeSingle();
  if (applicationError) return noStoreJson({ error: "The application could not be loaded." }, { status: 500 });
  if (!application) return noStoreJson({ error: "Application not found." }, { status: 404 });

  const role = await getServerRole(application.server_id, auth.user.id);
  if (!role || role === "reviewer") {
    return noStoreJson({ error: "Only the portal owner or an administrator can delete application history." }, { status: 403 });
  }
  if (!DELETABLE_STATUSES.includes(application.status)) {
    return noStoreJson({ error: "Only decided applications can be deleted." }, { status: 409 });
  }

  const { data: sessions, error: sessionsError } = await admin
    .from("interview_sessions")
    .select("recording_path")
    .eq("application_id", id);
  if (sessionsError) return noStoreJson({ error: "The interview recording could not be checked." }, { status: 500 });

  const recordingPaths = Array.from(
    new Set(
      (sessions || [])
        .map((session) => session.recording_path)
        .filter((path): path is string => Boolean(path)),
    ),
  );
  if (recordingPaths.length) {
    const { error: recordingError } = await admin.storage
      .from(RECORDINGS_BUCKET)
      .remove(recordingPaths);
    if (recordingError) {
      return noStoreJson({ error: "The application was kept because its recording could not be removed safely." }, { status: 500 });
    }
  }

  const { error: deleteError } = await admin.from("applications").delete().eq("id", id);
  if (deleteError) return noStoreJson({ error: "The application could not be deleted." }, { status: 500 });

  await admin.from("audit_logs").insert({
    server_id: application.server_id,
    actor_user_id: auth.user.id,
    action: "application_history_deleted",
    entity_type: "application",
    entity_id: id,
    metadata: { recordings_deleted: recordingPaths.length },
  });

  return noStoreJson({ ok: true });
}
