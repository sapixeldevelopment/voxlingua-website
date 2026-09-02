import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import crypto from 'node:crypto';
import ts from 'typescript';

function load(path,mocks={},globals={}) {
  const exports={};const source=readFileSync(new URL(`../${path}`,import.meta.url),'utf8');
  vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,require:name=>{if(!(name in mocks))throw new Error(`Missing mock ${name}`);return mocks[name];},URL,Request,Response,Headers,Date,Error,Buffer,AbortSignal,console:{warn(){},error(){}},process:{env:{PAYPAL_ENVIRONMENT:'live'}},...globals});return exports;
}
const policy=load('lib/affiliate-policy.ts');
const json=(body,init)=>Response.json(body,init);
function builder(result){const q={then:(a,b)=>Promise.resolve(result).then(a,b)};for(const method of ['select','eq','single','maybeSingle','update','upsert','insert','is','lte','order','limit','like'])q[method]=()=>q;return q;}
test('money parsing rejects malformed values and calculates all plan commissions in cents',()=>{
  for(const value of ['-1','1e3','NaN','Infinity','10.999',' 10','1,000',10])assert.throws(()=>policy.cents(value));
  for(const [amount,expected] of [['10',150],['20',300],['50',750],['80',1200],['180',2700],['100',1500],['1800',27000]])assert.equal(policy.commissionCents(policy.cents(amount)),expected);
});
test('referral and payout fields cannot accept code injection or header newlines',()=>{
  for(const code of ['<script>','abcdef123456?next=evil','abcdef123456\r\nX-Test: yes',''])assert.equal(policy.referralCode(code),'');
  assert.equal(policy.referralCode(' ABCDEF123456 '),'abcdef123456');
  for(const email of ['a@example.com\r\nBcc:b@example.com','javascript:alert(1)','<script>@example.com'])assert.equal(policy.payoutEmail(email),'');
});
test('OAuth return path cannot redirect off-site through slashes, encodings or backslashes',()=>{
  for(const path of ['//evil.test','/\\evil.test','https://evil.test','/%2f%2fevil.test','/%5cevil.test','/foo%0d%0a'])assert.equal(policy.safeNext(path),'/dashboard');
  assert.equal(policy.safeNext('/partners'),'/partners');assert.equal(policy.safeNext('/admin/partners'),'/admin/partners');
});
test('all admin financial access rejects anonymous, support-role and forged cross-origin requests',async()=>{
  let user=null,role=null,authReads=0;
  const mod=load('lib/affiliates.ts',{'server-only':{},'node:crypto':crypto,'next/headers':{},'@/lib/supabase/server':{createClient:async()=>({auth:{getUser:async()=>{authReads++;return{data:{user}};}}})},'@/lib/supabase/admin':{},'@/lib/platform-staff':{getPlatformStaff:async()=>role?{role}:null},'@/lib/affiliate-policy':policy,'@/lib/security':{consumeRateLimit:async()=>true,noStoreJson:json}});
  let result=await mod.affiliateAccess(new Request('https://dexlyy.com/api/admin/partners',{method:'POST'}),true);assert.equal(result.response.status,403);assert.equal(authReads,0);
  const request=()=>new Request('https://dexlyy.com/api/admin/partners',{method:'POST',headers:{Origin:'https://dexlyy.com'}});
  result=await mod.affiliateAccess(request(),true);assert.equal(result.response.status,401);
  user={id:'user'};role='support';result=await mod.affiliateAccess(request(),true);assert.equal(result.response.status,403);
  role='admin';result=await mod.affiliateAccess(request(),true);assert.equal(result.user.id,'user');
  result=await mod.affiliateAccess(new Request('https://dexlyy.com/api/admin/partners',{method:'POST',headers:{Origin:'https://evil.test'}}),true);assert.equal(result.response.status,403);
});
test('unsigned PayPal messages cannot reach commission processing',async()=>{
  let called=0;
  const mod=load('app/api/paypal/webhook/route.ts',{'next/server':{NextResponse:{json}},'@/lib/paypal-subscriptions':{},'@/lib/paypal':{verifyPayPalWebhook:async()=>false},'@/lib/supabase/admin':{},'@/lib/affiliate-payments':{ingestAffiliateEvent:async()=>called++},'@/lib/security':{consumeRateLimit:async()=>true,requestClientIp:()=>"127.0.0.1"}});
  const response=await mod.POST(new Request('https://dexlyy.com/api/paypal/webhook',{method:'POST',body:JSON.stringify({id:'FAKE',event_type:'PAYMENT.SALE.COMPLETED'})}));assert.equal(response.status,401);assert.equal(called,0);
});
test('payment processing uses provider amount/ownership, not webhook or browser assertions',async()=>{
  const calls=[];let owner='00000000-0000-4000-8000-000000000001',status='completed';
  const mod=load('lib/affiliate-payments.ts',{'server-only':{},'@/lib/affiliates':{ensureAffiliateCustomer:async()=>{}},'@/lib/supabase/admin':{createAdminClient:()=>({rpc:async(name,args)=>{calls.push({name,args});return{data:'payment-id',error:null};},from:()=>builder({data:{},error:null})})},'@/lib/paypal':{paypalRequest:async path=>({body:path.includes('/sale/')?{id:'SALE1',state:status,billing_agreement_id:'I-SUB1',amount:{total:'50.00',currency:'USD',details:{tax:'5.00'}},create_time:'2026-01-01T00:00:00Z'}:{custom_id:owner,plan_id:'PLAN',subscriber:{email_address:'buyer@example.test',payer_id:'PAYER'}}})},'@/lib/paypal-subscriptions':{planForPayPalId:()=>({planKey:'medium',billingInterval:'month'})},'@/lib/billing':{BILLING_PLANS:{medium:{name:'Medium'}}},'@/lib/affiliate-policy':policy,'@/lib/security':{isUuid:value=>/^[0-9a-f-]{36}$/.test(value)}});
  await mod.processAffiliateEvent({event_type:'PAYMENT.SALE.COMPLETED',resource:{id:'SALE1',amount:{total:'9999999.00'},custom_id:'attacker'}});
  assert.equal(calls[0].args.p_gross,5000);assert.equal(calls[0].args.p_base,4500);assert.equal(calls[0].args.p_user,owner);
  status='pending';await assert.rejects(mod.recordAffiliatePayment('sale','SALE1'),/not completed/);assert.equal(calls.length,1);
  status='completed';owner='attacker';await assert.rejects(mod.recordAffiliatePayment('sale','SALE1'),/does not match/);assert.equal(calls.length,1);
  assert.throws(()=>mod.relatedPayment({links:[{rel:'up',href:'https://evil.test/v1/payments/sale/SALE1'}]},'sale'),/not identified/);
});
test('public partner projection excludes customer IDs, payment IDs and customer PII',()=>{
  const source=readFileSync(new URL('../lib/affiliates.ts',import.meta.url),'utf8');
  assert.ok(source.includes('.eq("partner_id", id)'));assert.ok(source.includes('"id,amount_cents,available_at,created_at,payout_id"'));
  const route=readFileSync(new URL('../app/api/partners/route.ts',import.meta.url),'utf8');assert.ok(route.includes('.eq("user_id", access.user.id)'));
});
