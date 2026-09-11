import {serviceAccess} from '@/lib/service-access';
import {getVerifiedDiscordConnection} from '@/lib/discord-connection';
import {consumeRateLimit,noStoreJson,readJsonBody,rejectCrossOrigin} from '@/lib/security';
export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}) {
 const access=await serviceAccess((await params).id,'server');if(!access)return noStoreJson({error:'Workspace unavailable.'},{status:404});
 if(!await consumeRateLimit(`service-insights:${access.user.id}`,60,600))return noStoreJson({error:'Please wait before refreshing again.'},{status:429});
 const {admin,serverId}=access;
 const [s,c,q,f,metrics,pref]=await Promise.all([
  admin.from('servers').select('name,slug,owner_id,is_active,approved_role_id').eq('id',serverId).single(),getVerifiedDiscordConnection(serverId),
  admin.from('question_bank').select('id',{count:'exact',head:true}).eq('server_id',serverId).eq('is_active',true),
  admin.from('application_fields').select('id',{count:'exact',head:true}).eq('server_id',serverId).eq('is_active',true),
  admin.rpc('server_service_metrics',{p_server:serverId,p_actor:access.user.id}),
  admin.from('server_service_preferences').select('reminders_enabled').eq('server_id',serverId).maybeSingle(),
 ]);
 if(s.error||q.error||f.error||metrics.error||pref.error)return noStoreJson({error:'Service insights could not load.'},{status:503});
 const {data:billing}=await admin.from('owner_billing').select('plan_key,status,monthly_interview_limit,monthly_interviews_used,monthly_period_end,subscription_period_end').eq('user_id',s.data.owner_id).maybeSingle();
 const {count:webhooks}=await admin.from('server_discord_webhooks').select('server_id',{head:true,count:'exact'}).eq('server_id',serverId);
 const canConfigure=['owner','admin'].includes(access.role);
 return noStoreJson({setup:{discord:!!c,role:!!s.data.approved_role_id,questions:q.count||0,fields:f.count||0,active:s.data.is_active,webhook:!!webhooks,ai:!!process.env.OPENAI_API_KEY},metrics:metrics.data,billing,reminders:pref.data?.reminders_enabled||false,canConfigure,verifiedAt:c?.verified_at||null});
}
export async function POST(request:Request,{params}:{params:Promise<{id:string}>}) {
 const cross=rejectCrossOrigin(request);if(cross)return cross;
 const access=await serviceAccess((await params).id,'server');if(!access||!['owner','admin'].includes(access.role))return noStoreJson({error:'Configuration access required.'},{status:403});
 if(!await consumeRateLimit(`service-check:${access.user.id}`,10,600))return noStoreJson({error:'Please wait before checking again.'},{status:429});
 const body=await readJsonBody<{action?:string;enabled?:boolean}>(request,512);
 if(body?.action==='reminders'&&typeof body.enabled==='boolean') {
  const {error}=await access.admin.from('server_service_preferences').upsert({server_id:access.serverId,reminders_enabled:body.enabled});
  return error?noStoreJson({error:'Could not save reminder preference.'},{status:503}):noStoreJson({ok:true});
 }
 if(body?.action!=='check')return noStoreJson({error:'Invalid action.'},{status:400});
 const connection=await getVerifiedDiscordConnection(access.serverId);
 if(!connection||!process.env.DISCORD_BOT_TOKEN)return noStoreJson({error:'Connect and verify the Discord bot in portal settings.'},{status:422});
 try{
  const response=await fetch(`https://discord.com/api/v10/guilds/${connection.guild_id}/roles`,{headers:{Authorization:`Bot ${process.env.DISCORD_BOT_TOKEN}`},signal:AbortSignal.timeout(8000)});
  if(!response.ok)return noStoreJson({error:response.status===429?'Discord is busy. Try again shortly.':'The bot cannot read this server. Reconnect it in portal settings.'},{status:422});
  const roles=await response.json() as Array<{id:string}>;
  const {data:server}=await access.admin.from('servers').select('approved_role_id').eq('id',access.serverId).single();
  const role=roles.some(r=>r.id===server?.approved_role_id);
  return noStoreJson({ok:role,message:role?'Bot connection and approved role verified. Also ensure the bot has Manage Roles and sits above the approved role.':'The approved role no longer exists. Select a current role in settings.'});
 }catch{return noStoreJson({error:'Discord check timed out. Your saved configuration was not changed.'},{status:503});}
}
