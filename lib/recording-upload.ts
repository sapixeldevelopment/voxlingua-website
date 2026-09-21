import {createClient} from '@/lib/supabase/client';
import {withTimeout} from '@/lib/client-request';

function uploadError(status:number, response:string):string {
 let code='', message='';
 try {const body=JSON.parse(response);code=String(body?.code||body?.error||'');message=String(body?.message||'');} catch {/* Proxies can return HTML, never display it. */}
 if(status===401 || /InvalidJWT|JWT.*expired/i.test(code+' '+message)) return 'Your sign-in has expired. Keep this page open, sign in again in another tab, then retry saving.';
 if(status===413 || /EntityTooLarge|PayloadTooLarge/i.test(code)) return 'The recording exceeds the storage size limit. Keep this page open and contact support.';
 if(status===415 || /InvalidMimeType|mime type/i.test(code+' '+message)) return 'Storage rejected the audio format. Keep this page open and contact support.';
 if(status===403 || /AccessDenied|row.level security|Unauthorized/i.test(code+' '+message)) return 'Storage could not authorize this recording. Keep this page open and check that you are signed in as the original applicant.';
 if(status===429) return 'Storage is busy. Keep this page open, wait a moment, then retry saving.';
 if(status>=500) return 'Recording storage is temporarily unavailable. Keep this page open and retry saving.';
 return `Recording upload failed (HTTP ${status}). Keep this page open and retry. Contact support if it continues.`;
}
/** Real byte progress; timeout aborts the upload instead of leaving it running. */
export async function uploadInterviewRecording(path:string,blob:Blob,onProgress:(percent:number)=>void) {
 const {data}=await withTimeout(createClient().auth.getSession(),8000,'Session check timed out. Please retry.');
 if(!data.session?.access_token)throw new Error('Your session expired. Sign in again before saving.');
 const base=process.env.NEXT_PUBLIC_SUPABASE_URL;
 const key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
 if(!base||!key)throw new Error('Recording storage is unavailable.');
 if(!navigator.onLine)throw new Error('You’re offline. Keep this page open and retry when connected.');
 // MediaRecorder includes codec parameters. Storage compares MIME types exactly;
 // retain the actual container type but omit parameters from the HTTP header.
 const contentType=(blob.type||'audio/webm').split(';')[0].trim().toLowerCase();
 if(!['audio/webm','audio/mp4','audio/ogg','audio/wav'].includes(contentType)) throw new Error('This recording format is unsupported. Keep this page open and contact support.');
 return new Promise<{error:{message:string}|null}>((resolve,reject)=>{
  const xhr=new XMLHttpRequest();
  xhr.open('POST',`${base}/storage/v1/object/interview-recordings/${path.split('/').map(encodeURIComponent).join('/')}`);
  xhr.setRequestHeader('Authorization',`Bearer ${data.session.access_token}`);
  xhr.setRequestHeader('apikey',key);xhr.setRequestHeader('x-upsert','true');xhr.setRequestHeader('Content-Type',contentType);
  // A 20-minute Guided recording can approach 10 MB. Allow slower connections
  // a bounded two-minute upload, while still aborting stalled requests.
  xhr.timeout=120000;
  xhr.upload.onprogress=e=>{if(e.lengthComputable)onProgress(Math.min(99,Math.round(e.loaded/e.total*100)));};
  xhr.onload=()=>{if(xhr.status>=200&&xhr.status<300){onProgress(100);resolve({error:null});}else reject(new Error(uploadError(xhr.status,xhr.responseText)));};
  xhr.onerror=()=>reject(new Error('Connection lost during upload. Keep this page open and retry.'));
  xhr.ontimeout=()=>reject(new Error('Upload timed out and was stopped. Check your connection and retry.'));
  xhr.onabort=()=>reject(new Error('Upload stopped. Your recording can be retried.'));
  onProgress(0);xhr.send(blob);
 });
}
