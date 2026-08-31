import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { isUuid, rejectCrossOrigin } from "@/lib/security";

const RECORDINGS_BUCKET = "interview-recordings";

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const crossOrigin = rejectCrossOrigin(request);
  if (crossOrigin) return crossOrigin;
  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ error: "Portal not found." }, { status: 404 });
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "You must be signed in." }, { status: 401 });

  try {
    const admin = createAdminClient();
    const { data: server, error: serverError } = await admin.from("servers").select("id,owner_id").eq("id", id).maybeSingle();
    if (serverError) return NextResponse.json({ error: serverError.message }, { status: 500 });
    if (!server) return NextResponse.json({ error: "Portal not found." }, { status: 404 });
    if (server.owner_id !== auth.user.id) return NextResponse.json({ error: "Only the portal owner can delete it." }, { status: 403 });

    const { data: sessions, error: sessionError } = await admin.from("interview_sessions").select("recording_path").eq("server_id", id);
    if (sessionError) return NextResponse.json({ error: sessionError.message }, { status: 500 });
    const recordingPaths = (sessions || []).map((session) => session.recording_path).filter((path): path is string => Boolean(path));
    if (recordingPaths.length) {
      const { error: recordingError } = await admin.storage.from(RECORDINGS_BUCKET).remove(recordingPaths);
      if (recordingError) return NextResponse.json({ error: `The portal was not deleted because its recordings could not be removed: ${recordingError.message}` }, { status: 500 });
    }

    const { error: deleteError } = await admin.from("servers").delete().eq("id", id).eq("owner_id", auth.user.id);
    if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not delete the portal." }, { status: 500 });
  }
}
