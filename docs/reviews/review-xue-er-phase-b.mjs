import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {chromium} from '@playwright/test';

const ROOT='/Users/mengxionghan/workspace/lunyu-storybook';
if(process.cwd()!==ROOT) throw new Error('Use the explicit target workdir');
const out='docs/reviews/xue-er-phase-b-early';
fs.mkdirSync(path.join(ROOT,out),{recursive:true});
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const read=f=>fs.readFileSync(path.join(ROOT,f),'utf8');
const readJSON=f=>JSON.parse(read(f));
const content=readJSON('docs/content/xue-er.json');
const design=readJSON('docs/design/xue-er-scene-config.json');
const report={reviewedAt:new Date().toISOString(),kind:'unfrozen-stage-B-static-preview-review',
 scope:'Existing HTTP service and file previews only; no build, synthesis, media edits, full suite or old-player matrix.',
 checks:0,findings:[],previewFiles:[],httpRoutes:[],directories:[],pages:[],screenshots:[],
 limitations:['Not a frozen release verdict.','Actual new media, sound, word boundaries, cue playback, human listening and physical devices not verified.']};
const check=(ok,where,message)=>{report.checks++;if(!ok)report.findings.push({where,message});};
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const fileFor=n=>'build/xue-er-preview/'+(n===1?'index-single.html':'xue-er-'+String(n).padStart(2,'0')+'.html');
const files=['docs/content/xue-er.json','docs/design/xue-er-scene-config.json','docs/content/xue-er-validation.json',
 'src/catalog.json','src/chapter-media.json','src/chapter-player.js','src/chapter.css','src/app.js','src/index.html','src/styles.css',
 'src/volume.html','src/volume.css','scripts/build.mjs','scripts/chapter-data.mjs',
 'public/learn/xue-er/index.html','public/learn/xue-er/1/index.html',
 'build/xue-er-preview/xue-er.html',...content.chapters.map(c=>fileFor(c.number))];
const snapshot=()=>Object.fromEntries(files.map(f=>[f,hash(fs.readFileSync(path.join(ROOT,f)))]));
report.inputSha256=snapshot();
const payloads=new Map();
function embedded(html,name){
 const m=html.match(new RegExp('^const '+name+' = (.*);$','m'));
 if(!m)throw new Error('Missing '+name+' in built HTML');
 return JSON.parse(m[1]);
}
check(report.inputSha256['docs/content/xue-er.json']==='85168c306fd68f1006f96ce189801b387252fcfef9fcdc982c0388705cb13b73','content','frozen text SHA');
check(report.inputSha256['docs/design/xue-er-scene-config.json']==='13be8fad01ccda687f94222c0656b378e7a7ff8f9dc4d6d3380d57163b47ff4a','scene','formal scene SHA');
for(const chapter of content.chapters){
 const file=fileFor(chapter.number),html=read(file),data=embedded(html,'CHAPTER');
 payloads.set(chapter.number,data);
 const expectedScene=design.chapters[chapter.number-1],segments=Object.fromEntries(chapter.segments.map(s=>[s.id,s]));
 check(data.preview===true && data.playable===false,file,'preview cannot play');
 check(data.id===chapter.id&&data.number===chapter.number&&data.title===chapter.title,file,'chapter identity');
 check(data.contentSHA256===report.inputSha256['docs/content/xue-er.json'],file,'content SHA embedded');
 check(Object.keys(embedded(html,'AUD')).length===0&&Object.keys(embedded(html,'TIM')).length===0&&!/data:audio/i.test(html),file,'no audio payload');
 check(data.pages.map(p=>p.pageId).join('|')===expectedScene.pages.map(p=>p.pageId).join('|'),file,'page identities and order');
 const actualText=data.pages.flatMap(p=>p.groups).map(g=>g.text).join('');
 const actualPy=data.pages.flatMap(p=>p.groups).flatMap(g=>g.py);
 check(actualText===chapter.fullText&&same(actualPy,chapter.segments.flatMap(s=>s.pinyin)),file,'full text/pinyin concat');
 check(same(data.pages.flatMap(p=>p.groups).flatMap(g=>g.segments.map(s=>s.id)),chapter.segments.map(s=>s.id)),file,'segments exactly once in order');
 for(const [i,p]of data.pages.entries()){
  const expected=expectedScene.pages[i];
  for(const key of ['segmentIds','sourceRange','visiblePropIds','propBindings','defaultReadingGroupId','readingGroups'])
   check(same(p[key],expected[key]),p.pageId,'exact scene field '+key);
  for(const group of p.groups){
   const expectedGroup=expected.readingGroups.find(g=>g.id===group.id);
   check(!!expectedGroup&&same(group.segmentIds,expectedGroup.segmentIds)&&same(group.audio,expectedGroup.audio)
      &&group.responder===expectedGroup.responder&&group.onReadCompleteCueId===expectedGroup.onReadCompleteCueId,group.id,'reading and cue references');
   for(const segment of group.segments){
    const original=segments[segment.id];
    check(!!original&&segment.text===original.text&&same(segment.py,original.pinyin)
       &&segment.start===original.start&&segment.end===original.end,segment.id,'segment original positions');
   }
  }
 }
 check(html.includes(read('src/chapter-player.js')),file,'built chapter adapter matches current source at start');
 check(html.includes(read('src/chapter.css')),file,'built chapter style matches current source at start');
 report.previewFiles.push({file,sha256:hash(html),chapter:chapter.number,pages:data.pages.length,segments:chapter.segments.length,codePoints:[...actualText].length,audioPayloads:0});
}
for(const number of Array.from({length:16},(_,i)=>i+1)){
 const url='http://127.0.0.1:4173/learn/xue-er/'+number+'/';
 const response=await fetch(url),bytes=Buffer.from(await response.arrayBuffer());
 report.httpRoutes.push({url,status:response.status,bytes:bytes.length,sha256:hash(bytes),expectedUnavailable:number!==1});
 check(response.status===(number===1?200:404),url,'only legacy demo available in production');
 if(number===1){
  check(hash(bytes)===report.inputSha256['public/learn/xue-er/1/index.html'],url,'HTTP matches local production file');
  check(embedded(bytes.toString(),'CHAPTER')===null,url,'legacy demo remains separate from complete chapter');
  check(Object.keys(embedded(bytes.toString(),'AUD')).length===15,url,'legacy media inventory unchanged');
 }
}
let browser;
try{
 browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||'/Users/mengxionghan/Library/Caches/ms-playwright/chromium-1248/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing'});
 const context=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'});
 const page=await context.newPage();page.setDefaultTimeout(5000);
 let errors=[],requests=[];
 page.on('pageerror',e=>errors.push(String(e)));
 page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 page.on('request',r=>requests.push({url:r.url(),type:r.resourceType()}));
 const settle=()=>page.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.images].map(img=>img.decode().catch(()=>{})));await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));});
 async function directory(url,preview){
  errors=[];requests=[];await page.goto(url);await settle();
  const info=await page.evaluate(()=>({
   entries:[...document.querySelectorAll('.chapter-directory>li')].map(li=>({
    id:li.id,ready:li.dataset.publicationReady,edition:li.dataset.edition,
    title:li.querySelector('.chapter-name').textContent,number:li.querySelector('.chapter-number').textContent,
    href:li.querySelector('a')?.getAttribute('href')||null,disabled:li.querySelector('.chapter-entry')?.getAttribute('aria-disabled')||null,
    aria:li.querySelector('.chapter-entry')?.getAttribute('aria-label')||null})),
   home:document.querySelector('.back')?.getAttribute('href'),audioTags:document.querySelectorAll('audio').length,
   externalScript:document.querySelectorAll('script[src]').length,
   scrollWidth:document.documentElement.scrollWidth,width:innerWidth
  }));
  check(info.entries.length===16,url,'all chapter directory entries');
  check(info.entries.every((e,i)=>e.title===content.chapters[i].title&&Number(e.number)===i+1&&e.ready==='false'),url,'directory text/order and non-ready state');
  check(info.entries.filter(e=>e.href).length===(preview?16:1),url,'only intended links');
  check(preview||info.entries.slice(1).every(e=>e.disabled==='true'&&!e.href),url,'unavailable rows not fake links');
  check(info.audioTags===0&&info.externalScript===0&&!requests.some(r=>r.type==='media'),url,'index has no audio/runtime dependency');
  if(preview)check(info.entries.every(e=>fs.existsSync(path.resolve(path.dirname(path.join(ROOT,'build/xue-er-preview/xue-er.html')),e.href))),url,'all offline links resolve');
  check(info.scrollWidth<=info.width,url,'directory does not overflow');
  check(errors.length===0,url,'no browser errors');
  report.directories.push({url,preview,...info,errors:[...errors],requests:[...requests]});
 }
 await directory('http://127.0.0.1:4173/learn/xue-er/',false);
 await directory(pathToFileURL(path.join(ROOT,'build/xue-er-preview/xue-er.html')).href,true);
 async function state(){
  return page.evaluate(()=>{
   const rect=e=>{const r=e.getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom};};
   const visible=e=>e&&e.getClientRects().length&&getComputedStyle(e).visibility!=='hidden'&&getComputedStyle(e).display!=='none';
   const cells=[...document.querySelectorAll('#cards .k')].map(k=>{
    const cloned=k.cloneNode(true);cloned.querySelectorAll('rt').forEach(e=>e.remove());
    return{char:cloned.textContent,py:k.querySelector('rt')?.textContent||'',segmentId:k.dataset.segment,chapterIndex:Number(k.dataset.sourceIndex)};
   });
   const chars=[...document.querySelectorAll('#cast>.char')].map(e=>({id:e.id,disabled:e.disabled,...rect(e)}));
   const props=[...document.querySelectorAll('.scene-prop')].map(e=>({id:e.dataset.prop,tag:e.tagName,tabIndex:e.tabIndex,ariaHidden:e.getAttribute('aria-hidden'),pointerEvents:getComputedStyle(e).pointerEvents,...rect(e)}));
   const controls=[...document.querySelectorAll('header a,header button,.page-controls button')].map(e=>({id:e.id,disabled:!!e.disabled,visible:!!visible(e),...rect(e)}));
   const texts=[...document.querySelectorAll('#cards .txt')].map(e=>parseFloat(getComputedStyle(e).fontSize));
   const py=[...document.querySelectorAll('#cards rt')].map(e=>parseFloat(getComputedStyle(e).fontSize));
   return{chapter:document.querySelector('#book').dataset.chapter,page:document.querySelector('#book').dataset.page,
    preview:document.querySelector('#book').dataset.preview,playable:document.querySelector('#book').dataset.playable,
    step:document.querySelector('#book').dataset.step,cells,
    groups:[...document.querySelectorAll('#cards .card')].map(e=>({id:e.dataset.group,disabled:e.disabled,aria:e.getAttribute('aria-label')})),
    chars,props,controls,minTextPx:Math.min(...texts),minPinyinPx:Math.min(...py),
    scrollWidth:document.documentElement.scrollWidth,viewportWidth:innerWidth,viewportHeight:innerHeight,
    docHeight:document.documentElement.scrollHeight,scrollY,audioSrc:window.__demo.audio.getAttribute('src'),
    paused:window.__demo.audio.paused,log:[...window.__log],pendingWaits:window.__demo.pendingWaits,
    prevDisabled:document.querySelector('#prevPage').disabled,nextDisabled:document.querySelector('#nextPage').disabled,
    readDisabled:document.querySelector('#readBtn').disabled,stars:document.querySelector('#stars').getAttribute('aria-label'),
    activeElement:document.activeElement?.id,brokenImages:[...document.images].filter(e=>!e.complete||!e.naturalWidth).length,
    activeAnimations:document.getAnimations().filter(a=>a.playState==='running').length};
  });
 }
 for(const viewport of [{width:390,height:844},{width:320,height:844},{width:1024,height:768},{width:844,height:390}]){
  await page.setViewportSize(viewport);
  const chapters=viewport.width<400?content.chapters:content.chapters.filter(c=>[3,15].includes(c.number));
  for(const chapter of chapters){
   const config=payloads.get(chapter.number),file=fileFor(chapter.number);
   errors=[];requests=[];await page.goto(pathToFileURL(path.join(ROOT,file)).href);
   await page.waitForFunction(()=>!!window.__demo?.chapter);await settle();
   for(let index=0;index<config.pages.length;index++){
    if(index)await page.locator('#nextPage').click();
    const focusAfterNavigation=await page.evaluate(()=>document.activeElement?.id);
    await page.evaluate(()=>scrollTo(0,0));await settle();
    const actual=await state(),expected=config.pages[index],location=chapter.id+'/'+expected.pageId+'/'+viewport.width+'x'+viewport.height;
    const expectedCells=expected.groups.flatMap(g=>g.segments.flatMap(s=>[...s.text].map((char,i)=>({char,py:s.py[i],segmentId:s.id,chapterIndex:s.start+i}))));
    check(actual.page===expected.pageId&&actual.chapter===chapter.id,location,'page changes to intended identity');
    check(same(actual.cells,expectedCells),location,'rendered original characters/pinyin/attributions/source offsets');
    check(same(actual.groups.map(g=>g.id),expected.groups.map(g=>g.id)),location,'unique reading group order');
    check(same([...actual.props.map(p=>p.id)].sort(),[...expected.visiblePropIds].sort()),location,'only current-page props rendered');
    check(actual.props.every(p=>p.tag==='DIV'&&p.ariaHidden==='true'&&p.tabIndex===-1&&p.pointerEvents==='none'),location,'preview props decorative, not fake playable targets');
    check(actual.preview==='true'&&actual.playable==='false'&&actual.readDisabled&&actual.chars.every(c=>c.disabled)&&actual.groups.every(g=>g.disabled),location,'all playback inputs disabled in preview');
    check(actual.step==='free'&&actual.paused&&!actual.audioSrc&&actual.log.length===0&&actual.pendingWaits===0,location,'no synthetic playback or hidden audio progression');
    check(actual.prevDisabled===(index===0)&&actual.nextDisabled===(index===config.pages.length-1),location,'navigation bounds');
    check(actual.stars==='0 / '+expected.groups.length,location,'no fake completion');
    check(actual.minTextPx>=24&&actual.minPinyinPx>=14,location,'minimum text and pinyin size');
    check(actual.scrollWidth<=actual.viewportWidth,location,'no horizontal overflow');
    check(actual.chars.every(c=>c.x>=0&&c.right<=actual.viewportWidth&&c.width>=80&&c.height>=80),location,'four actual role bounds');
    check(actual.controls.filter(c=>c.visible).every(c=>c.x>=-1&&c.right<=actual.viewportWidth+1&&c.width>=48&&c.height>=48),location,'visible controls fit and keep 48px targets');
    check(actual.brokenImages===0,location,'all offline images decode');
    check(actual.activeAnimations===0,location,'static preview remains static');
    check(errors.length===0,location,'no browser errors');
    check(!requests.some(r=>/^https?:/.test(r.url)),location,'file preview uses no network or CDN');
    if(index)check(focusAfterNavigation===(index===config.pages.length-1?'prevPage':'nextPage'),location,'focus remains on usable page control');
    if((chapter.number===15&&index===2)||(chapter.number===1&&viewport.width===320)||(chapter.number===3&&viewport.width===390)){
     const screenshot=out+'/'+chapter.id+'-p'+(index+1)+'-'+viewport.width+'x'+viewport.height+'.png';
     await page.screenshot({path:path.join(ROOT,screenshot),fullPage:true});report.screenshots.push(screenshot);
    }
    const {cells,...summary}=actual;
    report.pages.push({location,file,htmlSHA256:report.inputSha256[file],...summary,codePoints:cells.length,focusAfterNavigation,errors:[...errors],networkRequests:requests.filter(r=>/^https?:/.test(r.url))});
   }
   for(let index=config.pages.length-2;index>=0;index--){
    await page.locator('#prevPage').click();
    check(await page.locator('#book').getAttribute('data-page')===config.pages[index].pageId,chapter.id+'/'+viewport.width,'backward page sequence');
   }
   if(chapter.number===15&&viewport.width===390){
    await page.locator('#tocBtn').click();
    check(page.url().endsWith('xue-er.html#chapter-15'),chapter.id,'file return targets exact chapter in index');
    await page.locator('#chapter-15 a').click();
    check(page.url().endsWith('xue-er-15.html'),chapter.id,'file index re-enters matching chapter');
    await page.reload();await page.waitForFunction(()=>!!window.__demo?.chapter);
    check(await page.locator('#book').getAttribute('data-page')===config.pages[0].pageId,chapter.id,'file deep-link reload works');
   }
  }
 }
 await context.close();
}catch(error){report.fatal={message:error.message,stack:error.stack};report.findings.push({where:'probe',message:error.message});}
finally{
 if(browser)await browser.close();
 report.finalSha256=snapshot();report.changedInputs=files.filter(f=>report.inputSha256[f]!==report.finalSha256[f]);
 report.status=report.findings.length?'needs-review':report.changedInputs.length?'passed-observations-inputs-changed':'passed-unfrozen-static-preview-review';
 fs.writeFileSync(path.join(ROOT,out,'evidence.json'),JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify({status:report.status,checks:report.checks,findings:report.findings,changedInputs:report.changedInputs,pages:report.pages.length,screenshots:report.screenshots,evidence:out+'/evidence.json'},null,2));
 if(report.findings.length)process.exitCode=1;
}
