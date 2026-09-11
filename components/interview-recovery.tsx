"use client";
import {useEffect,useRef,useState} from 'react';
import Link from 'next/link';
import {createClient} from '@/lib/supabase/client';
import {RecoveryCopy,recoveryStore} from '@/lib/interview-recovery';
import {fetchJsonWithTimeout} from '@/lib/client-request';
export function useInterviewRecovery(sessionId:string) {
 const [enabled,setEnabled]=useState(false),[copy,setCopy]=useState<RecoveryCopy|null>(null),[message,setMessage]=useState(''),[online,setOnline]=useState(true);
 const userId=useRef(''),optedIn=useRef(false);
 const attemptInfo=useRef<{attempt:string;serverId:string}|null>(null);
 useEffect(()=>{
  const update=()=>setOnline(navigator.onLine);update();window.addEventListener('online',update);window.addEventListener('offline',update);
  let active=true;
  void createClient().auth.getUser().then(async({data})=>{if(!active||!data.user)return;userId.current=data.user.id;try{const value=await recoveryStore('read',`${data.user.id}:${sessionId}`);if(active)setCopy(value);}catch{/* Recovery is optional; ordinary recording still works. */}}).catch(()=>{});
  return()=>{active=false;window.removeEventListener('online',update);window.removeEventListener('offline',update);};
 },[sessionId]);
 async function clear(){if(userId.current)await recoveryStore('delete',`${userId.current}:${sessionId}`).catch(()=>{});setCopy(null);}
 async function save(blob:Blob,lines:RecoveryCopy['lines'],mode:RecoveryCopy['mode']) {
  if(!optedIn.current||!userId.current)return;
  try{
   if(!attemptInfo.current?.attempt)throw new Error('Recovery could not be verified.');
   const value:RecoveryCopy={key:`${userId.current}:${sessionId}`,userId:userId.current,sessionId,attempt:attemptInfo.current.attempt,serverId:attemptInfo.current.serverId,mode,blob,lines:mode==='guided'?[]:lines,expires:Date.now()+86400000};
   await recoveryStore('write',value.key,value);
   if(!optedIn.current){await recoveryStore('delete',value.key);return;}
   setMessage('A completed-recording recovery copy is saved on this device. It can be restored for up to 24 hours, within the upload deadline.');
  }catch{setMessage('The recovery copy could not be saved. Keep this page open until submission succeeds.');}
 }
 async function restore(onRestore:(copy:RecoveryCopy)=>void){if(!copy)return;try{
  const auth=await createClient().auth.getUser();if(auth.data.user?.id!==copy.userId)throw new Error('Sign in with the original applicant account.');
  const r=await fetchJsonWithTimeout<{attempt:string;status:string;mode:string}>(`/api/interviews/${sessionId}/recovery`,{cache:'no-store'},10000,'Recovery check timed out.');
  if(!r.ok||!r.data)throw new Error('Recovery is temporarily unavailable.');
    if(r.data.status==='completed'||r.data.attempt!==copy.attempt||r.data.mode!==copy.mode||copy.expires<Date.now()){await clear();throw new Error('This saved copy no longer matches the current attempt.');}
  onRestore(copy);setCopy(null);setMessage('Recording restored. Review and submit it; nothing was submitted automatically.');
 }catch(e){setMessage(e instanceof Error?e.message:'Recovery failed.');}}
 return {enabled,copy,message,online,save,restore,clear,prime:(info:{attempt:string;serverId:string})=>{attemptInfo.current=info;},toggle:(value:boolean)=>{optedIn.current=value;setEnabled(value);if(!value){void clear();setMessage('Recovery copies removed from this device.');}}};
}
export default function InterviewRecovery({sessionId,recovery,onRestore,disabled=false,progress=null}:{sessionId:string;recovery:ReturnType<typeof useInterviewRecovery>;onRestore:(copy:RecoveryCopy)=>void;disabled?:boolean;progress?:number|null}) {
 return <section className="recovery-panel">{!recovery.online&&<p role="alert">You’re offline. Keep this page open. Upload and submission will need a connection.</p>}{progress!==null&&<div role="status"><span>Recording upload: {progress}%</span><progress value={progress} max={100}/></div>}<label className="service-checkbox"><input type="checkbox" checked={recovery.enabled} disabled={disabled} onChange={e=>recovery.toggle(e.target.checked)}/>Keep a recovery copy of my completed interview on this device</label><small>Optional. Don’t enable on shared devices. Copies expire after 24 hours and are cleared after submission or restart. Upload deadlines still apply. Closing the page during a live conversation cannot be recovered.</small>{recovery.copy&&<button className="btn btn-ghost" disabled={disabled} onClick={()=>void recovery.restore(onRestore)}>Recover completed recording</button>}{recovery.message&&<p role="status">{recovery.message}</p>}<Link href={`/application-status/${sessionId}`} target="_blank" rel="noreferrer">View application status & Discord notification preferences →</Link></section>;
}
