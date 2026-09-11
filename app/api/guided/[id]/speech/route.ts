import { createHash } from "node:crypto";
import { guidedAccess } from "@/lib/guided-voice";
import { consumeRateLimit, noStoreJson, readJsonBody, rejectCrossOrigin } from "@/lib/security";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const cross = rejectCrossOrigin(request); if (cross) return cross;
  try {
    const { id } = await params;
    const { admin, session, user, ownerId, planKey } = await guidedAccess(id);
    const body = await readJsonBody<{ index?: number }>(request,1024);
    const questions: string[] = session.guided_questions || [];
    if (!Number.isInteger(body?.index) || body!.index! < 0 || body!.index! >= questions.length ||
        session.status !== "in_progress" || !session.started_at ||
        Date.now()-new Date(session.started_at).getTime()>1200000) throw new Error("Question is unavailable.");
    if (!(await consumeRateLimit(`guided-speech:${user.id}`, 80, 600))) throw new Error("Too many playback requests.");
    const input = questions[body!.index!];
    const model = "gpt-4o-mini-tts", voice = "marin";
    const hash = createHash("sha256").update(JSON.stringify({input,model,voice,version:1})).digest("hex");
    const path = `${session.server_id}/${hash}.mp3`;
    const bucket = admin.storage.from("guided-question-audio");
    const { data: cached } = await bucket.download(path);
    if (cached) return new Response(cached,{headers:{"Content-Type":"audio/mpeg","Cache-Control":"private, no-store"}});
    // Bound both repeated edits and concurrent generation of the same question.
    if (!(await consumeRateLimit(`tts-owner:${ownerId}`, planKey==="free"?8:160, 86400)) ||
        !(await consumeRateLimit(`tts-cache:${hash}:${session.server_id}`,1,60))) throw new Error("Question audio is being prepared. Please retry shortly.");
    if (!process.env.OPENAI_API_KEY) throw new Error("Question audio is not configured.");
    const response = await fetch("https://api.openai.com/v1/audio/speech", {
      method:"POST", headers:{"Authorization":`Bearer ${process.env.OPENAI_API_KEY}`,"Content-Type":"application/json"},
      signal:AbortSignal.timeout(30000),
      body:JSON.stringify({model,voice,input,response_format:"mp3",instructions:"Read the question exactly as written in a calm, professional, unhurried tone."})
    });
    if (!response.ok) throw new Error("Question audio could not be prepared. Please retry.");
    const audio = await response.blob();
    if (audio.size>3000000) throw new Error("Question audio is too large.");
    const {error} = await bucket.upload(path,audio,{contentType:"audio/mpeg",upsert:false});
    if (error && !/already exists|duplicate/i.test(error.message)) throw new Error("Question audio could not be saved.");
    return new Response(audio,{headers:{"Content-Type":"audio/mpeg","Cache-Control":"private, no-store"}});
  } catch(error) { return noStoreJson({error:error instanceof Error ? error.message : "Audio unavailable."},{status:409}); }
}
