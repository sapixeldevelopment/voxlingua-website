import { after } from "next/server";
import { guidedAccess } from "@/lib/guided-voice";
import { consumeRateLimit, noStoreJson, rejectCrossOrigin } from "@/lib/security";
import { sendDiscordWebhook } from "@/lib/discord-webhook";

export async function POST(request: Request, {params}: {params:Promise<{id:string}>}) {
  const cross=rejectCrossOrigin(request); if(cross) return cross;
  try {
    const {id}=await params;
    const {admin,user,session}=await guidedAccess(id);
    if (!(await consumeRateLimit(`guided-submit:${user.id}`,12,3600))) throw new Error("Too many attempts. Please wait.");
    const {data,error}=await admin.rpc("submit_guided_interview",{p_session_id:id,p_user_id:user.id});
    if(error) { console.error("Guided submission failed",{sessionId:id,code:error.code}); throw new Error("Submission could not complete. Check your credits and recording, then retry."); }
    if(!data?.ok) throw new Error("Submission was not confirmed. Please retry.");
    if(!data.already_submitted) after(async()=> {
      try { await sendDiscordWebhook(session.server_id,{embeds:[{title:"Guided Voice interview ready",description:"A recorded interview is ready for human review. This interview has no transcript or AI assessment.",color:0x27845f}]}); }
      catch { console.error("Guided interview notification failed",{sessionId:id}); }
    });
    return noStoreJson(data);
  } catch(error) { return noStoreJson({error:error instanceof Error ? error.message : "Submission unavailable."},{status:409}); }
}
