import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { parseCookieHeader, serializeCookieHeader } from '@supabase/ssr';

function load(path,mocks={},globals={}) {
  const exports={};
  vm.runInNewContext(ts.transpileModule(readFileSync(new URL(`../${path}`,import.meta.url),'utf8'),{
    compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022},
  }).outputText,{exports,require:name=>{if(!(name in mocks))throw new Error(`Missing mock ${name}`);return mocks[name];},
    URL,Request,Response,Headers,Date,Error,Buffer,process:{env:{NODE_ENV:'production'}},...globals});
  return exports;
}
const session=load('lib/supabase/session.ts');
test('final auth cookie serialization drops persistence but preserves sign-out',()=>{
  const defaults={path:'/',sameSite:'lax',maxAge:34560000,expires:new Date('2030-01-01')};
  const header=serializeCookieHeader('auth','test',session.authCookieOptions(defaults,false));
  assert.doesNotMatch(header,/Max-Age|Expires/);assert.match(header,/Secure/);assert.match(header,/SameSite=Lax/);
  assert.equal(session.authCookieOptions(defaults,true).maxAge,34560000);
  assert.match(serializeCookieHeader('auth','',session.authCookieOptions({...defaults,maxAge:0},false)),/Max-Age=0/);
  assert.equal(defaults.maxAge,34560000);
});
test('browser singleton reads the login preference when writing, not when created',()=>{
  let options;let cookie='dexlyy-remember=1';const writes=[];
  const doc={get cookie(){return cookie;},set cookie(value){writes.push(value);}};
  const mod=load('lib/supabase/client.ts',{
    '@supabase/ssr':{parseCookieHeader,serializeCookieHeader,createBrowserClient:(_url,_key,opts)=>{options=opts;return{};}},
    '@/lib/supabase/session':session,
  },{document:doc});
  mod.createClient();cookie='dexlyy-remember=0';
  options.cookies.setAll([{name:'auth',value:'test',options:{maxAge:34560000,path:'/'}}]);
  assert.doesNotMatch(writes[0],/Max-Age/);
  cookie='dexlyy-remember=1';
  options.cookies.setAll([{name:'auth',value:'test',options:{maxAge:34560000,path:'/'}}]);
  assert.match(writes[1],/Max-Age=34560000/);
});
test('PayPal abuse limit and limiter outage stop verification and payment writes',async()=>{
  for(const unavailable of [false,true]) {
    let verifications=0,payments=0;
    const route=load('app/api/paypal/webhook/route.ts',{
      'next/server':{NextResponse:{json:Response.json}},'@/lib/paypal-subscriptions':{},'@/lib/supabase/admin':{},
      '@/lib/paypal':{verifyPayPalWebhook:async()=>{verifications++;return true;}},
      '@/lib/affiliate-payments':{ingestAffiliateEvent:async()=>payments++},
      '@/lib/security':{requestClientIp:()=> '192.0.2.1',consumeRateLimit:async()=>{if(unavailable)throw new Error('private database detail');return false;}},
    });
    const response=await route.POST(new Request('https://dexlyy.com/api/paypal/webhook',{method:'POST',body:'{}'}));
    assert.equal(response.status,unavailable?503:429);assert.equal(verifications,0);assert.equal(payments,0);
    assert.doesNotMatch(await response.text(),/private database detail/);
  }
});
test('PayPal verification errors are not disclosed to unauthenticated callers',async()=>{
  const route=load('app/api/paypal/webhook/route.ts',{
    'next/server':{NextResponse:{json:Response.json}},'@/lib/paypal-subscriptions':{},'@/lib/supabase/admin':{},
    '@/lib/paypal':{verifyPayPalWebhook:async()=>{throw new Error('private provider detail');}},
    '@/lib/affiliate-payments':{},'@/lib/security':{requestClientIp:()=> '192.0.2.1',consumeRateLimit:async()=>true},
  });
  const response=await route.POST(new Request('https://dexlyy.com/api/paypal/webhook',{method:'POST',body:'{}'}));
  assert.equal(response.status,500);assert.equal((await response.json()).error,'Webhook processing failed.');
});
