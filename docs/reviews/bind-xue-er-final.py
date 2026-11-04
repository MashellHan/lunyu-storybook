#!/usr/bin/env python3
"""Bind existing evidence to the final B snapshot without builds or browser runs."""
import hashlib,json,re
from datetime import datetime,timezone
from pathlib import Path
ROOT=Path('/Users/mengxionghan/workspace/lunyu-storybook')
assert Path.cwd()==ROOT
read=lambda p:(ROOT/p).read_bytes()
load=lambda p:json.loads(read(p))
sha=lambda b:hashlib.sha256(b).hexdigest()
aggregate=lambda d:sha(''.join(p+'\t'+h+'\n' for p,h in sorted(d.items())).encode())
base='docs/reviews/xue-er-phase-b-36ce75f/'
static=load(base+'static-check.json');b2=load(base+'b2-check.json')
freeze_path='tests/artifacts/xue-er-phase-b/frozen-inputs-final-before.json'
result_path='tests/artifacts/xue-er-phase-b/npm-test-b-final-result.json'
freeze=load(freeze_path);result=load(result_path)
EXPECTED='bbe55d83261a0d9ec045f649564fa9e4a272925f7e0037e9c6dd03ff201c5b40'
r={'reviewedAt':datetime.now(timezone.utc).isoformat(),'kind':'final-evidence-binding-no-test-rerun','findings':[],
   'inputManifest':freeze_path,'suiteResult':result_path,'suiteResultSHA256':sha(read(result_path)),
   'reuseStaticEvidence':base+'static-check.json','reuseB2Evidence':base+'b2-check.json',
   'releaseScope':'Chapter-directory increment only; zero full new chapters ready. No deploy performed by reviewer.'}
def check(ok,where,expectation):
    if not ok:r['findings'].append({'where':where,'expectation':expectation})
actual={p:sha(read(p)) for p in freeze['files']}
r['inputs']={'count':len(actual),'sha256':aggregate(actual),'files':actual}
check(len(actual)==48 and actual==freeze['files'] and aggregate(actual)==EXPECTED==freeze['sha256'],freeze_path,'48/48 actual files match new freeze')
check(actual==static['inputFingerprint']['files'],'prior static evidence','exact same 48 input bytes, reuse existing static checks')
check(result['input_fingerprint_before']['files']==actual==result['input_fingerprint_after']['files'],result_path,'final suite before/after and current inputs identical')
check(result['input_fingerprint_before']['sha256']==EXPECTED==result['input_fingerprint_after']['sha256'],result_path,'both final suite aggregate hashes')
log=read(result['log']);text=log.decode()
r['suite']={k:result[k] for k in ['command','started_at','finished_at','exit_code','passed','failed','skipped','did not run','log','log_sha256']}
r['suite']['actualLogSHA256']=sha(log)
r['suite']['rawPassedRows']=len(re.findall(r'^\s*✓\s+\d+\s',text,re.M))
check(result['exit_code']==0 and result['passed']==62 and result['failed']==result['skipped']==result['did not run']==0,result_path,'completed exit0 62 passed, none failed/skipped')
check(sha(log)==result['log_sha256'] and r['suite']['rawPassedRows']==62 and '62 passed' in text and '✘' not in text,result['log'],'raw log independently matches result')
r['products']={p:sha(read(p)) for p in result['product_sha256']}
check(len(r['products'])==6 and r['products']==result['product_sha256'],result_path,'six final production/offline HTML bytes match recorded products')
r['priorArtifactChanges']=[{'path':p,'before':v['sha256'],'after':sha(read(p))} for p,v in static['artifacts'].items() if sha(read(p))!=v['sha256']]
check([c['path'] for c in r['priorArtifactChanges']]==['dist/index-single.html'],'artifacts','only pending offline legacy demo changed since prior static reading')
r['previewHTML']={row['file']:sha(read(row['file'])) for row in static['previews']}
check(all(h==static['artifacts'][p]['sha256'] for p,h in r['previewHTML'].items()),'16 preview HTMLs','existing full-content/scene checks remain valid byte for byte')
r['embeddedAppSHA256']={}
for file in [*r['previewHTML'],'public/learn/xue-er/1/index.html','dist/index-single.html']:
    html=read(file).decode();scripts=re.findall(r'<script>([\s\S]*?)</script>',html)
    app=next(s for s in scripts if re.search(r'^const AUD = ',s,re.M)).removeprefix('\n')
    for key,value in [('AUD','AUDIO'),('TIM','TIMINGS'),('CHAPTER','CHAPTER')]:app=re.sub(r'^const '+key+r' = .*;$','const '+key+' = __'+value+'__;',app,flags=re.M)
    r['embeddedAppSHA256'][file]=sha(app.encode())
    check(app.encode()==read('src/app.js'),file,'embedded app including holdAnimation is final frozen source')
check(all(sha(read(c['file']))==c['htmlSHA256']==c['htmlSHA256After'] for c in b2['cases']) and not b2['findings'],'B2 evidence','both original reproduction-point HTMLs exactly unchanged')
r['screenshots']=[]
for shot in load(base+'screenshots.json'):
    row={'source':shot['source'],'snapshot':shot['snapshot'],'finalSHA256':sha(read(shot['source'])),'reviewedSHA256':sha(read(shot['snapshot']))}
    check(row['finalSHA256']==row['reviewedSHA256']==shot['sha256'],shot['source'],'final suite image exactly equals already opened review image')
    r['screenshots'].append(row)
protected=load('tests/artifacts/xue-er-phase-b/protected-media-lock.json')
protected_actual={p:sha(read(p)) for p in protected['files']}
r['protected']={'count':len(protected_actual),'assets':sum(p.startswith('assets/') for p in protected_actual),'allMatch':protected_actual==protected['files'],'files':protected_actual}
check(r['protected']['allMatch'] and len(protected_actual)==50,'protected-media-lock.json','49 protected asset files plus lock unchanged')
r['productionHTMLFiles']={folder:sorted(str(p.relative_to(ROOT/folder)) for p in (ROOT/folder).rglob('*.html')) for folder in ['public','dist']}
check(r['productionHTMLFiles']==static['productionHTMLFiles'],'production directory','same isolated public/dist inventory')
r['readiness']={}
for mode in ['online','offline','preview']:
    d=load('build/xue-er-readiness-'+mode+'.json')
    r['readiness'][mode]={'count':len(d['chapters']),'ready':sum(c['ready'] for c in d['chapters']),'contentSHA256':d['contentSHA256'],'sceneSHA256':d['sceneSHA256']}
    check(len(d['chapters'])==16 and all(c['ready'] is False for c in d['chapters']),'readiness '+mode,'zero complete new chapters ready')
check({p:sha(read(p)) for p in actual}==actual,'final read','48 inputs stable throughout binding')
r['status']='passed-directory-increment-review' if not r['findings'] else 'needs-review'
r['engineeringAccepted']=not r['findings']
r['fullNewChaptersAccepted']=False
r['deployedByReviewer']=False
r['limitations']=['No new browser matrix, timing repro, test suite, build, SDK, synthesis or deploy executed by reviewer.','True new media and human listening remain pending; static previews are not finished chapters.','Physical-device, real service and billing checks not performed.']
(ROOT/'docs/reviews/xue-er-phase-b-final.json').write_text(json.dumps(r,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'status':r['status'],'inputSHA256':r['inputs']['sha256'],'inputs':len(actual),'products':len(r['products']),'unchangedPreviews':len(r['previewHTML']),'unchangedScreenshots':len(r['screenshots']),'protectedFiles':len(protected_actual),'suite':{'exit':result['exit_code'],'passed':result['passed'],'failed':result['failed']},'findings':r['findings']},ensure_ascii=False))
raise SystemExit(1 if r['findings'] else 0)
