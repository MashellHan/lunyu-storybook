import { chromium } from '@playwright/test';
import fs from 'node:fs';
import crypto from 'node:crypto';
const root='/Users/mengxionghan/workspace/lunyu-storybook';
if(process.cwd()!==root) throw new Error('Explicit target workdir required');
const out=`${root}/docs/reviews`, round=process.env.REVIEW_ROUND||'round1';
const mode=process.argv[2]||'bfcache';
const chrome=process.env.CHROME_PATH||'/Users/mengxionghan/Library/Caches/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-mac-arm64/chrome-headless-shell';
const hash=f=>crypto.createHash('sha256').update(fs.readFileSync(`${root}/${f}`)).digest('hex');
const result={at:new Date().toISOString(),mode,artifactSha256:hash('public/learn/xue-er/1/index.html'),sourceSha256:hash('src/app.js'),cases:[],errors:[]};
const browser=await chromium.launch({executablePath:chrome,headless:true,ignoreDefaultArgs:['--disable-back-forward-cache'],args:['--autoplay-policy=user-gesture-required']});
result.browser=browser.version(); result.launch={executablePath:chrome,headless:true,ignoreDefaultArgs:['--disable-back-forward-cache']};
const context=await browser.newContext({viewport:{width:1024,height:768}});
await context.addInitScript(()=>{
  window.__reviewDocId=Math.random().toString(36);window.__reviewEvents=[];window.__reviewPlay=[];window.__reviewAudios=[];
  for(const name of ['pageshow','pagehide','freeze','resume','visibilitychange']) (['freeze','resume','visibilitychange'].includes(name)?document:window).addEventListener(name,e=>__reviewEvents.push({name,persisted:e.persisted??null,hidden:document.hidden,t:performance.now(),step:document.querySelector('#book')?.dataset.step,paused:window.__demo?.paused,audioTime:window.__demo?.audio.currentTime}),true);
  document.addEventListener('click',e=>{window.__reviewLastClick={t:performance.now(),id:e.target.closest('button,a')?.id||e.target.tagName};},true);
  const NativeAudio=window.Audio;window.Audio=new Proxy(NativeAudio,{construct(target,args){const a=Reflect.construct(target,args);__reviewAudios.push(a);return a;}});
  const nativePlay=HTMLMediaElement.prototype.play;
  HTMLMediaElement.prototype.play=function(...args){__reviewPlay.push({t:performance.now(),audio:__reviewAudios.indexOf(this),gesture:navigator.userActivation.isActive,lastClick:window.__reviewLastClick,step:document.querySelector('#book')?.dataset.step});return nativePlay.apply(this,args);};
});
async function open(label){
  const page=await context.newPage();page.on('pageerror',e=>result.errors.push({label,error:String(e)}));page.on('console',m=>{if(m.type()==='error')result.errors.push({label,console:m.text()});});
  page.on('response',r=>{if(r.status()>=400)result.errors.push({label,status:r.status(),url:r.url()});});
  await page.goto('http://127.0.0.1:4173/learn/xue-er/1/',{waitUntil:'load'});return page;
}
const sample=page=>page.evaluate(()=>({docId:__reviewDocId,step:document.querySelector('#book').dataset.step,free:document.querySelector('#book').classList.contains('free'),hidden:document.hidden,paused:__demo.paused,audioPaused:__demo.audio.paused,audioTime:__demo.audio.currentTime,duration:__demo.audio.duration,audioCount:__reviewAudios.length,sameAudio:__demo.audio===__reviewAudios[0],log:__log.map(x=>({...x})),focus:document.querySelectorAll('.playing,.k.cur,.busy').length,bubbles:document.querySelectorAll('.aBubble.show').length,stars:document.querySelectorAll('.star.on').length,events:__reviewEvents,playCalls:__reviewPlay,persisted:__demo.lastPageShowPersisted,historyState:history.state,now:performance.now()}));
const waitStep=(page,step,timeout=30000)=>page.waitForFunction(s=>document.querySelector('#book').dataset.step===s,step,{timeout});
const start=async page=>{await page.locator('#startBtn').click();await waitStep(page,'e1');};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
try {
  if(mode==='bfcache'){
    const page=await open('bfcache');
    const cdp=await context.newCDPSession(page);await cdp.send('Page.enable');
    const notRestored=[];cdp.on('Page.backForwardCacheNotUsed',e=>notRestored.push(e));
    await start(page);await page.waitForTimeout(300);const before=await sample(page);
    await page.locator('#homeBtn').click();await page.waitForURL('**/#xue-er');await page.waitForTimeout(300);
    await page.evaluate(()=>history.back());await page.waitForFunction(()=>location.pathname==='/learn/xue-er/1/');await page.waitForTimeout(500);const returned=await sample(page);
    await page.waitForTimeout(2000);const settled=await sample(page);
    await page.locator('#cat').click();await page.waitForFunction(()=>__log.at(-1)?.key==='c2',null,{timeout:5000});await page.waitForTimeout(350);const clicked=await sample(page);
    result.cases.push({name:'automatic e1 -> home -> real browser back',before,returned,settled,clicked,notRestored,actualBFCache:returned.persisted===true && returned.docId===before.docId});
    console.log(JSON.stringify({name:'bfcache',persisted:returned.persisted,sameDocument:returned.docId===before.docId,returnStep:returned.step,returnAudioPaused:returned.audioPaused,clicked:clicked.step,audioTime:clicked.audioTime,notRestored:notRestored.map(x=>x.notRestoredExplanations)}));
    await page.close();
  }
  if(mode==='freeze'){
    const page=await open('freeze-audio');const cdp=await context.newCDPSession(page);await cdp.send('Page.enable');
    await start(page);await page.waitForTimeout(350);const before=await sample(page);
    await cdp.send('Page.setWebLifecycleState',{state:'frozen'});const frozenAt=Date.now();await sleep(12000);await cdp.send('Page.setWebLifecycleState',{state:'active'});
    const immediate=await sample(page);await page.waitForTimeout(300);const after=await sample(page);
    result.cases.push({name:'CDP freeze request 12 seconds during e1; verify observed events',freezeObserved:after.events.some(e=>e.name==='freeze'),before,immediate,after,frozenWallMs:Date.now()-frozenAt});
    console.log(JSON.stringify({name:'freeze-audio',before:{step:before.step,time:before.audioTime},immediate:{step:immediate.step,time:immediate.audioTime,paused:immediate.paused},after:{step:after.step,time:after.audioTime,paused:after.paused},events:after.events}));
    await page.close();
    const waiting=await open('freeze-wait');const wc=await context.newCDPSession(waiting);await wc.send('Page.enable');
    await waiting.locator('#stopBtn').click();await waiting.locator('#bunny').click();const wBefore=await sample(waiting);
    await wc.send('Page.setWebLifecycleState',{state:'frozen'});await sleep(4000);await wc.send('Page.setWebLifecycleState',{state:'active'});const wImmediate=await sample(waiting);await waiting.waitForTimeout(150);const wAfter=await sample(waiting);
    result.cases.push({name:'CDP freeze request 4 seconds during 900 ms solo wait; verify observed events',freezeObserved:wAfter.events.some(e=>e.name==='freeze'),before:wBefore,immediate:wImmediate,after:wAfter});
    console.log(JSON.stringify({name:'freeze-wait',before:{step:wBefore.step,log:wBefore.log},immediate:{step:wImmediate.step,log:wImmediate.log},after:{step:wAfter.step,log:wAfter.log},events:wAfter.events}));
    await waiting.close();
  }
} catch(e){result.fatal=String(e);console.error(e);}finally{result.artifactAfter=hash('public/learn/xue-er/1/index.html');await browser.close();fs.writeFileSync(`${out}/${round}-${mode}.json`,JSON.stringify(result,null,2));console.log(`saved ${round}-${mode}.json`);}
