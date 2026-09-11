import 'server-only';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getServerRole } from '@/lib/access';
import { isUuid } from '@/lib/security';
export async function serviceAccess(id:string, kind:'server'|'application') {
  if(!isUuid(id)) return null;
  const client=await createClient(); const {data:auth}=await client.auth.getUser();
  if(!auth.user) return null;
  const admin=createAdminClient();
  const {data:application}=kind==='application' ? await admin.from('applications').select('id,server_id').eq('id',id).maybeSingle() : {data:null};
  const serverId=kind==='server'?id:application?.server_id;
  if(!serverId) return null;
  const role=await getServerRole(serverId,auth.user.id);
  return role ? {admin,user:auth.user,role,serverId} : null;
}
