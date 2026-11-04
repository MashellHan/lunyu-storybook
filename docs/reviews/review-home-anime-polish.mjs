import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
const root='/Users/mengxionghan/workspace/lunyu-storybook';
assert.equal(process.cwd(),root);
const out=root+'/docs/reviews';
const expected={
 'src/home.html':'e2126e18b18625fec612d1bb58747a7c3992a3bfdfe6db4c2e82a87be03368a0',
 'src/home.css':'c904aa3095309e197de62e098ec1084fb257da530198d138955a4a26bbbdd5c2',
 'src/home.js':'fcca7591645564f374587ecbf6579ddc3a30ff3e9c71cef0cba38f0023792584',
 'public/index.html':'d7179532783d0405cbece7b4e69069ea7e11a2fa17abbbc77b5bd7341c8313ba'
};
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const fingerprint=()=>Object.fromEntries(Object.keys(expected).map(p=>[p,hash(fs.readFileSync(root+'/'+p))]));
const result={at:new Date().toISOString(),scope:'homepage decoration increment only',expected,before:fingerprint(),viewports:[],lifecycle:{},errors:[],evidenceScreenshots:[],limitations:['hidden uses an explicitly synthetic visibilitychange with an overridden document.hidden getter','No physical device or OS background testing; no player testing']};
assert.deepEqual(result.before,expected);
const chrome='/Users/mengxionghan/Library/Caches/ms-playwright/chromium-1248/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing';
const browser=await chromium.launch({executablePath:chrome,headless:true});
result.browser={path:chrome,headless:true,version:browser.version()};
const context=await browser.newContext();
await context.addInitScript(()=>{
  const audit=window.__homeAudit={created:[],events:[],lastEvent:'startup',cancelled:0};
  const emit=x=>console.debug('__HOME_REVIEW__'+JSON.stringify(x));
  const animate=Element.prototype.animate;
  Element.prototype.animate=function(frames,options){
    const animation=animate.call(this,frames,options);
    const record={target:this.id||this.className,frames,options,animation};
    audit.created.push(record);
    const cancel=animation.cancel.bind(animation);
    animation.cancel=()=>{cancel();audit.cancelled++;emit({type:'cancel',state:animation.playState,reason:audit.lastEvent,hidden:document.hidden});};
    return animation;
  };
  document.addEventListener('visibilitychange',e=>{audit.lastEvent='visibilitychange';const x={type:e.type,trusted:e.isTrusted,hidden:document.hidden};audit.events.push(x);emit(x);});
  addEventListener('pagehide',e=>{audit.lastEvent='pagehide';const x={type:e.type,trusted:e.isTrusted,persisted:e.persisted};audit.events.push(x);emit(x);});
});
function observe(page,label){
  const events=[];const requests=[];
  page.on('console',m=>{if(m.text().startsWith('__HOME_REVIEW__'))events.push(JSON.parse(m.text().slice(15)));else if(m.type()==='error')result.errors.push({label,kind:'console',text:m.text()});});
  page.on('pageerror',e=>result.errors.push({label,kind:'pageerror',text:String(e)}));
  page.on('response',r=>{if(r.status()>=400)result.errors.push({label,kind:'http',url:r.url(),status:r.status()});});
  page.on('requestfailed',r=>result.errors.push({label,kind:'requestfailed',url:r.url(),error:r.failure()}));
  page.on('request',r=>requests.push({type:r.resourceType(),url:r.url()}));
  return {events,requests};
}
const state=()=>({
  created:__homeAudit.created.map(x=>({target:x.target,options:x.options,frames:x.frames,state:x.animation.playState,currentTime:x.animation.currentTime})),
  cancelled:__homeAudit.cancelled,active:document.getAnimations().length,events:__homeAudit.events,
  hidden:document.hidden,reduced:matchMedia('(prefers-reduced-motion: reduce)').matches
});
async function load(label,options={}){
  const p=await context.newPage();if(options.reduced)await p.emulateMedia({reducedMotion:'reduce'});
  const monitor=observe(p,label);
  const response=await p.goto('http://127.0.0.1:4173/',{waitUntil:'domcontentloaded'});
  assert.equal(response.status(),200);
  assert.equal(hash(await response.body()),expected['public/index.html']);
  return {p,monitor};
}
try{
  for(const [width,height] of [[1440,900],[1024,768],[768,1024],[390,844],[320,568],[844,390]]){
    const p=await context.newPage();await p.setViewportSize({width,height});const monitor=observe(p,width+'x'+height);
    const response=await p.goto('http://127.0.0.1:4173/',{waitUntil:'domcontentloaded'});
    assert.equal(hash(await response.body()),expected['public/index.html']);
    await p.keyboard.press('Tab');
    const measured=await p.evaluate(()=>{
      const r=e=>{const b=e.getBoundingClientRect();return {x:b.x,y:b.y,width:b.width,height:b.height,right:b.right,bottom:b.bottom};};
      const visible=e=>e.getClientRects().length&&getComputedStyle(e).visibility!=='hidden';
      const overlap=(a,b)=>Math.min(a.right,b.right)-Math.max(a.x,b.x)>.1&&Math.min(a.bottom,b.bottom)-Math.max(a.y,b.y)>.1;
      const decorations=[...document.querySelectorAll('.peek,.paper-plane,.bookmark')].filter(visible).map(e=>({class:e.className.baseVal||e.className,...r(e)}));
      const protectedElements=[...document.querySelectorAll('.volume-name,#first-chapter,h1')].map(e=>({id:e.id||e.textContent,...r(e)}));
      const first=document.getElementById('first-chapter');const b=r(first);
      const focus={x:b.x-7,y:b.y-7,right:b.right+7,bottom:b.bottom+7};
      const target=document.elementFromPoint(b.x+b.width/2,b.y+b.height/2)?.closest('a')?.id;
      return {viewport:{width:innerWidth,height:innerHeight},decorations,overlaps:decorations.flatMap(d=>protectedElements.filter(e=>overlap(d,e)).map(e=>[d.class,e.id])),focusOverlaps:decorations.filter(d=>overlap(d,focus)).map(d=>d.class),
        focused:document.activeElement.id,focusOutline:getComputedStyle(first).outline,first:b,centerTarget:target,
        names:[...document.querySelectorAll('.volume-name')].map(e=>e.textContent),decorText:document.querySelector('.catalog-decor').textContent.trim(),decorAriaHidden:document.querySelector('.catalog-decor').getAttribute('aria-hidden'),
        tabStops:[...document.querySelectorAll('a[href],button,input,select,textarea,summary,[tabindex]')].filter(e=>visible(e)&&e.tabIndex>=0).map(e=>({id:e.id,tag:e.tagName})),
        decorPointerEvents:[...document.querySelectorAll('.catalog-decor,.catalog-decor *')].map(e=>getComputedStyle(e).pointerEvents),
        audioElements:document.querySelectorAll('audio').length,prefetches:document.querySelectorAll('link[rel=preload],link[rel=prefetch]').length,scrollWidth:document.documentElement.scrollWidth,
        created:__homeAudit.created.map(x=>({target:x.target,options:x.options,frames:x.frames}))
      };
    });
    assert.equal(measured.decorText,'');assert.equal(measured.decorAriaHidden,'true');
    assert.deepEqual(measured.tabStops,[{id:'first-chapter',tag:'A'}]);assert.equal(measured.focused,'first-chapter');
    assert.equal(measured.centerTarget,'first-chapter');assert.equal(measured.overlaps.length,0);assert.equal(measured.focusOverlaps.length,0);
    assert(measured.decorPointerEvents.every(x=>x==='none'));assert.equal(measured.audioElements,0);assert.equal(measured.prefetches,0);
    assert.equal(measured.scrollWidth,width);assert.equal(measured.names.length,20);
    assert.equal(measured.created.length,height===390?0:1);
    if(width<=390)assert(measured.first.bottom<=600);
    await p.waitForTimeout(800);
    measured.after=await p.evaluate(state);assert.equal(measured.after.active,0);
    if(width===390||width===320||width===1440){const path=out+'/home-anime-d7179532-focus-'+width+'x'+height+'.png';await p.screenshot({path,fullPage:true});measured.screenshot=path;}
    measured.nonDataRequests=monitor.requests.filter(x=>!x.url.startsWith('data:'));
    assert.equal(measured.nonDataRequests.filter(x=>x.type==='media').length,0);
    result.viewports.push(measured);await p.close();
  }
  {
    const {p}=await load('natural-once');result.lifecycle.onceBefore=await p.evaluate(state);
    await p.waitForTimeout(850);const rect=await p.locator('.peek-cat').boundingBox();
    await p.mouse.click(rect.x+rect.width/2,rect.y+rect.height/2);await p.waitForTimeout(100);
    result.lifecycle.onceAfter=await p.evaluate(state);
    assert.equal(result.lifecycle.onceAfter.created.length,1);assert.equal(result.lifecycle.onceAfter.active,0);await p.close();
  }
  {
    const {p}=await load('initial-reduce',{reduced:true});result.lifecycle.initialReduce=await p.evaluate(state);
    assert.equal(result.lifecycle.initialReduce.created.length,0);assert.equal(result.lifecycle.initialReduce.active,0);await p.close();
  }
  {
    const {p}=await load('reduce-change');const before=await p.evaluate(state);assert.equal(before.active,1);
    await p.emulateMedia({reducedMotion:'reduce'});await p.waitForTimeout(80);
    const after=await p.evaluate(state);assert.equal(after.cancelled,1);assert.equal(after.active,0);
    await p.emulateMedia({reducedMotion:'no-preference'});await p.waitForTimeout(80);
    const restored=await p.evaluate(state);assert.equal(restored.created.length,1);assert.equal(restored.active,0);
    result.lifecycle.reduceChange={method:'browser media emulation while native animation active',before,after,restored};await p.close();
  }
  {
    const {p}=await load('synthetic-hidden');const before=await p.evaluate(state);assert.equal(before.active,1);
    await p.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'));});
    const after=await p.evaluate(state);assert.equal(after.cancelled,1);assert.equal(after.active,0);
    await p.evaluate(()=>{delete document.hidden;document.dispatchEvent(new Event('visibilitychange'));});
    await p.waitForTimeout(80);const restored=await p.evaluate(state);assert.equal(restored.created.length,1);assert.equal(restored.active,0);
    result.lifecycle.hidden={method:'synthetic branch probe, not actual OS background',before,after,restored};await p.close();
  }
  {
    const {p,monitor}=await load('actual-pagehide');const before=await p.evaluate(state);assert.equal(before.active,1);
    await p.goto('about:blank',{waitUntil:'load'});await p.waitForTimeout(50);
    assert(monitor.events.some(e=>e.type==='pagehide'&&e.trusted));assert(monitor.events.some(e=>e.type==='cancel'&&e.state==='idle'));
    result.lifecycle.pagehide={method:'real navigation to about:blank',before,events:monitor.events};await p.close();
  }
  for(const name of fs.readdirSync(root+'/tests/artifacts').filter(n=>/^home-(peak-)?\d+x\d+\.png$/.test(n))){
    result.evidenceScreenshots.push({path:'tests/artifacts/'+name,sha256:hash(fs.readFileSync(root+'/tests/artifacts/'+name))});
  }
  assert.equal(result.errors.length,0);result.passed=true;
}catch(e){result.failure=String(e);result.passed=false;process.exitCode=1;}
finally{result.after=fingerprint();if(JSON.stringify(result.after)!==JSON.stringify(result.before)){result.passed=false;result.failure='Frozen source changed';process.exitCode=1;}await browser.close();fs.writeFileSync(out+'/home-anime-d7179532-check.json',JSON.stringify(result,null,2));console.log(JSON.stringify({passed:result.passed,failure:result.failure,viewports:result.viewports.length,lifecycle:Object.keys(result.lifecycle),errors:result.errors,output:out+'/home-anime-d7179532-check.json'}));}
