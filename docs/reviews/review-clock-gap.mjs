import {chromium} from '@playwright/test';
import fs from 'node:fs';
import crypto from 'node:crypto';
const root='/Users/mengxionghan/workspace/lunyu-storybook';if(process.cwd()!==root)throw new Error('Explicit target workdir required');
const round=process.env.REVIEW_ROUND||'round1';const chrome=process.env.CHROME_PATH||'/Users/mengxionghan/Library/Caches/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-mac-arm64/chrome-headless-shell';
const hash=f=>crypto.createHash('sha256').update(fs.readFileSync(`${root}/${f}`)).digest('hex');
const report={at:new Date().toISOString(),method:'Synthetic monotonic-clock gap while paused, not real background/freezing. Fallback case explicitly injects a rejected play() promise. Normal pause uses actual elapsed time.',artifactSha256:hash('public/learn/xue-er/1/index.html'),sourceSha256:hash('src/app.js'),cases:[],errors:[]};
const browser=await chromium.launch({executablePath:chrome,headless:true,args:['--autoplay-policy=user-gesture-required']});
const sample=p=>p.evaluate(()=>({step:document.querySelector('#book').dataset.step,paused:__demo.paused,audioPaused:__demo.audio.paused,audioTime:__demo.audio.currentTime,log:__log.map(x=>x.key),currentGlyphs:[...document.querySelectorAll('.k.cur')].map(e=>e.textContent),now:performance.now()}));
const waitStep=(p,s)=>p.waitForFunction(s=>document.querySelector('#book').dataset.step===s,s,{timeout:30000});
async function run(kind){const page=await browser.newPage({viewport:{width:1024,height:768}});const c={kind};page.on('pageerror',e=>report.errors.push({kind,error:String(e)}));try{
  await page.goto('http://127.0.0.1:4173/learn/xue-er/1/',{waitUntil:'load'});
  if(kind==='normal-pause'){await page.locator('#startBtn').click();await waitStep(page,'e1');await page.locator('#pauseBtn').click();c.before=await sample(page);await page.waitForTimeout(1200);c.paused=await sample(page);await page.locator('#pauseBtn').click();await page.waitForTimeout(600);c.after=await sample(page);c.pass=Math.abs(c.paused.audioTime-c.before.audioTime)<.08 && c.paused.step==='e1' && c.after.step==='e1' && c.after.audioTime>c.before.audioTime;}
  else {
    if(kind==='media'){
      await page.locator('#startBtn').click();await waitStep(page,'e1');
      await page.waitForFunction(()=>__demo.audio.currentTime>.15&&!__demo.audio.paused,null,{timeout:5000});
    }else{
      await page.locator('#stopBtn').click();
      if(kind==='fallback')await page.evaluate(()=>{HTMLMediaElement.prototype.play=function(){return Promise.reject(new DOMException('Review-injected audio denial','NotAllowedError'));};});
      if(kind==='wait')await page.locator('#bunny').click();else {await page.locator('.card').first().click();await waitStep(page,'e1');await page.waitForTimeout(80);}
    }
    c.before=await sample(page);
    c.gapMs=kind==='wait'?4000:12000;
    await page.evaluate(gapMs=>{const realNow=performance.now.bind(performance);let gap=0;Object.defineProperty(performance,'now',{configurable:true,value:()=>realNow()+gap});document.querySelector('#pauseBtn').click();gap=gapMs;document.querySelector('#pauseBtn').click();},c.gapMs);
    await page.waitForTimeout(kind==='wait'?400:700);c.after=await sample(page);
    c.pass=kind==='wait'?c.after.step==='solo-bunny'&&c.after.log.length===c.before.log.length:c.after.step==='e1'&&c.after.log.length===c.before.log.length;
    if(kind==='media')c.pass=c.pass&&!c.after.audioPaused&&c.after.audioTime>c.before.audioTime+.2;
    if(kind==='wait'){await page.waitForFunction(()=>__log.at(-1)?.key==='b1',null,{timeout:3000});c.eventually=await sample(page);}
  }
}catch(e){c.error=String(e);}finally{report.cases.push(c);console.log(JSON.stringify(c));await page.close();}}
try{await Promise.all(['media','wait','fallback','normal-pause'].map(run));}finally{await browser.close();report.artifactAfter=hash('public/learn/xue-er/1/index.html');fs.writeFileSync(`${root}/docs/reviews/${round}-clock-gap.json`,JSON.stringify(report,null,2));}
