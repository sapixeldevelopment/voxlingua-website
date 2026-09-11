import {createClient} from '@/lib/supabase/client';
import {withTimeout} from '@/lib/client-request';
/** Real byte progress; timeout aborts the upload instead of leaving it running. */
export async function uploadInterviewRecording(path:string,blob:Blob,onProgress:(percent:number)=>void) {
 const {data}=await withTimeout(createClient().auth.getSession(),8000,'Session check timed out. Please retry.');
 if(!data.session?.access_token)throw new Error('Your session expired. Sign in again before saving.');
 const base=process.env.NEXT_PUBLIC_SUPABASE_URL;
 const key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
 if(!base||!key)throw new Error('Recording storage is unavailable.');
 if(!navigator.onLine)throw new Error('You’re offline. Keep this page open and retry when connected.');
 return new Promise<{error:{message:string}|null}>((resolve,reject)=>{
  const xhr=new XMLHttpRequest();
  xhr.open('POST',`${base}/storage/v1/object/interview-recordings/${path.split('/').map(encodeURIComponent).join('/')}`);
  xhr.setRequestHeader('Authorization',`Bearer ${data.session.access_token}`);
  xhr.setRequestHeader('apikey',key);xhr.setRequestHeader('x-upsert','true');xhr.setRequestHeader('Content-Type',blob.type||'audio/webm');
  xhr.timeout=35000;
  xhr.upload.onprogress=e=>{if(e.lengthComputable)onProgress(Math.min(99,Math.round(e.loaded/e.total*100)));};
  xhr.onload=()=>{if(xhr.status>=200&&xhr.status<300){onProgress(100);resolve({error:null});}else reject(new Error('Recording upload failed. Keep this page open and retry.'));};
  xhr.onerror=()=>reject(new Error('Connection lost during upload. Keep this page open and retry.'));
  xhr.ontimeout=()=>reject(new Error('Upload timed out and was stopped. Check your connection and retry.'));
  xhr.onabort=()=>reject(new Error('Upload stopped. Your recording can be retried.'));
  onProgress(0);xhr.send(blob);
 });
}
