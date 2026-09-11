import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PGlite} from '../.affiliate-tools/node_modules/@electric-sql/pglite/dist/index.js';
const db=new PGlite();
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;
create table auth.users(id uuid primary key);
create table servers(id uuid primary key,is_active boolean default true);
create table applications(id uuid primary key,server_id uuid references servers(id),status text,created_at timestamptz default now(),reviewed_at timestamptz);
create table server_members(server_id uuid,user_id uuid,role text);
create table interview_sessions(id uuid primary key,application_id uuid unique references applications(id),status text,started_at timestamptz,completed_at timestamptz);
grant usage on schema public,auth to anon,authenticated,service_role;grant all on all tables in schema public,auth to service_role;`);
await db.exec(readFileSync(new URL('../supabase/migrations/20260911162143_service_workflow.sql',import.meta.url),'utf8'));
await db.query(`insert into auth.users values($1),($2),($3);`,[id(1),id(2),id(3)]);
await db.query(`insert into servers(id) values($1),($2)`,[id(10),id(20)]);
await db.query(`insert into server_members values($1,$2,'owner'),($1,$3,'reviewer'),($4,$5,'owner')`,[id(10),id(1),id(2),id(20),id(3)]);
await db.query(`insert into applications(id,server_id,status,created_at) values($1,$2,'interviewing',now()-interval '3 days'),($3,$2,'interviewing',now()-interval '3 days')`,[id(100),id(10),id(101)]);
async function sql(q,args=[]){return db.query(q,args);}
test('private notes, assignments and queues deny both browser roles',async()=>{
 for(const role of ['anon','authenticated'])for(const table of ['application_team_notes','application_review_work','service_notifications','application_notification_preferences','server_service_preferences']){
  const r=await sql(`select has_table_privilege($1,$2,'select') as allowed`,[role,table]);assert.equal(r.rows[0].allowed,false);
 }
 const r=await sql(`select has_function_privilege('authenticated','save_application_review_work(uuid,uuid,boolean,uuid,text)','execute') as allowed`);assert.equal(r.rows[0].allowed,false);
});
test('authorised reviewer can assign and note; outsiders and foreign assignees cannot',async()=>{
 await db.exec('set role service_role');
 await sql(`select save_application_review_work($1,$2,true,$3,'Useful private context')`,[id(100),id(1),id(2)]);
 assert.equal((await sql(`select body from application_team_notes`)).rows[0].body,'Useful private context');
 await assert.rejects(sql(`select save_application_review_work($1,$2,false,null,'Attack')`,[id(100),id(3)]),/Not allowed/);
 await assert.rejects(sql(`select save_application_review_work($1,$2,true,$3,null)`,[id(100),id(1),id(3)]),/Reviewer not available/);
 await assert.rejects(sql(`select save_application_review_work($1,$2,false,null,' ')`,[id(100),id(1)]),/Invalid note/);
 await db.exec('reset role');
});
test('applicant notifications require opt-in and each status queues once',async()=>{
 await sql(`update applications set status='under_review' where id=$1`,[id(100)]);
 assert.equal((await sql(`select count(*)::int as n from service_notifications`)).rows[0].n,0);
 await sql(`insert into application_notification_preferences values($1,true)`,[id(100)]);
 await sql(`update applications set status='declined',reviewed_at=now() where id=$1`,[id(100)]);
 await sql(`update applications set status='declined' where id=$1`,[id(100)]);
 assert.equal((await sql(`select count(*)::int as n from service_notifications`)).rows[0].n,1);
});
test('notification claims use a lease and cannot immediately claim the same job twice',async()=>{
 await db.exec('set role service_role');
 assert.equal((await sql(`select * from claim_service_notifications()`)).rows.length,1);
 assert.equal((await sql(`select * from claim_service_notifications()`)).rows.length,0);
 await db.exec('reset role');
});
test('reminders require server opt-in and are deduplicated per day',async()=>{
 await sql(`update applications set status='under_review' where id=$1`,[id(101)]);
 assert.equal((await sql(`select * from claim_service_notifications()`)).rows.length,0);
 await sql(`insert into server_service_preferences values($1,true)`,[id(10)]);
 assert.equal((await sql(`select * from claim_service_notifications()`)).rows.length,1);
 assert.equal((await sql(`select * from claim_service_notifications()`)).rows.length,0);
});
test('analytics are tenant checked and distinguish submission from unfinished applications',async()=>{
 await sql(`insert into interview_sessions values($1,$2,'completed',now()-interval '2 days',now()-interval '1 day')`,[id(200),id(100)]);
 const r=await sql(`select server_service_metrics($1,$2) as metrics`,[id(10),id(1)]);
 assert.equal(r.rows[0].metrics.applications,2);assert.equal(r.rows[0].metrics.submitted,1);
 // A recently submitted interview is not overdue merely because its application is old.
 await sql(`insert into interview_sessions values($1,$2,'completed',now()-interval '2 days',now())`,[id(201),id(101)]);
 assert.equal(Number((await sql(`select service_overdue_count($1) as n`,[id(10)])).rows[0].n),0);
 await sql(`delete from interview_sessions where id=$1`,[id(201)]);
 await assert.rejects(sql(`select server_service_metrics($1,$2)`,[id(10),id(3)]),/Not allowed/);
});
test('removing an application removes its private notes, assignment and queued notifications',async()=>{
 await sql(`select save_application_review_work($1,$2,true,$3,'Temporary note')`,[id(101),id(1),id(2)]);
 await sql(`delete from applications where id=$1`,[id(101)]);
 assert.equal((await sql(`select count(*)::int as n from application_team_notes where application_id=$1`,[id(101)])).rows[0].n,0);
 assert.equal((await sql(`select count(*)::int as n from application_review_work where application_id=$1`,[id(101)])).rows[0].n,0);
});
test.after(()=>db.close());
