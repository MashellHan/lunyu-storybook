import {chromium} from '@playwright/test';
import fs from 'node:fs';
import crypto from 'node:crypto';
const root='/Users/mengxionghan/workspace/lunyu-storybook';
if(process.cwd()!==root)throw new Error('Explicit target workdir required');
const round=process.env.REVIEW_ROUND||'round1',out=`${root}/docs/reviews`;
const chrome=process.env.CHROME_PATH||'/Users/mengxionghan/Library/Caches/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-mac-arm64/chrome-headless-shell';
const hash=f=>crypto.createHash('sha256').update(fs.readFileSync(`${root}/${f}`)).digest('hex');
const result={at:new Date().toISOString(),artifactSha256:hash('public/learn/xue-er/1/index.html'),sourceSha256:hash('src/app.js'),method:'Native pointer/keyboard events; actual audio at playbackRate=8 only to reach late automatic stages; no synthetic ended or lifecycle events.',cases:[],errors:[]};
const browser=await chromium.launch({executablePath:chrome,headless:true,args:['--autoplay-policy=user-gesture-required']});result.browser=browser.version();
const context=await browser.newContext({viewport:{width:1024,height:768}});
await context.addInitScript(()=>{
  window.__reviewAudios=[];window.__reviewPlay=[];
  const NativeAudio=Audio;window.Audio=new Proxy(NativeAudio,{construct(t,args){const a=Reflect.construct(t,args);__reviewAudios.push(a);return a;}});
  document.addEventListener('click',e=>{window.__lastClick={t:performance.now(),id:e.target.closest('button,a')?.id||e.target.tagName};},true);
  const play=HTMLMediaElement.prototype.play;
  HTMLMediaElement.prototype.play=function(...args){__reviewPlay.push({t:performance.now(),audio:__reviewAudios.indexOf(this),gesture:navigator.userActivation.isActive,click:window.__lastClick});return play.apply(this,args);};
});
async function open(label){const p=await context.newPage();p.on('pageerror',e=>result.errors.push({label,error:String(e)}));p.on('console',m=>{if(m.type()==='error')result.errors.push({label,console:m.text()});});await p.goto('http://127.0.0.1:4173/learn/xue-er/1/',{waitUntil:'load'});return p;}
const state=p=>p.evaluate(()=>({step:document.querySelector('#book').dataset.step,audioPaused:__demo.audio.paused,audioTime:__demo.audio.currentTime,paused:__demo.paused,pausePressed:document.querySelector('#pauseBtn').getAttribute('aria-pressed'),log:__log.map(x=>x.key),stars:document.querySelectorAll('.star.on').length,focus:document.querySelectorAll('.playing,.k.cur,.busy').length,bubbles:document.querySelectorAll('.aBubble.show').length,sparks:document.querySelectorAll('.spark').length,titleHidden:getComputedStyle(document.querySelector('#title')).display==='none',castInert:document.querySelector('#cast').inert,cardsInert:document.querySelector('#cards').inert,audioCount:__reviewAudios.length,sameAudio:__demo.audio===__reviewAudios[0],playCalls:__reviewPlay}));
const waitStep=(p,s)=>p.waitForFunction(s=>document.querySelector('#book').dataset.step===s,s,{timeout:60000});
async function stopCase(stage){const p=await open(stage);const item={stage};try{
  if(stage!=='title'){
    await p.evaluate(()=>{window.__reviewRate=8;const a=__demo.audio;a.defaultPlaybackRate=8;a.playbackRate=8;a.addEventListener('loadedmetadata',()=>{a.defaultPlaybackRate=window.__reviewRate;a.playbackRate=window.__reviewRate;});});
    await p.locator('#startBtn').click();await waitStep(p,stage==='paused'?'e1':stage);
    if(stage==='paused'){await p.locator('#pauseBtn').click();item.pauseBefore=await state(p);await p.waitForTimeout(1000);item.pauseAfter=await state(p);}
  }
  item.before=await state(p);await p.locator('#stopBtn').click();item.immediate=await state(p);await p.waitForTimeout(3000);item.after3s=await state(p);
  item.stopPass=item.immediate.step==='free' && item.immediate.audioPaused && !item.immediate.paused && item.immediate.focus===0 && item.immediate.bubbles===0 && item.immediate.sparks===0 && item.immediate.titleHidden && !item.immediate.castInert && !item.immediate.cardsInert && item.immediate.stars===item.before.stars && item.after3s.step==='free' && item.after3s.audioPaused && item.after3s.log.length===item.immediate.log.length && item.after3s.stars===item.before.stars;
  await p.evaluate(()=>{window.__reviewRate=1;__demo.audio.defaultPlaybackRate=1;__demo.audio.playbackRate=1;});
  await p.locator('#cat').click();await p.waitForFunction(()=>__log.at(-1)?.key==='c2',null,{timeout:5000});await p.waitForTimeout(300);item.nextClick=await state(p);item.clickPass=!item.nextClick.audioPaused && item.nextClick.audioTime>0 && item.nextClick.sameAudio && item.nextClick.audioCount===1;
}catch(e){item.error=String(e);}finally{result.cases.push(item);console.log(JSON.stringify({stage,stopPass:item.stopPass,clickPass:item.clickPass,starsBefore:item.before?.stars,starsAfter:item.after3s?.stars,error:item.error}));await p.close();}}
try{
  for(const stages of [['title','title-voice','intro'],['e1','u1','paused'],['solo-bunny','sound-dog','celebrate']]) await Promise.all(stages.map(stopCase));
  const p=await open('rapid-and-cards');await p.locator('#stopBtn').click();await p.locator('#cat').click();await p.waitForFunction(()=>__log.at(-1)?.key==='c2');await p.waitForTimeout(200);const before=await state(p);
  for(const id of ['dog','cat','bunny']){await p.locator(`#${id}`).click();await p.waitForTimeout(40);}
  await p.waitForFunction(()=>__log.at(-1)?.key==='b1');await p.waitForTimeout(300);const after=await state(p);
  result.cases.push({stage:'rapid cat playing -> dog -> cat -> bunny',before,after,pass:after.sameAudio&&after.audioCount===1&&!after.audioPaused&&after.log.slice(before.log.length).join(',')==='b1'});
  await p.locator('#stopBtn').click();
  await p.evaluate(()=>{const a=__demo.audio;a.defaultPlaybackRate=8;a.playbackRate=8;a.addEventListener('loadedmetadata',()=>a.playbackRate=8);});
  const interactions=[];
  for(const selector of ['#bunny','#cat','#dog','#elephant','.card:nth-child(1)','.card:nth-child(2)','.card:nth-child(3)']){
    const begin=await p.evaluate(()=>__log.length);await p.locator(selector).click();await p.waitForFunction(n=>__log.length>n,begin).catch(()=>{});
    await waitStep(p,'free');interactions.push({selector,log:await p.evaluate(n=>__log.slice(n).map(x=>x.key),begin)});
  }
  result.cases.push({stage:'all four animals and three sentence cards',interactions});await p.close();
  const reduce=await open('reduced-motion');await reduce.emulateMedia({reducedMotion:'reduce'});await reduce.locator('#stopBtn').click();await reduce.locator('.card').first().click();await waitStep(reduce,'e1');
  const transformAnimations=await reduce.evaluate(()=>document.getAnimations().filter(a=>a.playState==='running'&&a.effect?.getKeyframes().some(k=>k.transform&&k.transform!=='none')).map(a=>a.effect.target?.id||a.effect.target?.className));
  result.cases.push({stage:'runtime reduced-motion while reading',transformAnimations,state:await state(reduce)});await reduce.close();
}catch(e){result.fatal=String(e);console.error(e);}finally{result.artifactAfter=hash('public/learn/xue-er/1/index.html');await browser.close();fs.writeFileSync(`${out}/${round}-stops.json`,JSON.stringify(result,null,2));console.log(`saved ${round}-stops.json`);}
