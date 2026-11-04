import { chromium } from '@playwright/test';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
const root = '/Users/mengxionghan/workspace/lunyu-storybook';
if (process.cwd() !== root) throw new Error('Run from the explicit target workdir');
const out = `${root}/docs/reviews`;
const round = process.env.REVIEW_ROUND || 'round1';
const chrome = process.env.CHROME_PATH || '/Users/mengxionghan/Library/Caches/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-mac-arm64/chrome-headless-shell';
const sha = data => crypto.createHash('sha256').update(data).digest('hex');
const files = ['src/app.js','src/styles.css','src/index.html','src/home.html','src/home.css','src/home.js','src/catalog.json','scripts/build.mjs','package-lock.json','public/index.html','public/learn/xue-er/1/index.html','dist/index.html','dist/index-single.html'];
const fingerprint = () => Object.fromEntries(files.map(f => [f,fs.existsSync(`${root}/${f}`) ? {sha256:sha(fs.readFileSync(`${root}/${f}`)),bytes:fs.statSync(`${root}/${f}`).size,mtime:fs.statSync(`${root}/${f}`).mtime.toISOString()} : null]));
const result = {at:new Date().toISOString(),head:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),filesBefore:fingerprint(),measurements:[],errors:[],navigation:{},offline:{}};
const browser = await chromium.launch({executablePath:chrome,headless:true,args:['--autoplay-policy=user-gesture-required']});
result.browser = browser.version(); result.launch={executablePath:chrome,headless:true};
const context = await browser.newContext();
function watch(page, label) {
  const requests = [];
  page.on('pageerror', e => result.errors.push({label,type:'pageerror',text:String(e)}));
  page.on('console', m => {if(m.type()==='error') result.errors.push({label,type:'console',text:m.text()});});
  page.on('requestfailed', r => result.errors.push({label,type:'requestfailed',url:r.url(),error:r.failure()}));
  page.on('response', r => {if(r.status()>=400) result.errors.push({label,type:'http',url:r.url(),status:r.status()});});
  page.on('request', r => {if(!r.url().startsWith('data:')) requests.push({url:r.url(),type:r.resourceType()});});
  return requests;
}
const rects = () => {
  const rect = el => {const r=el.getBoundingClientRect();return {x:r.x,y:r.y+scrollY,width:r.width,height:r.height,right:r.right,bottom:r.bottom+scrollY};};
  const overlap = (a,b) => Math.min(a.right,b.right)-Math.max(a.x,b.x)>0.5 && Math.min(a.bottom,b.bottom)-Math.max(a.y,b.y)>0.5;
  const elements = sels => sels.map(sel=>{const el=document.querySelector(sel),s=getComputedStyle(el);return {selector:sel,...rect(el),position:s.position,left:s.left,bottomCSS:s.bottom,transform:s.transform,font:s.fontSize,aria:el.getAttribute('aria-label')};});
  const roles=elements(['#elephant','#bunny','#cat','#dog']);
  const controls=elements(['#homeBtn','#pauseBtn','#stopBtn']);
  const overlaps = items => items.flatMap((a,i)=>items.slice(i+1).filter(b=>overlap(a,b)).map(b=>[a.selector,b.selector]));
  return {viewport:{width:innerWidth,height:innerHeight},scrollWidth:document.documentElement.scrollWidth,scrollHeight:document.documentElement.scrollHeight,book:rect(document.querySelector('#book')),roles,controls,roleOverlaps:overlaps(roles),controlOverlaps:overlaps(controls),roleControlOverlaps:roles.flatMap(a=>controls.filter(b=>overlap(a,b)).map(b=>[a.selector,b.selector])),fonts:[...document.querySelectorAll('.card')].map(c=>({text:getComputedStyle(c.querySelector('.txt')).fontSize,pinyin:getComputedStyle(c.querySelector('rt')).fontSize,opacity:getComputedStyle(c).opacity,bounds:rect(c)})),roleImages:roles.map(r=>({selector:r.selector,images:[...document.querySelector(r.selector).querySelectorAll('img')].map(img=>({naturalWidth:img.naturalWidth,...rect(img)}))})),state:document.querySelector('#book').dataset.step};
};
try {
  for (const [width,height] of [[1440,900],[1024,768],[768,1024],[844,390],[390,844],[320,568]]) {
    const page=await context.newPage();await page.setViewportSize({width,height});
    const requests=watch(page,`${width}x${height}`);
    const response=await page.goto('http://127.0.0.1:4173/',{waitUntil:'networkidle'});
    const homeHTML=await response.text();
    const home=await page.evaluate(()=>({names:[...document.querySelectorAll('.volume-name')].map(e=>e.textContent),unavailable:document.querySelectorAll('.unavailable').length,unavailableStates:[...document.querySelectorAll('.unavailable')].map(e=>({label:e.querySelector('[aria-label]')?.getAttribute('aria-label'),links:e.querySelectorAll('a,button,[tabindex]').length})),links:[...document.querySelectorAll('a')].map(e=>({href:e.getAttribute('href'),label:e.getAttribute('aria-label')})),audioTags:document.querySelectorAll('audio').length,prefetch:document.querySelectorAll('link[rel="prefetch"],link[rel="preload"],link[rel="prerender"]').length,scrollWidth:document.documentElement.scrollWidth,first:(()=>{const r=document.querySelector('#first-chapter').getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,bottom:r.bottom};})()}));
    home.bytes=Buffer.byteLength(homeHTML);home.sha256=sha(homeHTML);home.audioURIs=(homeHTML.match(/data:audio/g)||[]).length;home.requests=[...requests];
    home.sourceMatches=homeHTML.includes(fs.readFileSync(`${root}/src/home.js`,'utf8')) && homeHTML.includes(fs.readFileSync(`${root}/src/home.css`,'utf8'));
    await page.screenshot({path:`${out}/${round}-home-${width}x${height}.png`,fullPage:true,animations:'disabled'});
    await page.locator('#first-chapter').click();await page.waitForURL('**/learn/xue-er/1/');await page.waitForLoadState('networkidle');
    await page.locator('#stopBtn').click();await page.waitForTimeout(100);
    const chapter=await page.evaluate(rects);
    const served=await page.content();chapter.embeddedAudio=(served.match(/data:audio\/mpeg;base64,/g)||[]).length;
    chapter.sourceMatches=served.includes(fs.readFileSync(`${root}/src/app.js`,'utf8').split('\n').slice(3).join('\n')) && served.includes(fs.readFileSync(`${root}/src/styles.css`,'utf8'));
    chapter.hitTests=[];
    for (const selector of ['#elephant','#bunny','#cat','#dog','#homeBtn','#pauseBtn','#stopBtn']) {
      await page.locator(selector).scrollIntoViewIfNeeded();
      chapter.hitTests.push(await page.locator(selector).evaluate(el=>{const r=el.getBoundingClientRect(),at=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return {id:el.id,centerTarget:at?.closest('button,a')?.id,withinViewport:r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight};}));
    }
    await page.locator('.card').last().scrollIntoViewIfNeeded();
    chapter.scrolledControls=await page.evaluate(()=>[...document.querySelectorAll('header .ctl')].map(el=>{const r=el.getBoundingClientRect();return {id:el.id,x:r.x,y:r.y,width:r.width,height:r.height,visible:r.x>=0&&r.right<=innerWidth&&r.y>=0&&r.bottom<=innerHeight,centerTarget:document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)?.closest('button,a')?.id};}));
    await page.evaluate(()=>scrollTo(0,0));
    await page.screenshot({path:`${out}/${round}-chapter-stopped-${width}x${height}.png`,fullPage:true,animations:'disabled'});
    result.measurements.push({width,height,home,chapter});
    console.log(JSON.stringify({width,height,homeBytes:home.bytes,homeAudio:home.audioURIs,chapterAudio:chapter.embeddedAudio,roles:chapter.roles.map(r=>({id:r.selector,x:r.x,y:r.y,w:r.width,h:r.height})),font:chapter.fonts[0],overlaps:[...chapter.roleOverlaps,...chapter.controlOverlaps,...chapter.roleControlOverlaps],sourceMatches:chapter.sourceMatches}));
    await page.close();
  }
  const page=await context.newPage();watch(page,'navigation');
  await page.goto('http://127.0.0.1:4173/',{waitUntil:'networkidle'});
  await page.keyboard.press('Tab');result.navigation.homeTab=await page.evaluate(()=>document.activeElement.id);
  await page.keyboard.press('Enter');await page.waitForURL('**/learn/xue-er/1/');
  const reload=await page.reload({waitUntil:'networkidle'});result.navigation.deepReload={url:page.url(),status:reload.status(),startVisible:await page.locator('#startBtn').isVisible()};
  await page.locator('#homeBtn').click();await page.waitForURL('**/#xue-er');
  result.navigation.return={url:page.url(),focus:await page.evaluate(()=>document.activeElement.id)};
  const missing=await context.request.get('http://127.0.0.1:4173/learn/wei-zheng/1/');result.navigation.unknownChapterStatus=missing.status();
  await page.close();
  const offline=await context.newPage();const offRequests=watch(offline,'offline');
  await offline.goto(pathToFileURL(`${root}/dist/index.html`).href,{waitUntil:'load'});
  result.offline.home={url:offline.url(),link:await offline.locator('#first-chapter').getAttribute('href'),audioURIs:((await offline.content()).match(/data:audio/g)||[]).length};
  await offline.locator('#first-chapter').click();await offline.waitForURL('**/index-single.html');
  await offline.locator('#stopBtn').click();await offline.locator('#cat').click();
  await offline.waitForFunction(()=>window.__log.some(x=>x.key==='c2'),null,{timeout:5000});await offline.waitForTimeout(300);
  result.offline.chapter=await offline.evaluate(()=>({url:location.href,step:document.querySelector('#book').dataset.step,paused:__demo.audio.paused,currentTime:__demo.audio.currentTime,log:__log}));
  await offline.locator('#homeBtn').click();await offline.waitForURL('**/index.html#xue-er');
  result.offline.return={url:offline.url(),focus:await offline.evaluate(()=>document.activeElement.id)};
  await offline.goto(pathToFileURL(`${root}/dist/index-single.html`).href,{waitUntil:'load'});
  result.offline.directStart=await offline.locator('#startBtn').isVisible();result.offline.network=offRequests.filter(r=>!r.url.startsWith('file:'));
  await offline.close();
  const nojs=await browser.newContext({javaScriptEnabled:false});const staticPage=await nojs.newPage();await staticPage.goto('http://127.0.0.1:4173/');
  result.homeWithoutJS={names:await staticPage.locator('.volume-name').count(),link:await staticPage.locator('#first-chapter').getAttribute('href')};await nojs.close();
} catch(e) {result.fatal=String(e);console.error(e);} finally {
  result.filesAfter=fingerprint();await browser.close();fs.writeFileSync(`${out}/${round}-layout.json`,JSON.stringify(result,null,2));
  console.log(JSON.stringify({report:`${out}/${round}-layout.json`,errors:result.errors,fatal:result.fatal,navigation:result.navigation,offline:result.offline}));
}
