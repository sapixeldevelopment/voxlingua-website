import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL(`../${path}`,import.meta.url),'utf8');
const styles=['app/globals.css','app/marketing.css','app/workspace.css','app/affiliates.css','app/login/premium.css'];

test('shared page styles never shrink labels below 13px, including mobile overrides',()=>{
 for(const path of styles){
  for(const match of read(path).matchAll(/font-size:\s*(\d*\.?\d+)(px|rem)/g)){
   assert.ok(+match[1]*(match[2]==='rem'?16:1)>=13,`${path}: ${match[0]}`);
  }
  for(const match of read(path).matchAll(/font:\s*(?:(?:normal|italic|bold|[1-9]00)\s+)*(\d+(?:\.\d+)?)px/g)) assert.ok(+match[1]>=13,`${path}: ${match[0]}`);
 }
});
function luminance(hex){
 return hex.replace('#','').match(/../g).map(x=>parseInt(x,16)/255).map(x=>x<=.04045?x/12.92:((x+.055)/1.055)**2.4).reduce((a,x,i)=>a+x*[.2126,.7152,.0722][i],0);
}
test('shared light and dark text pairs meet normal-text contrast',()=>{
 for(const [text,background] of [['#526458','#fafbf7'],['#52675c','#ffffff'],['#152c28','#ffffff'],['#175e40','#f4f8f5'],['#215a40','#e6f3eb'],['#c4dbcc','#173d2e'],['#173d2b','#e9f5ed']]){
  const a=luminance(text),b=luminance(background);
  assert.ok((Math.max(a,b)+.05)/(Math.min(a,b)+.05)>=4.5,`${text} on ${background}`);
 }
});
test('light server command panel explicitly resets legacy dark heading, links and buttons',()=>{
 const css=read('app/workspace.css');
 for(const selector of ['.workspace-ui .workspace-intro h1','.workspace-ui .workspace-action-secondary','.workspace-ui .workspace-share-row > div > a','.workspace-ui .workspace-open-portal']){
  const last=css.lastIndexOf(selector);assert.ok(last>=0);assert.match(css.slice(last,css.indexOf('}',last)+1),/color:\s*#[0-9a-f]{6}/i);
 }
 assert.match(css,/\.recovery-panel \.btn-ghost\s*\{[^}]*background:[^}]*color:/);
});
test('benefits have short consistent summaries and pricing reflows without shrinking text',()=>{
 const page=read('app/page.tsx'),css=read('app/marketing.css');
 assert.equal((page.match(/className="site-benefit-summary"/g)||[]).length,3);
 assert.ok(page.includes('Transcripts included with GPT Realtime.'));
 assert.match(css,/\.site-page \.site-billing-switch\s*\{[^}]*max-width:\s*100%/);
 assert.match(css,/\.site-page \.site-billing-switch button\s*\{[^}]*white-space:\s*normal/);
});
