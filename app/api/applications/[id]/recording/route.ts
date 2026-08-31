import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "You must be signed in." }, { status: 401 });

  const { data: application, error: applicationError } = await supabase.from("applications").select("id,server_id").eq("id", id).maybeSingle();
  if (applicationError || !application) return NextResponse.json({ error: "Application not found." }, { status: 404 });
  const { data: member } = await supabase.from("server_members").select("role").eq("server_id", application.server_id).eq("user_id", auth.user.id).in("role", ["owner", "admin", "reviewer"]).maybeSingle();
  if (!member) return NextResponse.json({ error: "You are not allowed to listen to this recording." }, { status: 403 });

  const { data: session, error: sessionError } = await supabase.from("interview_sessions").select("recording_path").eq("application_id", id).maybeSingle();
  if (sessionError || !session?.recording_path) return NextResponse.json({ error: "No recording is available for this application." }, { status: 404 });
  const { data: recording, error: recordingError } = await supabase.storage.from("interview-recordings").download(session.recording_path);
  if (recordingError || !recording) return NextResponse.json({ error: recordingError?.message || "The recording could not be loaded." }, { status: 404 });

  return new NextResponse(recording, {
    headers: {
      "Content-Type": recording.type || "audio/webm",
      "Content-Disposition": "inline",
      "Cache-Control": "private, no-store",
    },
  });
}
