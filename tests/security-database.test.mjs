import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '../.affiliate-tools/node_modules/@electric-sql/pglite/dist/index.js';

// Isolated database only. No live records, credentials or paid transactions.
const db = new PGlite();
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
await db.exec(`
  create role anon; create role authenticated; create role service_role bypassrls;
  create schema auth; create schema storage;
  create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('test.uid',true),'')::uuid$$;
  create function storage.foldername(text) returns text[] language sql immutable as $$select (string_to_array($1,'/'))[1:array_length(string_to_array($1,'/'),1)-1]$$;
  create table public.applications(id uuid primary key, applicant_user_id uuid);
  create table public.interview_sessions(id uuid primary key, server_id uuid, application_id uuid);
  create table public.owner_feedback(id int,status text);
  create table public.servers(id int);
  create table public.audit_logs(id int);
  create table public.owner_billing(id int);
  create table public.paypal_orders(id int);
  create table public.profiles(id int);
  create table public.question_bank(id int);
  create table storage.objects(bucket_id text,name text,metadata jsonb, unique(bucket_id,name));
  grant usage on schema public,auth,storage to anon,authenticated,service_role;
  grant all on all tables in schema public,storage to anon,authenticated,service_role;
  revoke update on public.owner_feedback from authenticated;
  grant update(status) on public.owner_feedback to authenticated;
  alter table storage.objects enable row level security;
  create policy test_read on storage.objects for select to authenticated using (
    exists (select 1 from public.interview_sessions i join public.applications a on a.id=i.application_id
    where name like i.server_id::text || '/' || i.id::text || '/%' and a.applicant_user_id=auth.uid()));
  create policy test_insert on storage.objects for insert to authenticated with check (
    exists (select 1 from public.interview_sessions i join public.applications a on a.id=i.application_id
    where name like i.server_id::text || '/' || i.id::text || '/%' and a.applicant_user_id=auth.uid()));
`);
await db.exec(readFileSync(new URL('../supabase/migrations/20260902133343_security_hardening_storage_and_privileges.sql', import.meta.url), 'utf8'));
await db.query('insert into applications values ($1,$2),($3,$4)', [id(1),id(10),id(2),id(20)]);
await db.query('insert into interview_sessions values ($1,$2,$3),($4,$5,$6)', [id(100),id(1000),id(1),id(200),id(2000),id(2)]);
await db.query("select set_config('test.uid',$1,false)",[id(10)]);
const own = file => `${id(1000)}/${id(100)}/${file}`;
const other = `${id(2000)}/${id(200)}/recording.webm`;

test('recording and voice-sample uploads can retry via upsert', async () => {
  await db.exec('set role authenticated');
  try {
    for (const file of ['recording.webm','voice-sample.wav']) {
      for (let attempt=1;attempt<=2;attempt++) {
        const r=await db.query(`insert into storage.objects values ('interview-recordings',$1,$2)
          on conflict(bucket_id,name) do update set metadata=excluded.metadata returning metadata`,[own(file),{attempt}]);
        assert.equal(r.rows[0].metadata.attempt,attempt);
      }
    }
  } finally { await db.exec('reset role'); }
});

test('applicant cannot move a recording to another tenant or an arbitrary destination', async () => {
  await db.exec('set role authenticated');
  try {
    for (const destination of [other,own('unexpected.txt')]) {
      await assert.rejects(db.query('update storage.objects set name=$1 where name=$2',[destination,own('recording.webm')]),/row-level security/);
    }
    await assert.rejects(db.query("update storage.objects set bucket_id='server-logos' where name=$1",[own('recording.webm')]),/row-level security/);
  } finally { await db.exec('reset role'); }
});

test('anonymous tables, browser billing writes and destructive grants are denied', async () => {
  const rows=(await db.query(`select c.relname,
    has_table_privilege('anon',c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') as anon,
    has_table_privilege('authenticated',c.oid,'TRUNCATE,REFERENCES,TRIGGER') as dangerous
    from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r'`)).rows;
  for(const row of rows){ assert.equal(row.anon,false,row.relname);assert.equal(row.dangerous,false,row.relname); }
  await db.exec('set role authenticated');
  try {
    for(const table of ['owner_billing','paypal_orders','profiles','audit_logs']) {
      await assert.rejects(db.query(`insert into ${table} values (1)`),/permission denied/);
      await assert.rejects(db.query(`delete from ${table}`),/permission denied/);
    }
    await db.query('select * from owner_billing');
    await db.query('insert into servers values (1)');
    await db.query('insert into question_bank values (1)');
    await db.query("insert into owner_feedback values (1,'open')");
    await db.query("update owner_feedback set status='closed' where id=1");
  } finally { await db.exec('reset role'); }
});

test('trusted backend retains billing, audit and deletion access', async () => {
  await db.exec('set role service_role');
  try {
    for(const table of ['owner_billing','paypal_orders','profiles','audit_logs']) {
      await db.query(`insert into ${table} values (1)`);
      await db.query(`update ${table} set id=2 where id=1`);
      await db.query(`delete from ${table} where id=2`);
    }
    await db.query('delete from servers where id=1');
  } finally { await db.exec('reset role'); }
});
test.after(async()=>db.close());
