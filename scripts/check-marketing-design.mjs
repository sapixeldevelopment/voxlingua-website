import { chromium } from '../.affiliate-tools/node_modules/playwright/index.mjs';
import { mkdirSync } from 'node:fs';
import assert from 'node:assert/strict';

const origin=process.argv[2] || 'http://127.0.0.1:4353';
if (!['http://127.0.0.1:4353','http://127.0.0.1:4352','https://dexlyy.com'].includes(origin)) throw new Error('Unexpected preview origin');
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
mkdirSync('.affiliate-preview/marketing',{recursive:true});
try {
  for(const width of [1440,1024,768,390,320]) {
    const page=await browser.newPage({viewport:{width,height:1000},reducedMotion:'reduce'});
    const errors=[];let mutations=0;
    page.on('pageerror',error=>errors.push(error.message));
    page.on('request',request=>{if(request.method()==='POST' && request.url().includes('/api/'))mutations++;});
    await page.goto(origin,{waitUntil:'networkidle'});
    await page.evaluate(()=>document.fonts.ready);
    await page.getByRole('heading',{name:'Better players. Less busywork. More roleplay.'}).waitFor();
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`${width}: horizontal overflow`);
    const preview=page.getByRole('group',{name:'Explore the product preview'});
    await preview.getByRole('button',{name:'01 Interview'}).click();
    await page.getByText('Calm. Natural. On your terms.').waitFor();
    await preview.getByRole('button',{name:'02 Review'}).click();
    await page.getByRole('button',{name:'Preview the welcome step'}).click();
    await page.getByRole('heading',{name:'Welcome to the community.'}).waitFor();
    await preview.getByRole('button',{name:'02 Review'}).click();
    const prices=page.locator('.site-plan-price strong');
    assert.deepEqual(await prices.allTextContents(),['$10','$20','$50','$80','$180']);
    const billing=page.getByRole('group',{name:'Billing period'});
    await billing.getByRole('button',{name:'Yearly 2 months free'}).click();
    assert.deepEqual(await prices.allTextContents(),['$100','$200','$500','$800','$1,800']);
    assert.equal(await page.locator('.site-plan-billing').filter({hasText:'USD billed yearly'}).count(),5);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`${width}: yearly overflow`);
    await billing.getByRole('button',{name:'Monthly',exact:true}).click();
    await page.locator('.site-faq-list summary').first().click();
    assert.equal(await page.locator('.site-faq-list details').first().getAttribute('open'),'');
    await page.locator('.site-faq-list summary').first().click();
    if(width<=640) {
      await page.getByRole('button',{name:'Open navigation'}).click();
      await page.getByRole('navigation',{name:'Mobile navigation'}).getByRole('link',{name:'Pricing',exact:true}).click();
      assert.equal(await page.getByRole('button',{name:'Open navigation'}).getAttribute('aria-expanded'),'false');
    }
    // Reset anchor navigation before capturing the first impression.
    await page.goto(origin,{waitUntil:'networkidle'});
    await page.evaluate(()=>document.fonts.ready);
    await page.screenshot({path:`.affiliate-preview/marketing/home-${width}.png`,fullPage:true});
    if(width===1440)await page.screenshot({path:'.affiliate-preview/marketing/hero-desktop.png'});
    if(width===390)await page.screenshot({path:'.affiliate-preview/marketing/hero-mobile.png'});
    if(width===1440)await page.locator('#pricing').screenshot({path:'.affiliate-preview/marketing/pricing-desktop.png'});
    await page.getByRole('link',{name:'Get started with Starter'}).click();
    await page.waitForURL('**/login');
    await page.getByRole('button',{name:'Continue with Discord'}).waitFor();
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`${width}: login overflow`);
    await page.screenshot({path:`.affiliate-preview/marketing/login-${width}.png`,fullPage:true});
    assert.deepEqual(errors,[],`${width}: runtime errors`);
    assert.equal(mutations,0,'Product preview must not change real application data');
    console.log(`PASS ${width}px: layout, product preview, billing prices, FAQ, navigation and sign-in handoff`);
    await page.close();
  }
} finally {await browser.close();}
