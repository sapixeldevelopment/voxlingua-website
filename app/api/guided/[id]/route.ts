import { guidedAccess } from "@/lib/guided-voice";
import { consumeRateLimit, noStoreJson, rejectCrossOrigin } from "@/lib/security";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const cross = rejectCrossOrigin(request); if (cross) return cross;
  try {
    const { id } = await params;
    const { admin, session, user } = await guidedAccess(id);
    if (!(await consumeRateLimit(`guided-start:${user.id}`, 12, 3600))) return noStoreJson({ error: "Please wait before trying again." }, { status: 429 });
    if (!["created","in_progress"].includes(session.status)) throw new Error("This interview has already ended.");
    let questions: string[] = session.guided_questions;
    if (!questions) {
      const { data, error } = await admin.from("question_bank").select("prompt").eq("server_id",session.server_id).eq("is_active",true).order("order_index").limit(8);
      if (error) throw new Error("Questions could not be loaded.");
      questions = data?.length ? data.map(q => q.prompt.slice(0,2000)) : ["Tell us about your roleplay experience.", "What does good roleplay mean to you?", "How would you handle a disagreement with another player?"];
      const { error: saveError } = await admin.from("interview_sessions").update({ guided_questions: questions }).eq("id",id).is("guided_questions",null);
      if (saveError) throw new Error("Questions could not be saved.");
    }
    // Set the clock once. Loading/retrying cannot extend the interview.
    if (!session.started_at) {
      const { error } = await admin.from("interview_sessions").update({ started_at: new Date().toISOString(), status:"in_progress" }).eq("id",id).is("started_at",null);
      if (error) throw new Error("Interview could not start.");
    }
    const { data: saved } = await admin.from("interview_sessions").select("started_at,guided_questions").eq("id",id).single();
    if (!saved) throw new Error("Interview could not start.");
    return noStoreJson({ questions:saved.guided_questions, startedAt:saved.started_at, serverId:session.server_id, limitSeconds:1200 });
  } catch (error) { return noStoreJson({ error: error instanceof Error ? error.message : "Interview unavailable." }, { status: 409 }); }
}
