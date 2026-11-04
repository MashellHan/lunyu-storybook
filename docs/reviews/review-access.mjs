import {chromium} from '@playwright/test';
import fs from 'node:fs';
import crypto from 'node:crypto';
const root='/Users/mengxionghan/workspace/lunyu-storybook';if(process.cwd()!==root)throw new Error('Explicit target workdir required');
const round=process.env.REVIEW_ROUND||'round1';const chrome=process.env.CHROME_PATH||'/Users/mengxionghan/Library/Caches/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-mac-arm64/chrome-headless-shell';
const result={at:new Date().toISOString(),method:'Chromium keyboard and synthesized touch; no physical device or screen reader.',artifactSha256:crypto.createHash('sha256').update(fs.readFileSync('public/learn/xue-er/1/index.html')).digest('hex'),errors:[]};
const browser=await chromium.launch({executablePath:chrome,headless:true,args:['--autoplay-policy=user-gesture-required']});result.browser=browser.version();
const watch=p=>p.on('pageerror',e=>result.errors.push(String(e)));
try{
  const keyboard=await browser.newPage({viewport:{width:390,height:844}});watch(keyboard);await keyboard.goto('http://127.0.0.1:4173/learn/xue-er/1/');
  result.titleTabOrder=[];for(let i=0;i<4;i++){await keyboard.keyboard.press('Tab');result.titleTabOrder.push(await keyboard.evaluate(()=>document.activeElement.id));}
  await keyboard.locator('#stopBtn').focus();await keyboard.keyboard.press('Space');result.keyboardStop=await keyboard.evaluate(()=>({step:document.querySelector('#book').dataset.step,focus:document.activeElement.id,outline:getComputedStyle(document.activeElement).outline}));
  result.freeTabOrder=[];for(let i=0;i<7;i++){await keyboard.keyboard.press('Tab');result.freeTabOrder.push(await keyboard.evaluate(()=>({id:document.activeElement.id,label:document.activeElement.getAttribute('aria-label'),outline:getComputedStyle(document.activeElement).outline,focusVisible:document.activeElement.matches(':focus-visible')})));}
  await keyboard.locator('#cat').focus();await keyboard.keyboard.press('Enter');await keyboard.waitForFunction(()=>__log.at(-1)?.key==='c2');await keyboard.waitForTimeout(300);result.keyboardRead=await keyboard.evaluate(()=>({step:document.querySelector('#book').dataset.step,paused:__demo.audio.paused,time:__demo.audio.currentTime}));
  result.content=await keyboard.evaluate(()=>[...document.querySelectorAll('.card')].map(e=>({label:e.getAttribute('aria-label'),characters:[...e.querySelectorAll('.k')].map(k=>({char:k.querySelector('ruby')?.firstChild?.textContent||k.textContent,pinyin:k.querySelector('rt')?.textContent||''}))})));
  await keyboard.close();
  const ctx=await browser.newContext({hasTouch:true,isMobile:true,viewport:{width:390,height:844},deviceScaleFactor:1});const touch=await ctx.newPage();watch(touch);await touch.goto('http://127.0.0.1:4173/learn/xue-er/1/');await touch.locator('#stopBtn').tap();
  result.touch=[];
  for(const [selector,key] of [['#bunny','b1'],['#cat','c2'],['#dog','d3'],['#elephant','trumpet'],['.card:nth-child(1)','e1'],['.card:nth-child(2)','e2'],['.card:nth-child(3)','e3']]){
    await touch.locator('#stopBtn').tap();const start=await touch.evaluate(()=>__log.length);await touch.locator(selector).tap();await touch.waitForFunction(({start,key})=>__log.length>start&&__log.at(-1)?.key===key,{start,key},{timeout:5000});await touch.waitForTimeout(250);result.touch.push(await touch.evaluate(selector=>({selector,step:document.querySelector('#book').dataset.step,paused:__demo.audio.paused,time:__demo.audio.currentTime,key:__log.at(-1)?.key}),selector));
  }
  await ctx.close();
}catch(e){result.fatal=String(e);console.error(e);}finally{await browser.close();result.artifactAfter=crypto.createHash('sha256').update(fs.readFileSync('public/learn/xue-er/1/index.html')).digest('hex');fs.writeFileSync(`${root}/docs/reviews/${round}-access.json`,JSON.stringify(result,null,2));console.log(JSON.stringify(result));}
