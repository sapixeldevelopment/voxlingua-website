import 'server-only';
import {createAdminClient} from '@/lib/supabase/admin';
import {sendDiscordWebhook} from '@/lib/discord-webhook';
import {isDiscordSnowflake} from '@/lib/discord';
import {applicantStatus} from '@/lib/service-status';
export async function deliverServiceNotifications() {
 const admin=createAdminClient();const {data:jobs,error}=await admin.rpc('claim_service_notifications');
 if(error)throw new Error('Notification queue unavailable');
 let delivered=0,failed=0;
 for(const job of jobs||[]) {
  let ok=false;
  try {
   if(job.kind==='review_reminder') {
    const {data:pref}=await admin.from('server_service_preferences').select('reminders_enabled').eq('server_id',job.server_id).maybeSingle();
    const {data:count,error:countError}=await admin.rpc('service_overdue_count',{p_server:job.server_id});
    if(countError)throw new Error('Reminder lookup failed');
    if(!pref?.reminders_enabled||!count)ok=true;
    else {const r=await sendDiscordWebhook(job.server_id,{content:`Dexlyy review reminder: ${count} application(s) have been waiting for review for over 48 hours. Open your private workspace: https://dexlyy.com/dashboard/servers/${job.server_id}`});ok=r.configured&&r.ok;}
   }else{
    const {data:pref,error:prefError}=await admin.from('application_notification_preferences').select('enabled').eq('application_id',job.application_id).maybeSingle();
    const {data:app,error:appError}=await admin.from('applications').select('status,discord_user_id').eq('id',job.application_id).maybeSingle();
    if(prefError||appError)throw new Error('Status lookup failed');
    if(!pref?.enabled||!app||job.event_key!==`${job.application_id}:${app.status}`)ok=true;
    else if(process.env.DISCORD_BOT_TOKEN&&isDiscordSnowflake(app.discord_user_id)) {
     const headers={Authorization:`Bot ${process.env.DISCORD_BOT_TOKEN}`,'Content-Type':'application/json'};
     const r=await fetch('https://discord.com/api/v10/users/@me/channels',{method:'POST',headers,body:JSON.stringify({recipient_id:app.discord_user_id}),signal:AbortSignal.timeout(5000)});
     if(r.ok){const dm=await r.json() as {id:string};if(!isDiscordSnowflake(dm.id))throw new Error('Invalid channel');const {data:session}=await admin.from('interview_sessions').select('id').eq('application_id',job.application_id).maybeSingle();
      const status=applicantStatus(app.status);const sent=await fetch(`https://discord.com/api/v10/channels/${dm.id}/messages`,{method:'POST',headers,body:JSON.stringify({content:`Dexlyy application update: ${status.title}. ${session?`View your private status: https://dexlyy.com/application-status/${session.id}`:''}`,allowed_mentions:{parse:[]},nonce:job.id.replaceAll('-','').slice(0,25),enforce_nonce:true}),signal:AbortSignal.timeout(5000)});ok=sent.ok;
     }
    }
   }
  }catch{ok=false;}
  if(ok){const {error:saveError}=await admin.from('service_notifications').update({delivered_at:new Date().toISOString()}).eq('id',job.id).eq('attempts',job.attempts);if(!saveError)delivered++;else failed++;}else failed++;
 }
 await admin.from('service_notifications').delete().lt('created_at',new Date(Date.now()-30*86400000).toISOString()).not('delivered_at','is',null);
 return {delivered,failed,processed:(jobs||[]).length};
}
