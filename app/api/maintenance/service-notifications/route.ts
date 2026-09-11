import {validCronAuthorization} from '@/lib/cron-auth';
import {noStoreJson} from '@/lib/security';
import {deliverServiceNotifications} from '@/lib/service-notifications';
export async function GET(request:Request) {
 if (!validCronAuthorization(request)) return noStoreJson({error:'Unauthorized.'},{status:401});
 try{return noStoreJson(await deliverServiceNotifications());}catch{return noStoreJson({error:'Notification queue unavailable.'},{status:503});}
}
