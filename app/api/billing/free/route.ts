import {createClient} from "@/lib/supabase/server";
import {createAdminClient} from "@/lib/supabase/admin";
import {consumeRateLimit,noStoreJson,rejectCrossOrigin} from "@/lib/security";
export async function POST(request:Request) {
  const cross=rejectCrossOrigin(request); if(cross) return cross;
  const client=await createClient(); const {data:auth}=await client.auth.getUser();
  if(!auth.user) return noStoreJson({error:"Please sign in."},{status:401});
  if(!(await consumeRateLimit(`free-plan:${auth.user.id}`,5,3600))) return noStoreJson({error:"Please wait before trying again."},{status:429});
  const admin=createAdminClient();
  // Insert only: repeated requests cannot reset credits or replace a paid plan.
  const now=new Date();
  const nextMonth=new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth()+1,1)).toISOString().slice(0,10);
  const {error}=await admin.from("owner_billing").insert({user_id:auth.user.id,plan_key:"free",status:"active",monthly_interview_limit:5,daily_interview_limit:-1,server_limit:1,staff_limit:2,billing_interval:"month",subscription_period_end:nextMonth});
  if(error && error.code!=="23505") return noStoreJson({error:"Free plan could not be activated."},{status:500});
  return noStoreJson({ok:true});
}
