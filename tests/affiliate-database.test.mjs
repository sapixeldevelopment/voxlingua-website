import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { PGlite } from '../.affiliate-tools/node_modules/@electric-sql/pglite/dist/index.js';

// Entirely isolated Postgres. No credentials, live customers or financial transfers.
const db = new PGlite();
const migration = readdirSync(new URL('../supabase/migrations/',import.meta.url)).filter(name=>/_(recurring_affiliate_program|affiliate_customer_isolation)\.sql$/.test(name)).sort().map(name=>readFileSync(new URL(`../supabase/migrations/${name}`,import.meta.url),'utf8')).join('\n');
const uuid = n => `00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const adminId=uuid(1), supportId=uuid(2), partnerUser=uuid(3), partnerId=uuid(4);
await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
create schema auth; create table auth.users(id uuid primary key,email text,created_at timestamptz not null default now());
create table public.owner_billing(user_id uuid,paypal_subscription_id text,status text,paypal_payer_id text);
create table public.paypal_orders(user_id uuid,status text);
create table public.platform_staff(user_id uuid,role text,is_active boolean);
grant usage on schema public to service_role;
grant select on public.owner_billing,public.paypal_orders,public.platform_staff to service_role;`);
await db.exec(migration);
await db.query(`insert into auth.users(id,email) values ($1,'admin@example.test'),($2,'support@example.test'),($3,'partner@example.test')`,[adminId,supportId,partnerUser]);
await db.query(`insert into public.affiliate_customers select id,email,created_at from auth.users`);
await db.query(`insert into public.platform_staff values ($1,'admin',true),($2,'support',true)`,[adminId,supportId]);
await db.query(`insert into public.affiliate_partners(id,user_id,code,display_name,promotion,country,payout_email,status,payout_verified,payout_updated_at,terms_version) values($1,$2,'abcdef123456','Demo partner','A synthetic community for tests.','ZA','partner@example.test','approved',true,now()-interval '3 days','2026-09-02')`,[partnerId,partnerUser]);
async function customer(n) {
  const id=uuid(n); await db.query(`insert into auth.users(id,email) values($1,$2)`,[id,`user${n}@example.test`]);
  await db.query('insert into public.affiliate_customers select id,email,created_at from auth.users where id=$1',[id]);
  return id;
}
async function attach(user,code='abcdef123456') { return (await db.query('select public.affiliate_attach($1,$2) as ok',[user,code])).rows[0].ok; }
async function pay(user,transaction,amount=10000,env='live',kind='sale',payer=null) {
  return (await db.query(`select public.affiliate_record_payment($1,$2,$3,$4,$5,$5,clock_timestamp(),'Synthetic payment',null,$6) as id`,[env,kind,transaction,user,amount,payer])).rows[0].id;
}
async function action(a, payout=null, ref=null, actor=adminId) { return db.query('select public.affiliate_admin_action($1,$2,$3,$4,$5,$6) as result',[actor,partnerId,a,'Synthetic review completed.',payout,ref]); }
async function summary(){return (await db.query('select public.affiliate_summary($1) as s',[partnerId])).rows[0].s;}

test('all financial tables deny anonymous/authenticated access and all RPCs deny execution', async()=>{
  const rows=(await db.query(`select c.relname,c.relrowsecurity,has_table_privilege('anon',c.oid,'SELECT') as anon,has_table_privilege('authenticated',c.oid,'INSERT,UPDATE,DELETE,SELECT') as client from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' and c.relname like 'affiliate_%'`)).rows;
  assert.ok(rows.length>=10); for(const row of rows){assert.equal(row.relrowsecurity,true,row.relname);assert.equal(row.anon,false,row.relname);assert.equal(row.client,false,row.relname);}
  const functions=(await db.query(`select p.proname,p.prosecdef,has_function_privilege('authenticated',p.oid,'EXECUTE') as client,has_function_privilege('anon',p.oid,'EXECUTE') as anon from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like 'affiliate_%'`)).rows;
  for(const row of functions){assert.equal(row.prosecdef,false);assert.equal(row.client,false);assert.equal(row.anon,false);}
  await db.exec('set role anon'); await assert.rejects(db.query('select * from public.affiliate_partners'),/permission denied/); await db.exec('reset role');
});
test('referral is locked; existing, complimentary and self-referrals cannot attach',async()=>{
  const user=await customer(10); assert.equal(await attach(user),true); assert.equal(await attach(partnerUser),false);
  assert.equal(await attach(user,'nonexistent1'),true); // returns existing attribution without replacing it
  assert.equal((await db.query('select count(*)::int as count from public.affiliate_referrals where user_id=$1',[user])).rows[0].count,1);
  const old=await customer(11); await db.query("update public.affiliate_customers set joined_at=now()-interval '1 year' where user_id=$1",[old]); assert.equal(await attach(old),false);
  const paid=await customer(12); await db.query("insert into public.owner_billing values($1,'I-PAID','cancelled',null)",[paid]); assert.equal(await attach(paid),false);
  const free=await customer(13); await db.query("insert into public.owner_billing values($1,null,'active',null)",[free]); assert.equal(await attach(free),false);
});
test('30-day link window and unforgeable visit tokens are checked',async()=>{
  const user=await customer(14);
  assert.equal((await db.query('select public.affiliate_attach($1,null,$2) as ok',[user,'f'.repeat(64)])).rows[0].ok,false);
  await db.query("insert into public.affiliate_visits(token_hash,partner_id,created_at,expires_at) values($1,$2,now()-interval '31 days',now()-interval '1 day')",['a'.repeat(64),partnerId]);
  assert.equal((await db.query('select public.affiliate_attach($1,null,$2) as ok',[user,'a'.repeat(64)])).rows[0].ok,false);
  await db.query("insert into public.affiliate_visits(token_hash,partner_id) values($1,$2)",['b'.repeat(64),partnerId]);
  assert.equal((await db.query('select public.affiliate_attach($1,null,$2) as ok',[user,'b'.repeat(64)])).rows[0].ok,true);
});
test('six monthly payments earn six commissions; duplicate transaction earns once',async()=>{
  const user=await customer(20); await attach(user);
  for(let i=0;i<6;i++) await pay(user,`MONTH-${i}`,5000);
  await pay(user,'MONTH-0',5000);
  const row=(await db.query('select count(*)::int as count,sum(commission_cents)::int as earned from public.affiliate_payments where user_id=$1',[user])).rows[0];
  assert.deepEqual(row,{count:6,earned:4500});
});
test('annual payment, prepaid pack, sandbox and own payer commission rules',async()=>{
  const user=await customer(21); await attach(user);
  const annual=await pay(user,'YEAR-1',10000); const pack=await pay(user,'PACK-1',1700,'live','capture');
  const sandbox=await pay(user,'SANDBOX-1',5000,'sandbox'); const self=await pay(user,'OWN-PAYER',5000,'live','sale','partner@example.test');
  const amounts=(await db.query('select id,commission_cents::int as amount from public.affiliate_payments where id=any($1::uuid[])',[[annual,pack,sandbox,self]])).rows;
  assert.equal(amounts.find(x=>x.id===annual).amount,1500); assert.equal(amounts.find(x=>x.id===pack).amount,255);assert.equal(amounts.find(x=>x.id===sandbox).amount,0);assert.equal(amounts.find(x=>x.id===self).amount,0);
});
test('refunds reverse proportionally, cannot exceed original commission, and are idempotent',async()=>{
  const user=await customer(22);await attach(user); const payment=await pay(user,'REFUND-ME',10000);
  for(let i=0;i<2;i++)await db.query("select public.affiliate_record_refund('live','sale','REFUND-ME','REFUND-1',2000,false)");
  let row=(await db.query('select refunded_cents::int as refund,reversed_commission_cents::int as commission from public.affiliate_payments where id=$1',[payment])).rows[0]; assert.deepEqual(row,{refund:2000,commission:300});
  await db.query("select public.affiliate_record_refund('live','sale','REFUND-ME','FULL',0,true)");
  await db.query("select public.affiliate_record_refund('live','sale','REFUND-ME','LATE-REFUND',8000,false)");
  row=(await db.query('select refunded_cents::int as refund,reversed_commission_cents::int as commission from public.affiliate_payments where id=$1',[payment])).rows[0]; assert.deepEqual(row,{refund:10000,commission:1500});
});
test('payout requires real platform admin, maturity and verified recipient; reservation cannot repeat',async()=>{
  await assert.rejects(action('reserve',null,null,supportId),/Admin required/);
  await assert.rejects(action('reserve'),/below \$25/);
  await db.exec("update public.affiliate_ledger set available_at=now()-interval '1 second'");
  const result=await action('reserve'); const payout=result.rows[0].result.payout_id; assert.ok(payout);
  await assert.rejects(action('reserve'),/already open/);
  await assert.rejects(db.query('select public.affiliate_update_payout($1,$2)',[partnerUser,'new@example.test']),/Contact support/);
  const reserved=await summary();assert.equal(reserved.available_cents,0);assert.ok(reserved.reserved_cents>=2500);
  await action('cancel_payout',payout); assert.equal((await summary()).reserved_cents,0);
});
test('unprocessed financial events block payouts; post-payment refunds become negative adjustments',async()=>{
  await db.query("insert into public.affiliate_events(event_id,payload) values('test-pending','{}')");
  await assert.rejects(action('reserve'),/outstanding financial/);
  await db.query("update public.affiliate_events set processed_at=now() where event_id='test-pending'");
  const payout=(await action('reserve')).rows[0].result.payout_id;
  await assert.rejects(action('paid',payout,'bad'),/receipt reference/);
  await action('paid',payout,'REAL-TEST-RECEIPT');
  await assert.rejects(action('paid',payout,'REAL-TEST-RECEIPT'),/Open payout required/);
  await db.query("select public.affiliate_record_refund('live','sale','MONTH-0','AFTER-PAYOUT',5000,false)");
  assert.equal((await summary()).available_cents,-750);
  await assert.rejects(action('reserve'),/paid this month/);
});
test('service-role RPCs work without SECURITY DEFINER; direct clients cannot mint earnings',async()=>{
  await db.exec('set role service_role');
  assert.ok((await db.query('select public.affiliate_summary($1) as summary',[partnerId])).rows[0].summary);
  assert.equal(await attach(uuid(10)),true);
  await db.exec('reset role');
  await db.exec('set role authenticated');
  await assert.rejects(db.query('select public.affiliate_summary($1)',[partnerId]),/permission denied/);
  await db.exec('reset role');
});
test.after(async()=>{await db.close();});
