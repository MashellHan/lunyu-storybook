import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {chromium} from '@playwright/test';
const ROOT='/Users/mengxionghan/workspace/lunyu-storybook';
if(process.cwd()!==ROOT)throw new Error('Use explicit target workdir');
const dir='docs/reviews/xue-er-phase-b-early',previous=JSON.parse(fs.readFileSync(dir+'/evidence.json','utf8'));
const file='build/xue-er-preview/xue-er-15.html',html=fs.readFileSync(file,'utf8');
const data=JSON.parse(html.match(/^const CHAPTER = (.*);$/m)[1]);
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const result={reviewedAt:new Date().toISOString(),kind:'targeted-tail-after-screenshot-timeout',file,htmlSHA256:sha(html),pages:[],findings:[],screenshots:[],
 diagnostic:'Initial 60 completed page/viewport observations passed; screenshot timeout at chapter 15 page 3, 844x390. Only final two page observations repeated/completed.'};
const check=(ok,message)=>{if(!ok)result.findings.push(message);};
check(result.htmlSHA256===previous.inputSha256[file],'Preview snapshot changed since first probe');
let browser;
try{
 browser=await chromium.launch({headless:true,executablePath:'/Users/mengxionghan/Library/Caches/ms-playwright/chromium-1248/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing'});
 const context=await browser.newContext({viewport:{width:844,height:390},reducedMotion:'reduce'});
 const page=await context.newPage();page.setDefaultTimeout(10000);
 const errors=[],network=[];
 page.on('pageerror',e=>errors.push(String(e)));
 page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 page.on('request',r=>{if(/^https?:/.test(r.url()))network.push(r.url());});
 await page.goto(pathToFileURL(path.join(ROOT,file)).href);
 await page.waitForFunction(()=>!!window.__demo?.chapter);
 await page.locator('#nextPage').click();await page.locator('#nextPage').click();
 for(const index of [2,3]){
  if(index===3)await page.locator('#nextPage').click();
  const focusAfterNavigation=await page.evaluate(()=>document.activeElement?.id);
  await page.evaluate(async()=>{scrollTo(0,0);await document.fonts.ready;await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));});
  const state=await page.evaluate(()=>{
   const rect=e=>{const r=e.getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom};};
   return{page:document.querySelector('#book').dataset.page,
    cells:[...document.querySelectorAll('#cards .k')].map(e=>{const x=e.cloneNode(true);x.querySelectorAll('rt').forEach(n=>n.remove());return{char:x.textContent,py:e.querySelector('rt')?.textContent||'',segmentId:e.dataset.segment,chapterIndex:Number(e.dataset.sourceIndex)};}),
    groups:[...document.querySelectorAll('.card')].map(e=>({id:e.dataset.group,disabled:e.disabled})),
    chars:[...document.querySelectorAll('#cast>.char')].map(e=>({id:e.id,disabled:e.disabled,...rect(e)})),
    props:[...document.querySelectorAll('.scene-prop')].map(e=>({id:e.dataset.prop,tag:e.tagName,tabIndex:e.tabIndex,ariaHidden:e.getAttribute('aria-hidden'),pointerEvents:getComputedStyle(e).pointerEvents,...rect(e)})),
    controls:[...document.querySelectorAll('header a,header button,.page-controls button')].map(e=>({id:e.id,disabled:!!e.disabled,...rect(e)})),
    minTextPx:Math.min(...[...document.querySelectorAll('.card .txt')].map(e=>parseFloat(getComputedStyle(e).fontSize))),
    minPinyinPx:Math.min(...[...document.querySelectorAll('.card rt')].map(e=>parseFloat(getComputedStyle(e).fontSize))),
    preview:document.querySelector('#book').dataset.preview,playable:document.querySelector('#book').dataset.playable,
    step:document.querySelector('#book').dataset.step,audioSrc:window.__demo.audio.getAttribute('src'),audioPaused:window.__demo.audio.paused,
    log:[...window.__log],pendingWaits:window.__demo.pendingWaits,stars:document.querySelector('#stars').getAttribute('aria-label'),
    prevDisabled:document.querySelector('#prevPage').disabled,nextDisabled:document.querySelector('#nextPage').disabled,
    readDisabled:document.querySelector('#readBtn').disabled,scrollWidth:document.documentElement.scrollWidth,
    activeAnimations:document.getAnimations().filter(a=>a.playState==='running').length,brokenImages:[...document.images].filter(e=>!e.complete||!e.naturalWidth).length};
  });
  const expected=data.pages[index],expectedCells=expected.groups.flatMap(g=>g.segments.flatMap(s=>[...s.text].map((char,i)=>({char,py:s.py[i],segmentId:s.id,chapterIndex:s.start+i}))));
  check(state.page===expected.pageId,expected.pageId+': page identity');
  check(JSON.stringify(state.cells)===JSON.stringify(expectedCells),expected.pageId+': exact text, pinyin, attribution, source offsets');
  check(JSON.stringify(state.groups.map(g=>g.id))===JSON.stringify(expected.groups.map(g=>g.id)),expected.pageId+': group order');
  check(JSON.stringify(state.props.map(p=>p.id).sort())===JSON.stringify([...expected.visiblePropIds].sort()),expected.pageId+': prop visibility');
  check(state.props.every(p=>p.tag==='DIV'&&p.ariaHidden==='true'&&p.pointerEvents==='none'&&p.tabIndex===-1),expected.pageId+': decorative preview props');
  check(state.preview==='true'&&state.playable==='false'&&state.readDisabled&&state.chars.every(c=>c.disabled)&&state.groups.every(g=>g.disabled),expected.pageId+': non-ready inputs disabled');
  check(!state.audioSrc&&state.audioPaused&&state.log.length===0&&state.pendingWaits===0&&state.step==='free',expected.pageId+': no audio or progression');
  check(state.minTextPx>=24&&state.minPinyinPx>=14&&state.scrollWidth<=844,expected.pageId+': fonts/width');
  check(state.chars.length===4&&state.chars.every(c=>c.x>=0&&c.right<=844&&c.width>=80&&c.height>=80),expected.pageId+': four role bounds');
  check(state.controls.every(c=>c.x>=0&&c.right<=844&&c.width>=48&&c.height>=48),expected.pageId+': control bounds');
  check(!state.prevDisabled&&state.nextDisabled===(index===3)&&focusAfterNavigation===(index===3?'prevPage':'nextPage'),expected.pageId+': page bounds and focus');
  check(state.stars==='0 / '+expected.groups.length&&state.activeAnimations===0&&state.brokenImages===0,expected.pageId+': static no fake completion');
  await page.locator('#cards').evaluate(e=>e.scrollIntoView({block:'end',behavior:'instant'}));
  const screenshot=dir+'/xue-er-15-p'+(index+1)+'-844x390-reading.png';
  await page.screenshot({path:screenshot,timeout:20000,fullPage:false});
  result.screenshots.push(screenshot);result.pages.push({...state,focusAfterNavigation,viewportWidth:844,viewportHeight:390});
 }
 for(const i of [2,1,0]){
  await page.locator('#prevPage').click();
  check(await page.locator('#book').getAttribute('data-page')===data.pages[i].pageId,'backward navigation p'+(i+1));
 }
 check(errors.length===0&&network.length===0,'No console errors or network resource requests');
 result.errors=errors;result.networkRequests=network;
 await context.close();
}catch(error){result.findings.push(error.message);result.fatal=error.stack;}
finally{
 if(browser)await browser.close();
 result.inputBytesUnchanged=sha(fs.readFileSync(file))===result.htmlSHA256;
 result.status=result.findings.length?'needs-review':'passed-targeted-tail';
 fs.writeFileSync(dir+'/tail-evidence.json',JSON.stringify(result,null,2)+'\n');
 console.log(JSON.stringify({status:result.status,findings:result.findings,pages:result.pages.length,screenshots:result.screenshots},null,2));
 if(result.findings.length)process.exitCode=1;
}
