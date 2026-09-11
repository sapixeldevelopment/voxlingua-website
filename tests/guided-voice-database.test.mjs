import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {PGlite} from "../.affiliate-tools/node_modules/@electric-sql/pglite/dist/index.js";
const db=new PGlite();
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,"0")}`;
await db.exec(`
create role anon; create role authenticated; create role service_role bypassrls;
create schema auth; create schema storage;
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('test.uid',true),'')::uuid$$;
create table public.servers(id uuid primary key,owner_id uuid,is_active boolean);
create table public.applications(id uuid primary key,applicant_user_id uuid,status text);
create table public.interview_sessions(id uuid primary key,server_id uuid,application_id uuid,status text,started_at timestamptz,
recording_path text,restart_count integer default 0,completed_at timestamptz,transcript jsonb default '[]',summary text,score numeric);
create table public.question_bank(id uuid,server_id uuid,is_active boolean);
create table public.owner_billing(id uuid primary key,user_id uuid,plan_key text constraint owner_billing_plan_key_check check(plan_key in ('starter')),
status text,subscription_period_end date,monthly_period_start date default current_date,monthly_period_end date default current_date+30,
monthly_interviews_used int default 0,monthly_interview_limit int,daily_period_start date default current_date,
daily_interview_limit int default -1,daily_interviews_used int default 0,prepaid_interviews int default 0);
create table storage.objects(bucket_id text,name text,metadata jsonb,updated_at timestamptz,unique(bucket_id,name));
create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
grant usage on schema public,auth,storage to authenticated,anon,service_role;
grant all on all tables in schema public,storage to service_role,authenticated;
`);
await db.exec(readFileSync(new URL("../supabase/migrations/20260902082621_fix_interview_submission_and_saved_recording_retry.sql",import.meta.url),"utf8"));
await db.exec(readFileSync(new URL("../supabase/migrations/20260908191541_guided_voice.sql",import.meta.url),"utf8"));
await db.query("insert into servers values ($1,$2,true)",[id(1),id(2)]);
await db.query("insert into owner_billing(id,user_id,plan_key,status,monthly_interview_limit) values ($1,$2,'flexi','active',2)",[id(3),id(2)]);
async function fixture(n,mode="guided",bytes=10000) {
  await db.query("insert into applications values ($1,$2,'interviewing')",[id(n),id(4)]);
  const path=`${id(1)}/${id(n)}/recording.webm`;
  await db.query("insert into interview_sessions(id,server_id,application_id,status,started_at,recording_path,interview_mode,guided_questions) values ($1,$2,$1,'in_progress',now()-interval '1 minute',$3,$4,'[\"A question\"]')",[id(n),id(1),path,mode]);
  await db.query("insert into storage.objects values ('interview-recordings',$1,$2,now())",[path,{size:bytes}]);
}
async function submit(n,user=4) {
  await db.exec("set role service_role");
  try{return (await db.query("select public.submit_guided_interview($1,$2) result",[id(n),id(user)])).rows[0].result;}
  finally{await db.exec("reset role");}
}
test("Guided submission stores no transcript and bills only once",async()=>{
  await fixture(10);
  assert.equal((await submit(10)).ok,true);
  assert.equal((await submit(10)).already_submitted,true);
  assert.equal((await db.query("select monthly_interviews_used n from owner_billing")).rows[0].n,1);
  const s=(await db.query("select transcript,summary,score from interview_sessions where id=$1",[id(10)])).rows[0];
  assert.deepEqual(s,{transcript:[],summary:null,score:null});
});
test("Another applicant and Realtime sessions cannot use guided submission",async()=>{
  await fixture(11);await assert.rejects(submit(11,99),/not found/);
  await fixture(12,"realtime");await assert.rejects(submit(12),/not found/);
});
test("Invalid audio is rejected without consuming credits",async()=>{
  await fixture(13,"guided",0);await assert.rejects(submit(13),/valid recording/);
});
test("Browser cannot call service RPC or mutate session mode",async()=>{
  await db.exec("set role authenticated");
  try{
    await assert.rejects(db.query("select public.submit_guided_interview($1,$2)",[id(11),id(4)]),/permission denied/);
    await assert.rejects(db.query("update interview_sessions set interview_mode='realtime' where id=$1",[id(11)]),/permission denied/);
  }finally{await db.exec("reset role");}
});
test("Legacy submission cannot create transcripts for Guided Voice",async()=>{
  await db.query("select set_config('test.uid',$1,false)",[id(4)]);
  await assert.rejects(db.query("select public.submit_interview($1,'[]')",[id(11)]),/Guided Voice/);
});
test("Quota exhaustion is enforced and repeated month rollover resets correctly",async()=>{
  assert.equal((await submit(11)).ok,true);
  await fixture(14);await assert.rejects(submit(14),/No interview credits/);
  await db.exec("update owner_billing set monthly_period_end=current_date-95");
  assert.equal((await submit(14)).ok,true);
  const row=(await db.query("select monthly_interviews_used n,monthly_period_end>current_date future from owner_billing")).rows[0];
  assert.deepEqual(row,{n:1,future:true});
});
test.after(()=>db.close());
