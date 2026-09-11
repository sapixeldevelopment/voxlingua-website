import {createClient} from '@/lib/supabase/server';
import {createAdminClient} from '@/lib/supabase/admin';
import {isUuid,noStoreJson} from '@/lib/security';
export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}) {
 const {id}=await params;if(!isUuid(id))return noStoreJson({error:'Interview unavailable.'},{status:404});
 const {data:auth}=await (await createClient()).auth.getUser();if(!auth.user)return noStoreJson({error:'Sign in first.'},{status:401});
 const admin=createAdminClient();const {data:s}=await admin.from('interview_sessions').select('server_id,application_id,status,started_at,interview_mode').eq('id',id).maybeSingle();
 if(!s)return noStoreJson({error:'Interview unavailable.'},{status:404});
 const {data:a}=await admin.from('applications').select('id').eq('id',s.application_id).eq('applicant_user_id',auth.user.id).maybeSingle();
 if(!a)return noStoreJson({error:'Interview unavailable.'},{status:404});
 return noStoreJson({serverId:s.server_id,status:s.status,attempt:s.started_at,mode:s.interview_mode});
}
