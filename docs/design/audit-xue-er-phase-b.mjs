// Read-only inspection of existing file:// previews. All evidence stays in docs/design.
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { chromium } from '@playwright/test';

const root = '/Users/mengxionghan/workspace/lunyu-storybook';
const mode = process.argv[2] || 'baseline';
if (!['baseline', 'geometry', 'wide'].includes(mode)) throw new Error('Use baseline, geometry or wide');
const out = path.join(root, 'docs/design/xue-er-phase-b', mode);
await fs.mkdir(out, { recursive: true });
const source = JSON.parse(await fs.readFile(path.join(root, 'docs/content/xue-er.json'), 'utf8'));
const proposal = mode !== 'baseline' ? JSON.parse(await fs.readFile(path.join(root, 'docs/design/xue-er-scene-config.geometry-candidate.json'), 'utf8')) : null;
const css = mode !== 'baseline' ? await fs.readFile(path.join(root, 'docs/design/xue-er-scene-ground-proposal.css'), 'utf8') : null;
const ids = mode === 'baseline' ? [2, 3, 4, 15] : mode === 'wide' ? [5, 10, 11, 13] : [3, 4, 7, 15];
const sizes = [{width:320,height:568}, {width:390,height:844}, {width:1024,height:768}];
const hash = data => crypto.createHash('sha256').update(data).digest('hex');
const files = Object.fromEntries(await Promise.all(ids.map(async n => {
  const file = `build/xue-er-preview/xue-er-${String(n).padStart(2,'0')}.html`;
  return [file, hash(await fs.readFile(path.join(root,file)))];
})));
const report = { mode, createdAt:new Date().toISOString(), previewHashesBefore:files, entries:[], errors:[], limits:['Silent development previews, not media readiness or listening approval.', 'Geometry mode injects the proposed configuration and CSS into browser memory only; it is not an engineering build.'] };
const browser = await chromium.launch({executablePath:process.env.CHROME_PATH || '/Users/mengxionghan/Library/Caches/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-mac-arm64/chrome-headless-shell', headless:true});
try {
  for (const viewport of sizes) for (const number of ids) {
    if (mode === 'geometry' && [4,7].includes(number) && viewport.width !== 320) continue;
    const context = await browser.newContext({viewport, reducedMotion:'reduce'});
    const page = await context.newPage();
    page.on('pageerror', error => report.errors.push({number, viewport, error:String(error)}));
    if (proposal) await page.addInitScript(proposed => {
      let implementation;
      Object.defineProperty(window,'createChapterPlayer',{
        configurable:true,
        get(){return implementation;},
        set(factory){implementation=(config,api)=>{
          const scene=proposed.chapters.find(c=>c.chapterId===config.id);
          config.scene.props=scene.props;
          config.templates=Object.fromEntries(scene.props.map(p=>[p.templateId,proposed.propTemplates[p.templateId]]));
          return factory(config,api);
        };}
      });
    },proposal);
    await page.goto(`file://${root}/build/xue-er-preview/xue-er-${String(number).padStart(2,'0')}.html`, {waitUntil:'load'});
    await page.evaluate(() => document.fonts.ready);
    if (proposal) {
      await page.addStyleTag({content:css});
    }
    const count = await page.evaluate(()=>window.__demo.chapter.pageCount);
    const rendered = [];
    const indices=mode!=='baseline' ? [number===15?2:0] : Array.from({length:count},(_,i)=>i);
    for (const index of indices) {
      let scrollAfterNavigation = 0;
      if (mode!=='baseline') await page.evaluate(i=>window.__demo.chapter.render(i),index);
      else if (index>0) {
        await page.locator('#nextPage').focus();
        await page.keyboard.press('Enter');
        scrollAfterNavigation = await page.evaluate(()=>scrollY);
      }
      if (proposal) await page.evaluate(proposed=>{
        const scene=proposed.chapters.find(c=>c.chapterId===document.querySelector('#book').dataset.chapter);
        for (const prop of scene.props) {
          const value=proposed.propTemplates[prop.templateId].preserveAspectRatio;
          const svg=document.querySelector(`[data-prop="${prop.id}"] svg`);
          if (svg && value) svg.setAttribute('preserveAspectRatio',value);
        }
      },proposal);
      await page.evaluate(()=>scrollTo(0,0));
      await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
      const entry = await page.evaluate(() => {
        const rect = element => {const r=element.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,bottom:r.bottom,right:r.right};};
        const baseText = element => {const clone=element.cloneNode(true);clone.querySelectorAll('rt').forEach(rt=>rt.remove());return clone.textContent;};
        const cast = document.querySelector('#cast');
        const cards = [...document.querySelectorAll('#cards .card')].map(card=>({groupId:card.dataset.group,text:baseText(card.querySelector('.txt')),rect:rect(card),fontSize:getComputedStyle(card.querySelector('.txt')).fontSize,pinyinSize:getComputedStyle(card.querySelector('rt')).fontSize,characters:[...card.querySelectorAll('.k')].map(k=>({text:baseText(k),pinyin:k.querySelector('rt')?.textContent || '',segmentId:k.dataset.segment,sourceIndex:Number(k.dataset.sourceIndex),...rect(k)}))}));
        const props = [...cast.querySelectorAll('[data-prop]')].map(prop=>({id:prop.dataset.prop,tag:prop.tagName,ariaHidden:prop.getAttribute('aria-hidden'),name:prop.getAttribute('aria-label'),rect:rect(prop),parts:[...prop.querySelectorAll('[data-part]')].map(g=>({id:g.dataset.part,...rect(g)}))}));
        const controls = [...document.querySelectorAll('header .ctl,.page-controls button')].map(el=>({id:el.id,disabled:!!el.disabled,name:el.getAttribute('aria-label'),rect:rect(el)}));
        const book=document.querySelector('#book');
        return {pageId:book.dataset.page,chapterId:book.dataset.chapter,profile:cast.dataset.profile,playable:book.dataset.playable==='true',preview:book.dataset.preview==='true',audioElements:document.querySelectorAll('audio').length,pageNumber:document.querySelector('#pageNumber').textContent,focus:document.activeElement?.id,cast:rect(cast),roles:[...cast.querySelectorAll('.char')].map(el=>({id:el.id,disabled:el.disabled,rect:rect(el),shadow:rect(el.querySelector('.shadow'))})),props,cards,controls,overflow:document.documentElement.scrollWidth>innerWidth,viewport:{width:innerWidth,height:innerHeight},activeAnimations:document.getAnimations().filter(a=>a.playState==='running').length};
      });
      entry.scrollAfterNavigation=scrollAfterNavigation;
      rendered.push(entry.cards.map(card=>card.text).join(''));
      const chapter=source.chapters.find(c=>c.id===entry.chapterId);
      const segments=new Map(chapter.segments.map(s=>[s.id,s]));
      entry.exactRenderedCharacters=entry.cards.every(card=>card.characters.every(k=>{const s=segments.get(k.segmentId);const i=k.sourceIndex-s.start;return [...s.text][i]===k.text && s.pinyin[i]===k.pinyin;}));
      const capture = mode!=='baseline' || number!==3;
      if (capture) {
        const name=`${entry.pageId}-${viewport.width}x${viewport.height}.png`;
        await page.screenshot({path:path.join(out,name),fullPage:true,animations:'disabled'});
        entry.screenshot=`docs/design/xue-er-phase-b/${mode}/${name}`;
      }
      report.entries.push(entry);
    }
    report.entries.filter(e=>e.chapterId===`xue-er-${String(number).padStart(2,'0')}` && e.viewport.width===viewport.width).forEach(e=>e.chapterConcatenationEqualsFullText=mode==='baseline'?rendered.join('')===source.chapters.find(c=>c.number===number).fullText:null);
    await context.close();
  }
} finally { await browser.close(); }
report.previewHashesAfter=Object.fromEntries(await Promise.all(Object.keys(files).map(async file=>[file,hash(await fs.readFile(path.join(root,file)))])));
report.previewFilesUnchanged=JSON.stringify(report.previewHashesBefore)===JSON.stringify(report.previewHashesAfter);
await fs.writeFile(path.join(out,'bounds.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({mode,entries:report.entries.length,screenshots:report.entries.filter(e=>e.screenshot).length,errors:report.errors,overflows:report.entries.filter(e=>e.overflow).map(e=>[e.pageId,e.viewport]),exactText:report.entries.every(e=>e.exactRenderedCharacters&&e.chapterConcatenationEqualsFullText!==false),previewFilesUnchanged:report.previewFilesUnchanged,evidence:path.relative(root,path.join(out,'bounds.json'))},null,2));
