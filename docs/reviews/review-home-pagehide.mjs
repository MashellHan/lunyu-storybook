import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {chromium} from '@playwright/test';
const root='/Users/mengxionghan/workspace/lunyu-storybook';
assert.equal(process.cwd(),root);
const expected='d7179532783d0405cbece7b4e69069ea7e11a2fa17abbbc77b5bd7341c8313ba';
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const result={method:'Real same-origin navigation, synchronous sessionStorage capture after the application pagehide listener',beforeSha256:sha(fs.readFileSync(root+'/public/index.html')),errors:[]};
assert.equal(result.beforeSha256,expected);
const browser=await chromium.launch({executablePath:'/Users/mengxionghan/Library/Caches/ms-playwright/chromium-1248/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing',headless:true});
const context=await browser.newContext();
await context.addInitScript(()=>{
  window.__homeAudit={created:[],cancelled:0};
  const original=Element.prototype.animate;
  Element.prototype.animate=function(...args){
    const animation=original.apply(this,args);__homeAudit.created.push(animation);
    const cancel=animation.cancel.bind(animation);
    animation.cancel=()=>{cancel();__homeAudit.cancelled++;};
    return animation;
  };
});
try{
  const page=await context.newPage();page.on('pageerror',e=>result.errors.push(String(e)));
  const response=await page.goto('http://127.0.0.1:4173/',{waitUntil:'domcontentloaded'});
  assert.equal(sha(await response.body()),expected);
  result.before=await page.evaluate(()=>{
    sessionStorage.removeItem('lunyu-review-home-pagehide');
    addEventListener('pagehide',e=>{
      sessionStorage.setItem('lunyu-review-home-pagehide',JSON.stringify({
        isTrusted:e.isTrusted,persisted:e.persisted,url:location.href,cancelled:__homeAudit.cancelled,
        active:document.getAnimations().length,states:__homeAudit.created.map(a=>a.playState)
      }));
    },{once:true});
    return {active:document.getAnimations().length,cancelled:__homeAudit.cancelled,states:__homeAudit.created.map(a=>a.playState)};
  });
  assert.equal(result.before.active,1);
  await page.goto('http://127.0.0.1:4173/learn/xue-er/1/',{waitUntil:'domcontentloaded'});
  result.pagehide=await page.evaluate(()=>JSON.parse(sessionStorage.getItem('lunyu-review-home-pagehide')));
  assert.equal(result.pagehide.isTrusted,true);assert.equal(result.pagehide.cancelled,1);
  assert.equal(result.pagehide.active,0);assert.deepEqual(result.pagehide.states,['idle']);
  assert.equal(result.errors.length,0);result.passed=true;
}catch(e){result.failure=String(e);result.passed=false;process.exitCode=1;}
finally{result.afterSha256=sha(fs.readFileSync(root+'/public/index.html'));assert.equal(result.afterSha256,expected);await browser.close();fs.writeFileSync(root+'/docs/reviews/home-anime-d7179532-pagehide.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));}
