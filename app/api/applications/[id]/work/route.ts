import {serviceAccess} from '@/lib/service-access';
import {consumeRateLimit,isUuid,noStoreJson,readJsonBody,rejectCrossOrigin} from '@/lib/security';
export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}) {
 const {id}=await params; const access=await serviceAccess(id,'application');
 if(!access)return noStoreJson({error:'Application unavailable.'},{status:404});
 const {admin,serverId}=access;
 const [work,notes,members]=await Promise.all([
  admin.from('application_review_work').select('assignee_id').eq('application_id',id).maybeSingle(),
  admin.from('application_team_notes').select('id,body,author_id,created_at').eq('application_id',id).order('created_at',{ascending:false}).limit(50),
  admin.from('server_members').select('user_id,role').eq('server_id',serverId).in('role',['owner','admin','reviewer']),
 ]);
 if(work.error||notes.error||members.error)return noStoreJson({error:'Team workspace could not load.'},{status:503});
 const ids=[...new Set([...(members.data||[]).map(m=>m.user_id),...(notes.data||[]).map(n=>n.author_id).filter(Boolean)])];
 const {data:profiles}=ids.length?await admin.from('profiles').select('id,display_name').in('id',ids):{data:[]};
 const names=new Map((profiles||[]).map(p=>[p.id,p.display_name]));
 return noStoreJson({assignee:work.data?.assignee_id||'',members:(members.data||[]).map(m=>({...m,name:names.get(m.user_id)||`Team member • ${m.user_id.slice(-6)}`})),notes:(notes.data||[]).map(n=>({...n,author:names.get(n.author_id)||'Former team member'}))});
}
export async function POST(request:Request,{params}:{params:Promise<{id:string}>}) {
 const cross=rejectCrossOrigin(request);if(cross)return cross;
 const {id}=await params;const access=await serviceAccess(id,'application');
 if(!access)return noStoreJson({error:'Application unavailable.'},{status:404});
 if(!await consumeRateLimit(`review-work:${access.user.id}`,40,600))return noStoreJson({error:'Please wait before trying again.'},{status:429});
 const body=await readJsonBody<{assignee?:string|null;note?:string}>(request,10000);
 if(!body|| (body.assignee!==undefined && body.assignee!==null && !isUuid(body.assignee)) || (body.note!==undefined && (typeof body.note!=='string'||!body.note.trim()||body.note.length>2000)) || (body.assignee===undefined&&body.note===undefined))return noStoreJson({error:'Invalid review update.'},{status:400});
 const {error}=await access.admin.rpc('save_application_review_work',{p_application:id,p_actor:access.user.id,p_assign:body.assignee!==undefined,p_assignee:body.assignee||null,p_note:body.note?.trim()||null});
 return error?noStoreJson({error:'Could not save. Refresh and check the reviewer still has access.'},{status:409}):noStoreJson({ok:true});
}
