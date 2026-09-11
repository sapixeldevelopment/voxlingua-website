import InterviewApp from "@/components/interview-app";
import GuidedInterview from "@/components/guided-interview";
import {createClient} from "@/lib/supabase/server";

export default async function InterviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const client=await createClient();
  const {data:session}=await client.from("interview_sessions").select("interview_mode,status").eq("id",id).maybeSingle();
  if(session?.interview_mode==="guided") return <GuidedInterview sessionId={id} completed={session.status==="completed"}/>;
  return <InterviewApp sessionId={id} />;
}
