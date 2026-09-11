import {createClient} from '@/lib/supabase/server';
import {createAdminClient} from '@/lib/supabase/admin';
import {consumeRateLimit,isUuid,noStoreJson,readJsonBody,rejectCrossOrigin} from '@/lib/security';
async function ownSession(id:string) {
 if(!isUuid(id))return null;
 const client=await createClient();const {data:auth}=await client.auth.getUser();if(!auth.user)return null;
 const admin=createAdminClient();
 const {data:session}=await admin.from('interview_sessions').select('id,application_id,completed_at').eq('id',id).maybeSingle();
 if(!session)return null;
 const {data:application}=await admin.from('applications').select('id,server_id,status,created_at,reviewed_at').eq('id',session.application_id).eq('applicant_user_id',auth.user.id).maybeSingle();
 return application?{admin,application,session,user:auth.user}:null;
}
export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}) {
 const own=await ownSession((await params).id);if(!own)return noStoreJson({error:'Sign in with the Discord account used for this application.'},{status:404});
 const [server,pref]=await Promise.all([own.admin.from('servers').select('name,slug').eq('id',own.application.server_id).maybeSingle(),own.admin.from('application_notification_preferences').select('enabled').eq('application_id',own.application.id).maybeSingle()]);
 if(pref.error)return noStoreJson({error:'Status is temporarily unavailable.'},{status:503});
 // Deliberate projection: no notes, assignments, reviewer identity or error diagnostics.
 return noStoreJson({status:own.application.status,createdAt:own.application.created_at,submittedAt:own.session.completed_at,reviewedAt:own.application.reviewed_at,server:server.data,notifications:pref.data?.enabled||false});
}
export async function POST(request:Request,{params}:{params:Promise<{id:string}>}) {
 const cross=rejectCrossOrigin(request);if(cross)return cross;
 const own=await ownSession((await params).id);if(!own)return noStoreJson({error:'Application unavailable.'},{status:404});
 if(!await consumeRateLimit(`status-pref:${own.user.id}`,20,600))return noStoreJson({error:'Please wait.'},{status:429});
 const body=await readJsonBody<{enabled?:boolean}>(request,512);if(typeof body?.enabled!=='boolean')return noStoreJson({error:'Invalid preference.'},{status:400});
 const {error}=await own.admin.from('application_notification_preferences').upsert({application_id:own.application.id,enabled:body.enabled});
 return error?noStoreJson({error:'Preference could not save.'},{status:503}):noStoreJson({ok:true});
}
