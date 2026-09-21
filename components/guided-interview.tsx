"use client";
import {useEffect,useRef,useState} from "react";
import {Headphones,Mic,Volume2,CheckCircle2} from "lucide-react";
import {fetchJsonWithTimeout,withTimeout} from "@/lib/client-request";
import InterviewRecovery, {useInterviewRecovery} from "@/components/interview-recovery";
import {uploadInterviewRecording} from "@/lib/recording-upload";

async function post<T=Record<string,unknown>>(url:string, body?:unknown) {
  const response=await fetchJsonWithTimeout<T & {error?:string}>(url,{method:"POST",headers:{"Content-Type":"application/json"},body:body===undefined?undefined:JSON.stringify(body)},45000,"The request timed out. Keep this page open and retry.");
  if(!response.ok || !response.data) throw new Error(typeof response.data?.error==='string'?response.data.error:"The server could not confirm this request. Keep this page open and retry.");
  return response.data;
}
export default function GuidedInterview({sessionId,completed=false}:{sessionId:string;completed?:boolean}) {
  const [phase,setPhase]=useState<"ready"|"question"|"answer"|"review"|"done">(completed?"done":"ready");
  const [questions,setQuestions]=useState<string[]>([]);
  const [index,setIndex]=useState(0);
  const [busy,setBusy]=useState(false), [error,setError]=useState(""), [saved,setSaved]=useState(false);
  const [remaining,setRemaining]=useState(1200);
  const audio=useRef<HTMLAudioElement|null>(null),recorder=useRef<MediaRecorder|null>(null);
  const stream=useRef<MediaStream|null>(null),context=useRef<AudioContext|null>(null);
  const microphone=useRef<GainNode|null>(null),chunks=useRef<Blob[]>([]),recording=useRef<Blob|null>(null);
  const serverId=useRef(""),started=useRef(0),urls=useRef<string[]>([]),stopPromise=useRef<Promise<Blob>|null>(null);
  const phaseRef=useRef(phase); phaseRef.current=phase;
  const busyRef=useRef(false);
  const uploaded=useRef(false);
  const recovery=useInterviewRecovery(sessionId);
  const [uploadProgress,setUploadProgress]=useState<number|null>(null);
  useEffect(()=>{
    const warn=(event:BeforeUnloadEvent)=>{if(started.current && phaseRef.current!=="done"){event.preventDefault();event.returnValue="";}};
    window.addEventListener("beforeunload",warn);
    return ()=>window.removeEventListener("beforeunload",warn);
  },[]);
  useEffect(()=>()=>{audio.current?.pause();stream.current?.getTracks().forEach(t=>t.stop());if(recorder.current?.state!=="inactive") recorder.current?.stop();void context.current?.close();urls.current.forEach(url=>URL.revokeObjectURL(url));},[]);
  useEffect(()=>{
    const timer=setInterval(()=>{
      if(!started.current || ["done","review"].includes(phaseRef.current)) return;
      const seconds=Math.max(0,1200-Math.floor((Date.now()-started.current)/1000));setRemaining(seconds);
      if(!seconds && !busyRef.current) void finish();
    },1000);
    return ()=>clearInterval(timer);
    // Timer uses refs so it never captures an outdated recorder.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[]);
  async function play(questionIndex:number) {
    if(!audio.current) return;
    if(microphone.current) microphone.current.gain.value=0;
    phaseRef.current="question";setPhase("question");
    const response=await fetch(`/api/guided/${sessionId}/speech`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({index:questionIndex}),signal:AbortSignal.timeout(45000)});
    if(!response.ok) {const result=await response.json();throw new Error(result.error || "Question could not play.");}
    const url=URL.createObjectURL(await response.blob());urls.current.push(url);
    audio.current.src=url;await audio.current.play();
  }
  async function action(fn:()=>Promise<void>) {
    if(busyRef.current) return;
    busyRef.current=true;setBusy(true);setError("");
    try {await fn();} catch(e){setError(e instanceof Error?e.message:"Please try again.");}
    finally {busyRef.current=false;setBusy(false);}
  }
  async function start() {
    await action(async()=>{
      if(!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) throw new Error("Use a browser that supports microphone recording.");
      stream.current=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true}});
      try {
        const result=await post<{serverId:string;startedAt:string;questions:string[]}>(`/api/guided/${sessionId}`);
        serverId.current=result.serverId;started.current=new Date(result.startedAt).getTime();
        recovery.prime({attempt:result.startedAt,serverId:result.serverId});
        if(Date.now()-started.current>=1200000) throw new Error("This attempt has expired. Start over to use your available restart.");
        setQuestions(result.questions);setIndex(0);
        const ctx=new AudioContext();context.current=ctx;await ctx.resume();
        const destination=ctx.createMediaStreamDestination();
        const gain=ctx.createGain();gain.gain.value=0;microphone.current=gain;
        ctx.createMediaStreamSource(stream.current!).connect(gain);gain.connect(destination);
        const speech=ctx.createMediaElementSource(audio.current!);speech.connect(destination);speech.connect(ctx.destination);
        const mimeType=["audio/webm;codecs=opus","audio/webm","audio/mp4"].find(t=>MediaRecorder.isTypeSupported(t));
        if(!mimeType) throw new Error("This browser cannot record supported audio.");
        const next=new MediaRecorder(destination.stream,{mimeType,audioBitsPerSecond:64000});recorder.current=next;chunks.current=[];
        next.ondataavailable=e=>{if(e.data.size)chunks.current.push(e.data);};
        stopPromise.current=new Promise((resolve,reject)=>{
          next.onstop=()=>{const blob=new Blob(chunks.current,{type:mimeType});recording.current=blob;resolve(blob);};
          next.onerror=()=>{setError("Recording failed. Please start over.");reject(new Error("Recording failed."));};
        });
        // Register rejection handler immediately; finish() also observes the error.
        void stopPromise.current.catch(()=>{});
        next.start(1000);
        await play(0);
      } catch(e) {if(!recorder.current)stream.current?.getTracks().forEach(t=>t.stop());throw e;}
    });
  }
  async function save() {
    // A delayed MediaRecorder onstop can still complete after the first wait.
    // Observe it again on retry instead of discarding the applicant's answers.
    if(!recording.current && stopPromise.current) await withTimeout(stopPromise.current,10000,"Recording is still finishing. Keep this page open and retry saving.");
    const blob=recording.current;
    if(!blob || blob.size<1000 || blob.size>15000000) throw new Error("A valid recording is required. Please start over.");
    const path=`${serverId.current}/${sessionId}/recording.webm`;
    if(!uploaded.current) {
      // The shared helper owns the timeout and aborts the actual XHR.
      const result=await uploadInterviewRecording(path,blob,setUploadProgress);
      if(result.error) throw new Error("Recording could not upload. Keep this page open and retry saving.");
      uploaded.current=true;
    }
    await post(`/api/interviews/${sessionId}/recording`,{path});
    setSaved(true);
  }
  async function finish() {
    await action(async()=>{
      audio.current?.pause();phaseRef.current="review";setPhase("review");
      if(recorder.current?.state!=="inactive") recorder.current?.stop();
      stream.current?.getTracks().forEach(t=>t.stop());
      if(stopPromise.current) await withTimeout(stopPromise.current,10000,"Recording is still finishing. Keep this page open and retry saving.");
      void context.current?.close().catch(()=>{});
      // Optional local recovery must never prevent the primary upload.
      if(recording.current)await withTimeout(recovery.save(recording.current,[],'guided'),6000,"Recovery copy unavailable.").catch(()=>{});
      await save();
    });
  }
  async function submit() {
    await action(async()=>{
      if(!saved){await save();return;}
      await post(`/api/guided/${sessionId}/submit`);
      phaseRef.current="done";setPhase("done");
      void recovery.clear().catch(()=>{});
    });
  }
  function questionEnded() {
    // A queued playback event must not reopen the microphone after finishing.
    if(phaseRef.current!=="question")return;
    phaseRef.current="answer";setPhase("answer");
    if(microphone.current)microphone.current.gain.value=1;
  }
  return <main className="guided-room">
    <InterviewRecovery sessionId={sessionId} recovery={recovery} progress={uploadProgress} disabled={busy||phase==='question'||phase==='answer'||phase==='done'} onRestore={copy=>{if(copy.mode!=='guided')return;recording.current=copy.blob;serverId.current=copy.serverId;started.current=new Date(copy.attempt).getTime();uploaded.current=false;setSaved(false);setUploadProgress(null);phaseRef.current='review';setPhase('review');setError('');}} />
    <header><span className="eyebrow">GUIDED VOICE · TEXT-TO-SPEECH</span><h1>Your voice.<br/>Your own pace.</h1><p>Listen to each prepared question, then record your answer. A human reviews your recording.</p></header>
    <section className="guided-card">
      <div className="guided-topline"><span><Headphones size={18}/> Guided interview</span><span>{Math.floor(remaining/60)}:{String(remaining%60).padStart(2,"0")} remaining</span></div>
      <audio ref={audio} onEnded={questionEnded} onError={()=>{if(phaseRef.current==="question")setError("Audio playback failed. Replay the question to try again.");}}/>
      {phase==="ready" ? <><h2>Make yourself comfortable.</h2><p>Questions use an AI-generated voice. Your answers stay as audio: no written transcript, AI review, scoring, or voice analysis. Recording starts when you begin, and uploads when you finish.</p><button className="btn btn-primary" disabled={busy} onClick={()=>void start()}>{busy?"Preparing…":"Check microphone & begin"}</button></> :
       phase==="done" ? <><CheckCircle2 size={44}/><h2>Interview submitted.</h2><p>Your recording is ready for the community’s review team. You can close this page.</p></> :
       phase==="review" ? <><h2>Your answers are recorded.</h2><p>{saved?"Recording saved. Submit it when you’re ready.":busy?"Saving your recording. Keep this page open until it is saved.":"Your recording has not been saved yet. Keep this page open and retry below."}</p><button className="btn btn-primary" disabled={busy} onClick={()=>void submit()}>{busy?(saved?"Submitting…":"Saving…"):saved?"Submit interview":"Retry saving recording"}</button></> :
       <><span className="eyebrow">QUESTION {index+1} OF {questions.length}</span><h2>{questions[index]}</h2><div className="guided-status">{phase==="question"?<><Volume2/> Listen to the question</>:<><Mic/> Recording your answer — take your time</>}</div><div className="guided-actions"><button className="btn btn-ghost" disabled={busy} onClick={()=>void action(()=>play(index))}>Replay question</button><button className="btn btn-primary" disabled={busy || phase!=="answer"} onClick={()=>{if(index===questions.length-1)void finish();else void action(async()=>{const next=index+1;setIndex(next);await play(next);});}}>{index===questions.length-1?"Finish interview":"Finish answer & continue"}</button></div></>}
      {phase!=="done" && <button className="btn btn-ghost" disabled={busy} onClick={()=>void action(async()=>{await post(`/api/interviews/${sessionId}/reset`);await recovery.clear();window.location.reload();})}>Start over · one restart available</button>}
      {error && <p role="alert" className="form-error">{error}</p>}
    </section>
    <p className="guided-privacy">Private recording · Human review · No transcripts or AI assessments</p>
  </main>;
}
