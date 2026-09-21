import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
function load(path,mocks={},globals={}) {
 const source=readFileSync(new URL(`../${path}`,import.meta.url),'utf8');
 const output=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;
 const exports={};vm.runInNewContext(output,{exports,require:n=>{if(!(n in mocks))throw new Error(n);return mocks[n];},Date,Error,Promise,Blob,Request,Response,URL,setTimeout,clearTimeout,AbortSignal,...globals});return exports;
}
const requests=load('lib/client-request.ts');
test('recording upload reports byte progress and sends credentials only to configured storage',async()=>{
 let sent;
 class XHR {headers={};upload={};open(method,url){this.method=method;this.url=url;}setRequestHeader(k,v){this.headers[k]=v;}send(blob){sent=this;this.upload.onprogress({lengthComputable:true,loaded:50,total:100});this.status=200;this.onload();}}
 const lib=load('lib/recording-upload.ts',{'@/lib/client-request':requests,'@/lib/supabase/client':{createClient:()=>({auth:{getSession:async()=>({data:{session:{access_token:'synthetic-token'}}})}})}},{XMLHttpRequest:XHR,navigator:{onLine:true},process:{env:{NEXT_PUBLIC_SUPABASE_URL:'https://example.supabase.co',NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:'synthetic-public'}}});
 const progress=[];await lib.uploadInterviewRecording('server/session/recording.webm',new Blob(['test']),n=>progress.push(n));
 assert.deepEqual(progress,[0,50,100]);assert.equal(sent.timeout,120000);assert.equal(sent.headers.Authorization,'Bearer synthetic-token');assert.match(sent.url,/^https:\/\/example.supabase.co\/storage\/v1\/object\/interview-recordings\//);
});
test('upload timeout and offline state fail safely instead of reporting success',async()=>{
 let sent=0;
 class XHR {upload={};open(){}setRequestHeader(){}send(){sent++;this.ontimeout();}}
 const mocks={'@/lib/client-request':requests,'@/lib/supabase/client':{createClient:()=>({auth:{getSession:async()=>({data:{session:{access_token:'synthetic-token'}}})}})}};
 const globals={XMLHttpRequest:XHR,navigator:{onLine:true},process:{env:{NEXT_PUBLIC_SUPABASE_URL:'https://example.supabase.co',NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:'public'}}};
 await assert.rejects(load('lib/recording-upload.ts',mocks,globals).uploadInterviewRecording('s/i/recording.webm',new Blob(['test']),()=>{}),/timed out/);
 globals.navigator.onLine=false;
 await assert.rejects(load('lib/recording-upload.ts',mocks,globals).uploadInterviewRecording('s/i/recording.webm',new Blob(['test']),()=>{}),/offline/);
 assert.equal(sent,1);
});

test('MediaRecorder codec parameters are removed without changing audio bytes or container',async()=>{
 for(const [mime,expected] of [['audio/webm;codecs=opus','audio/webm'],['audio/mp4;codecs=mp4a.40.2','audio/mp4'],['audio/ogg; codecs=opus','audio/ogg']]) {
  let sent;
  class XHR {headers={};upload={};open(){}setRequestHeader(k,v){this.headers[k]=v;}send(blob){sent=blob;this.status=['audio/webm','audio/mp4','audio/ogg','audio/wav'].includes(this.headers['Content-Type'])?200:415;this.onload();}}
  const lib=load('lib/recording-upload.ts',{'@/lib/client-request':requests,'@/lib/supabase/client':{createClient:()=>({auth:{getSession:async()=>({data:{session:{access_token:'test'}}})}})}},{XMLHttpRequest:XHR,navigator:{onLine:true},process:{env:{NEXT_PUBLIC_SUPABASE_URL:'https://example.supabase.co',NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:'public'}}});
  const blob=new Blob(['original audio bytes'],{type:mime});
  assert.equal((await lib.uploadInterviewRecording('s/i/recording.webm',blob,()=>{})).error,null);
  assert.equal(sent,blob);assert.equal(sent.type,mime.toLowerCase());assert.equal(mime.split(';')[0],expected);
 }
});

test('storage failures explain recovery without exposing provider details or reporting completion',async()=>{
 const cases=[
  [400,{code:'InvalidMimeType',message:'mime type audio/webm;codecs=opus is not supported'},/audio format/],
  [400,{error:'Unauthorized',message:'new row violates row-level security policy'},/authorize/],
  [401,{code:'InvalidJWT'},/another tab/],
  [413,{code:'EntityTooLarge'},/size limit/],
  [429,{},/wait a moment/],
  [503,'<html>private infrastructure details</html>',/temporarily unavailable/],
  [418,{message:'private internal SQL detail'},/HTTP 418/],
 ];
 for(const [status,body,expected] of cases){
  class XHR {upload={};open(){}setRequestHeader(){}send(){this.status=status;this.responseText=typeof body==='string'?body:JSON.stringify(body);this.onload();}}
  const lib=load('lib/recording-upload.ts',{'@/lib/client-request':requests,'@/lib/supabase/client':{createClient:()=>({auth:{getSession:async()=>({data:{session:{access_token:'test'}}})}})}},{XMLHttpRequest:XHR,navigator:{onLine:true},process:{env:{NEXT_PUBLIC_SUPABASE_URL:'https://example.supabase.co',NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:'public'}}});
  const progress=[];
  await assert.rejects(lib.uploadInterviewRecording('s/i/recording.webm',new Blob(['test']),n=>progress.push(n)),e=>{assert.match(e.message,expected);assert.doesNotMatch(e.message,/private|<html>/);return true;});
  assert.ok(!progress.includes(100));
 }
});
test('status labels separate pending role assignment from approved access',()=>{
 const {applicantStatus}=load('lib/service-status.ts');
 assert.equal(applicantStatus('role_failed').step,2);assert.equal(applicantStatus('role_assigned').step,3);assert.match(applicantStatus('declined').title,/declined/);assert.equal(applicantStatus('interviewing').step,1);
});
test('all question templates fit the interview cap and application fields use unique safe keys',()=>{
 const {QUESTION_TEMPLATES,APPLICATION_TEMPLATES}=load('lib/question-templates.ts');
 for(const t of QUESTION_TEMPLATES){assert.ok(t.questions.length<=8);for(const q of t.questions)assert.ok(q.length>10&&q.length<2000);}
 const keys=APPLICATION_TEMPLATES.flatMap(t=>t.fields.map(f=>f.key));assert.equal(keys.length,new Set(keys).size);assert.ok(keys.every(k=>/^[a-z_]+$/.test(k)));
});
test('review endpoints reject cross-origin writes before reading application data',async()=>{
 let access=0;const api=load('app/api/applications/[id]/work/route.ts',{'@/lib/service-access':{serviceAccess:async()=>{access++;}},'@/lib/security':{rejectCrossOrigin:()=>new Response(null,{status:403})}});
 const r=await api.POST(new Request('https://dexlyy.com/api/applications/id/work',{method:'POST'}),{params:Promise.resolve({id:'id'})});assert.equal(r.status,403);assert.equal(access,0);
});
test('unauthorised reviewers cannot read private notes',async()=>{
 const api=load('app/api/applications/[id]/work/route.ts',{'@/lib/service-access':{serviceAccess:async()=>null},'@/lib/security':{noStoreJson:(v,init)=>Response.json(v,init)}});
 assert.equal((await api.GET(new Request('https://dexlyy.com'),{params:Promise.resolve({id:'id'})})).status,404);
});

test('applicant status and recovery reject another applicant without returning private data',async()=>{
 for(const path of ['app/api/applicant/status/[id]/route.ts','app/api/interviews/[id]/recovery/route.ts']) {
  const checks=[];
  const admin={from(table){const chain={select(){return chain;},eq(k,v){checks.push([table,k,v]);return chain;},async maybeSingle(){return {data:table==='interview_sessions'?{id:'session',application_id:'application',server_id:'server',started_at:'2026-09-01',interview_mode:'guided'}:null};}};return chain;}};
  const api=load(path,{'@/lib/supabase/server':{createClient:async()=>({auth:{getUser:async()=>({data:{user:{id:'different-applicant'}}})}})},'@/lib/supabase/admin':{createAdminClient:()=>admin},'@/lib/security':{isUuid:()=>true,noStoreJson:(value,init)=>Response.json(value,init)}});
  const response=await api.GET(new Request('https://dexlyy.com'),{params:Promise.resolve({id:'session'})});
  assert.equal(response.status,404);
  assert.ok(checks.some(([table,key,value])=>table==='applications'&&key==='applicant_user_id'&&value==='different-applicant'));
  assert.deepEqual(Object.keys(await response.json()),['error']);
 }
});
test('notification maintenance requires the cron credential before claiming jobs',async()=>{
 let called=0;const api=load('app/api/maintenance/service-notifications/route.ts',{'@/lib/cron-auth':{validCronAuthorization:()=>false},'@/lib/security':{noStoreJson:(v,init)=>Response.json(v,init)},'@/lib/service-notifications':{deliverServiceNotifications:()=>{called++;}}});
 assert.equal((await api.GET(new Request('https://dexlyy.com'))).status,401);assert.equal(called,0);
});
