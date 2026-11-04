import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {chromium} from '@playwright/test';
const ROOT='/Users/mengxionghan/workspace/lunyu-storybook';
if(process.cwd()!==ROOT)throw new Error('Use the explicit target workdir');
const OUT='docs/reviews/xue-er-phase-b-36ce75f';
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const bytes=f=>fs.readFileSync(path.join(ROOT,f));
const embedded=(html,key)=>JSON.parse(html.match(new RegExp('^const '+key+' = (.*);$','m'))[1]);
const report={reviewedAt:new Date().toISOString(),kind:'two-original-B2-reproduction-points-only',
  scope:'Current existing file previews after Engineer began timing fixes; exact HTML hashes below, not a new frozen-release verdict.',
  cases:[],findings:[],releaseAccepted:false};
const check=(ok,where,expectation)=>{if(!ok)report.findings.push({where,expectation});};
const browser=await chromium.launch({headless:true,executablePath:'/Users/mengxionghan/Library/Caches/ms-playwright/chromium-1248/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing'});
try{
  for(const spec of [{chapter:1,page:1,width:320,height:844},{chapter:15,page:3,width:768,height:1024}]){
    const file='build/xue-er-preview/'+(spec.chapter===1?'index-single.html':'xue-er-'+String(spec.chapter).padStart(2,'0')+'.html');
    const htmlBytes=bytes(file),html=htmlBytes.toString(),data=embedded(html,'CHAPTER');
    const context=await browser.newContext({viewport:{width:spec.width,height:spec.height},reducedMotion:'reduce'});
    const page=await context.newPage();page.setDefaultTimeout(5000);
    const errors=[];page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
    await page.goto(pathToFileURL(path.join(ROOT,file)).href);
    await page.waitForFunction(()=>window.__demo?.chapter);
    for(let i=1;i<spec.page;i++)await page.locator('#nextPage').click();
    await page.evaluate(async()=>{scrollTo(0,0);await document.fonts.ready;await Promise.all([...document.images].map(i=>i.decode()));await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));});
    const measured=await page.evaluate(()=>({
      chapter:document.querySelector('#book').dataset.chapter,page:document.querySelector('#book').dataset.page,
      preview:document.querySelector('#book').dataset.preview,playable:document.querySelector('#book').dataset.playable,
      disabled:document.querySelector('#readBtn').disabled,scrollWidth:document.documentElement.scrollWidth,
      groups:[...document.querySelectorAll('#cards .card')].map(card=>({id:card.dataset.group,glyphs:[...card.querySelectorAll('.k')].map(k=>{
        const r=k.getBoundingClientRect();const ruby=k.querySelector('ruby');
        return{char:ruby?.firstChild.textContent||k.textContent,pinyin:k.querySelector('rt')?.textContent||'',segmentId:k.dataset.segment,sourceIndex:Number(k.dataset.sourceIndex),left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height};
      })}))
    }));
    const expected=data.pages[spec.page-1];
    check(measured.page===expected.pageId,file,'intended original page');
    check(measured.preview==='true'&&measured.playable==='false'&&measured.disabled,file,'static preview guard');
    check(measured.scrollWidth<=spec.width,file,'no horizontal overflow');
    for(const [index,group]of measured.groups.entries()){
      const wanted=expected.groups[index];
      check(group.glyphs.map(g=>g.char).join('')===wanted.text&&JSON.stringify(group.glyphs.map(g=>g.pinyin))===JSON.stringify(wanted.py),group.id,'glyphs/pinyin preserved');
      const lines=new Map();
      for(const glyph of group.glyphs){const key=Math.round(glyph.bottom);if(!lines.has(key))lines.set(key,[]);lines.get(key).push(glyph);}
      group.lines=[...lines.entries()].map(([bottom,glyphs])=>({bottom,first:glyphs[0].char,last:glyphs.at(-1).char,text:glyphs.map(g=>g.char).join(''),sourceIndices:glyphs.map(g=>g.sourceIndex)}));
      check(group.lines.every(line=>!/[，。！？；：、”’》〉」』）】]/u.test(line.first)),group.id,'no closing punctuation at line start');
      check(group.lines.every(line=>!/[“‘《〈「『（【]/u.test(line.last)),group.id,'no opening punctuation stranded at line end');
    }
    const screenshot=OUT+'/b2-xue-er-'+String(spec.chapter).padStart(2,'0')+'-p'+spec.page+'-'+spec.width+'x'+spec.height+'.png';
    await page.screenshot({path:path.join(ROOT,screenshot),fullPage:true,timeout:10000});
    const after=hash(bytes(file));
    check(after===hash(htmlBytes),file,'HTML stable across browser observation');
    check(errors.length===0,file,'no browser errors');
    report.cases.push({...spec,file,htmlSHA256:hash(htmlBytes),htmlSHA256After:after,screenshot,screenshotSHA256:hash(bytes(screenshot)),measured,errors});
    await context.close();
  }
} catch(error){report.findings.push({where:'probe',expectation:String(error)});}
finally{await browser.close();}
report.status=report.findings.length?'needs-review':'B2-passed-on-recorded-artifacts';
fs.writeFileSync(path.join(ROOT,OUT,'b2-check.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({status:report.status,cases:report.cases.map(c=>({chapter:c.chapter,page:c.page,htmlSHA256:c.htmlSHA256,lines:c.measured.groups.map(g=>g.lines.map(l=>l.text))})),findings:report.findings}));
process.exitCode=report.findings.length?1:0;
