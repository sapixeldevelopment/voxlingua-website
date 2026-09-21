import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

function load(path,mocks={},globals={},transform=s=>s){
 const source=transform(readFileSync(new URL(`../${path}`,import.meta.url),'utf8'));
 const js=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;
 const exports={};vm.runInNewContext(js,{exports,require:n=>{if(!(n in mocks))throw Error(`Missing mock ${n}`);return mocks[n];},Date,Error,Blob,Response,Request,URL,setTimeout,clearTimeout,AbortController,...globals});return exports;
}
function room({upload=async()=>({error:null}),fetcher=async()=>Response.json({ok:true}),recovery={}}={}){
 const slots=[];let cursor=0,uploads=0;
 const react={useState(initial){const key=cursor++;if(!(key in slots))slots[key]=initial;return [slots[key],v=>{slots[key]=typeof v==='function'?v(slots[key]):v;}];},useRef(initial){return slots[cursor++]||=( {current:initial});},useEffect(){cursor++;}};
 const requests=load('lib/client-request.ts',{}, {fetch:fetcher});
 const component=load('components/guided-interview.tsx',{
  react,'react/jsx-runtime':{},'lucide-react':{},'@/lib/client-request':requests,
  '@/components/interview-recovery':{useInterviewRecovery:()=>({save:async()=>{},clear:async()=>{},prime(){},...recovery})},
  '@/lib/recording-upload':{uploadInterviewRecording:async(...args)=>{uploads++;return upload(...args);}},
 },{},source=>source.replace(',6000,"Recovery copy unavailable."',',10,"Recovery copy unavailable."').replace('  return <main className="guided-room">',`  return {finish,save,submit,action,questionEnded,snapshot:{phase,busy,error,saved},refs:{recording,serverId,stopPromise,recorder,phaseRef,microphone}};
 return <main className="guided-room">`));
 const render=()=>{cursor=0;return component.default({sessionId:'session'});};
 const r=render();r.refs.recording.current=new Blob(['x'.repeat(2000)],{type:'audio/webm;codecs=opus'});r.refs.serverId.current='server';
 return {render,uploads:()=>uploads};
}

test('guided failed upload retains audio and unlocks retry, then saves and submits',async()=>{
 let attempts=0;const r=room({upload:async()=>{if(++attempts===1)throw Error('Storage temporarily unavailable');return {error:null};}});
 const blob=r.render().refs.recording.current;
 await r.render().finish();
 assert.equal(r.render().snapshot.busy,false);assert.equal(r.render().snapshot.saved,false);assert.equal(r.render().snapshot.phase,'review');assert.equal(r.render().refs.recording.current,blob);
 await r.render().submit();assert.equal(r.render().snapshot.saved,true);assert.equal(r.render().snapshot.phase,'review');
 await r.render().submit();assert.equal(r.render().snapshot.phase,'done');assert.equal(r.uploads(),2);
});

test('guided link failure retries linking, not the completed upload',async()=>{
 let calls=0;const r=room({fetcher:async()=>++calls===1?Response.json({error:'Link unavailable'},{status:503}):Response.json({ok:true})});
 await r.render().finish();assert.equal(r.render().snapshot.saved,false);
 await r.render().submit();assert.equal(r.render().snapshot.saved,true);assert.equal(r.uploads(),1);assert.equal(calls,2);
});

test('optional recovery errors and a stalled recovery store do not prevent upload',async()=>{
 for(const save of [async()=>{throw Error('No space');},()=>new Promise(()=>{})]){
  const r=room({recovery:{save}});await r.render().finish();
  assert.equal(r.render().snapshot.saved,true);assert.equal(r.render().snapshot.error,'');assert.equal(r.uploads(),1);
 }
});

test('successful submission is shown even when recovery deletion fails',async()=>{
 const r=room({recovery:{clear:async()=>{throw Error('Unavailable');}}});await r.render().finish();await r.render().submit();
 assert.equal(r.render().snapshot.phase,'done');assert.equal(r.render().snapshot.busy,false);
});

test('guided non-JSON server failures show a safe retry message and preserve saved audio',async()=>{
 const r=room({fetcher:async()=>new Response('<html>upstream failure</html>',{status:502})});await r.render().finish();
 assert.match(r.render().snapshot.error,/could not confirm/);assert.doesNotMatch(r.render().snapshot.error,/JSON|html/);assert.equal(r.render().snapshot.busy,false);
});

test('guided double clicks cannot create overlapping saves',async()=>{
 let release;const r=room({upload:()=>new Promise(resolve=>{release=resolve;})});
 const first=r.render().submit();await r.render().submit();assert.equal(r.uploads(),1);
 release({error:null});await first;assert.equal(r.render().snapshot.saved,true);
});

test('retry observes a delayed final recorder chunk before uploading',async()=>{
 const r=room();const blob=r.render().refs.recording.current;r.render().refs.recording.current=null;
 r.render().refs.stopPromise.current=new Promise(resolve=>setTimeout(()=>{r.render().refs.recording.current=blob;resolve(blob);},5));
 await r.render().submit();assert.equal(r.render().snapshot.saved,true);assert.equal(r.uploads(),1);
});

test('late playback events cannot reopen the microphone after finishing',async()=>{
 const r=room();r.render().refs.microphone.current={gain:{value:0}};
 const current=r.render();current.refs.phaseRef.current='question';current.questionEnded();assert.equal(r.render().snapshot.phase,'answer');
 await r.render().finish();r.render().refs.microphone.current.gain.value=0;
 r.render().questionEnded();assert.equal(r.render().snapshot.phase,'review');assert.equal(r.render().refs.microphone.current.gain.value,0);
});

function recordingRoute({owner='applicant',status='in_progress',changed=false}={}){
 const filters=[];let writes=0,lists=0;
 const path='server/session/recording.webm';
 const admin={from(table){let updating=false;const chain={select(){return chain;},eq(k,v){filters.push([k,v]);return chain;},update(){updating=true;writes++;return chain;},async maybeSingle(){return {data:updating?(changed?null:{id:'session'}):table==='applications'?{applicant_user_id:owner}:{id:'session',server_id:'server',application_id:'application',status,recording_path:path,restart_count:1}};}};return chain;},storage:{from(){return {list:async()=>{lists++;return {data:[{name:'recording.webm'}]};}};}}};
 const route=load('app/api/interviews/[id]/recording/route.ts',{
  '@/lib/supabase/admin':{createAdminClient:()=>admin},'@/lib/supabase/server':{createClient:async()=>({auth:{getUser:async()=>({data:{user:{id:'applicant'}}})}})},
  '@/lib/security':{rejectCrossOrigin:()=>null,isUuid:()=>true,consumeRateLimit:async()=>true,readJsonBody:r=>r.json(),noStoreJson:Response.json},
 });
 return {filters,writes:()=>writes,lists:()=>lists,call:(body={path})=>route.POST(new Request('https://example.test/api/recording',{method:'POST',body:JSON.stringify(body)}),{params:Promise.resolve({id:'session'})})};
}
test('recording linking enforces applicant ownership and exact path',async()=>{
 const foreign=recordingRoute({owner:'other'});assert.equal((await foreign.call()).status,404);assert.equal(foreign.writes(),0);assert.equal(foreign.lists(),0);
 const r=recordingRoute();assert.equal((await r.call({path:{}})).status,400);assert.equal((await r.call({path:'foreign/recording.webm'})).status,400);assert.equal(r.writes(),0);
});
test('recording linking uses status and restart compare-and-set, rejecting stale attempts',async()=>{
 const ok=recordingRoute();assert.equal((await ok.call()).status,200);assert.ok(ok.filters.some(([k,v])=>k==='status'&&v==='in_progress'));assert.ok(ok.filters.some(([k,v])=>k==='restart_count'&&v===1));
 assert.equal((await recordingRoute({changed:true}).call()).status,409);
});
test('retrying a completed recording link is idempotent and never changes storage',async()=>{
 const r=recordingRoute({status:'completed'});assert.equal((await r.call()).status,200);assert.equal(r.writes(),0);assert.equal(r.lists(),0);
});
