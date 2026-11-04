#!/usr/bin/env python3
"""Independent offline checks of the pinned batch tool; never import the Azure SDK."""
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
from contextlib import contextmanager
from unittest import mock
import builtins
import copy
import hashlib
import importlib.util
import json
import subprocess
import sys
import tempfile
import threading
from datetime import datetime, timezone

ROOT=Path('/Users/mengxionghan/workspace/lunyu-storybook')
assert Path.cwd()==ROOT
OUT=ROOT/'docs/reviews/tts-batch-tool.json'
EXPECTED={
 'scripts/tts/batch.py':'5cc282ec213c832b0f252f16a7b7820cc0dd002e53094d888ced806cda08525e',
 'scripts/tts/test_batch.py':'67f889d11d267f5cdf239711fb602f2c6c5405847091b1496f07aedb5b4770ab',
}
sha=lambda data:hashlib.sha256(data).hexdigest()
for f,digest in EXPECTED.items():
 assert sha((ROOT/f).read_bytes())==digest, 'Pinned tool snapshot changed'
original_import=builtins.__import__
sdk_imports=[]
def guarded_import(name,*args,**kwargs):
 if name=='azure' or name.startswith('azure.'):
  sdk_imports.append(name)
  raise AssertionError('Azure SDK import forbidden in this review')
 return original_import(name,*args,**kwargs)
builtins.__import__=guarded_import
spec=importlib.util.spec_from_file_location('reviewed_batch',ROOT/'scripts/tts/batch.py')
batch=importlib.util.module_from_spec(spec)
spec.loader.exec_module(batch)
checks=[]
def check(ok,name,**evidence):
 checks.append({'check':name,'passed':bool(ok),**evidence})
 if not ok: raise AssertionError(name)
def reject(fn):
 try: fn()
 except batch.BatchError as error: return str(error)
 return None
asset_names=subprocess.check_output(['git','ls-files','-z','assets'],cwd=ROOT).decode().split('\0')
asset_names=[p for p in asset_names if p]
protected=asset_names+list(EXPECTED)+['package-lock.json','scripts/tts/config.py','scripts/tts/gen.py','scripts/tts/process.py',
 'docs/content/xue-er.json','docs/tts/xue-er-generation-request.json','docs/tts/xue-er-generation-request-b.json',
 'docs/tts/xue-er-batch-interface.md','docs/tts/batch-tests.log','docs/tts/batch-tests-result.json',
 'docs/tts/batch-tool-verification.json','docs/tts/batch-dry-run.json']
inventory=lambda:{f:sha((ROOT/f).read_bytes()) for f in protected}
before=inventory()
media_dirs=['assets/source/tts-raw/xue-er/batch-a','assets/source/tts-raw/xue-er/batch-b',
            'assets/audio/xue-er/batch-a','assets/audio/xue-er/batch-b']
media_before={p:(ROOT/p).exists() for p in media_dirs}
report={'reviewer':'lunyu-review','reviewedAt':datetime.now(timezone.utc).isoformat(),
 'toolSHA256':EXPECTED,'checks':checks,'realAPICalls':0,'sdkImports':sdk_imports,'scope':'Temporary fixture roots under docs/reviews only; pinned tool code imported with bytecode disabled; renderer stubs only.'}
@contextmanager
def fixture(parent):
 with tempfile.TemporaryDirectory(prefix='case-',dir=parent) as folder:
  root=Path(folder)
  for relative in ('docs/content/xue-er.json','scripts/tts/config.py',*(x['request'] for x in batch.BATCHES.values())):
   target=root/relative;target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes((ROOT/relative).read_bytes())
  yield root,batch.BatchTool(root)

try:
 lead_result=json.loads((ROOT/'docs/tts/batch-tests-result.json').read_bytes())
 log=(ROOT/'docs/tts/batch-tests.log').read_text()
 check(lead_result['exitCode']==0 and lead_result['sourceSHA256']==EXPECTED
       and lead_result['logSHA256']==sha(log.encode()) and log.count(' ... ok')==17
       and 'Ran 17 tests' in log and log.rstrip().endswith('OK'),'lead-log-source-binding',tests=17)
 production=batch.BatchTool(ROOT)
 dry=production.validate()
 empty=production.index('batch-a',write=False)
 check(dry['approvedMaximumRequests']==235 and dry['batches']['batch-a']['recordedResults']['unstarted']==30
       and dry['batches']['batch-b']['recordedResults']['unstarted']==205,'production-read-only-state-unstarted')
 check(not empty['publicationReady'] and empty['segments']=={} and empty['titles']=={}
       and len([i for i in empty['missing'] if '-title-' in i])==15 and not empty['pendingListening'],
       'empty-index-is-not-playable-and-lists-all-new-titles')
 with tempfile.TemporaryDirectory(prefix='tts-batch-independent-',dir=ROOT/'docs/reviews') as parent:
  tone=Path(parent)/'fixture-tone.mp3'
  subprocess.run(['ffmpeg','-nostdin','-v','error','-n','-f','lavfi','-i','sine=frequency=440:duration=1.4',
                  '-ar','24000','-ac','1','-b:a','96k',str(tone)],check=True,capture_output=True)
  audio=tone.read_bytes()
  def rendered(entry):
   chars=list(entry['plainText'])
   for alias in entry['aliasesBySourcePosition']: chars[alias['index']]=alias['alias']
   text=''.join(c for c in chars if batch.han(c))
   return audio,[[0.1,0.8,text]],[{'textOffset':37,'wordLength':len(text)}]

  with fixture(parent) as (root,tool):
   entry=tool.entries['xue-er-01-s01-elephant'];barrier=threading.Barrier(2);lock=threading.Lock();calls=[]
   original_write=batch.write_new
   def raced_write(file,data):
    if file.name.endswith('.attempt.json'): barrier.wait(timeout=5)
    return original_write(file,data)
   def renderer(e):
    attempt=json.loads(tool.sidecar(e,'.attempt.json').read_text())
    with lock:calls.append({'id':e['id'],'reserved':attempt['status']=='reserved','callLimit':attempt['maximumApplicationCalls']})
    return rendered(e)
   def worker():
    try:return {'result':tool.execute('batch-a',[entry],renderer)}
    except Exception as error:return {'error':type(error).__name__}
   with mock.patch.object(batch,'write_new',side_effect=raced_write),ThreadPoolExecutor(max_workers=2) as pool:
    futures=[pool.submit(worker) for _ in range(2)]; outcomes=[f.result(timeout=10) for f in futures]
   check(len(calls)==1 and calls[0]['reserved'] and calls[0]['callLimit']==1
         and sum('result' in x for x in outcomes)==1 and any(x.get('error')=='FileExistsError' for x in outcomes),
         'concurrent-same-entry-reservation-allows-one-stub-call',outcomes=outcomes,stubCalls=len(calls))
   raw=tool.result(entry);expected=rendered(entry)
   check(raw['wb']==expected[1] and raw['wordBoundaryDetails']==expected[2],
         'raw-word-boundaries-and-sdk-offsets-retained',wordBoundaryDetails=raw['wordBoundaryDetails'])
   skipped=tool.execute('batch-a',[entry],lambda e:(_ for _ in ()).throw(AssertionError('Must not retry')))
   check(skipped['paidCallsThisRun']==0 and skipped['verifiedSkipped']==[entry['id']],'successful-concurrent-result-is-reused')

  with fixture(parent) as (root,tool):
   good=tool.entries['xue-er-01-s01-elephant'];bad=tool.entries['xue-er-01-s01-bunny'];calls=[]
   marker=root/'outside.json';marker.write_text('retained-sidecar-sentinel')
   sidecar=tool.sidecar(bad,'.result.json');sidecar.parent.mkdir(parents=True);sidecar.symlink_to(marker)
   reason=reject(lambda:tool.execute('batch-a',[good,bad],lambda e:calls.append(e)))
   check(reason=='media-symlink-rejected' and not calls and not tool.sidecar(good,'.attempt.json').exists()
         and marker.read_text()=='retained-sidecar-sentinel',
         'whole-selection-sidecar-symlink-rejected-before-reservation',reason=reason)

  with fixture(parent) as (root,tool):
   entry=tool.entries['xue-er-01-s01-elephant']
   tool.execute('batch-a',[entry],lambda e:(audio,[[0.1,0.2,'子']],[{'textOffset':37,'wordLength':1}]))
   before_count=len(list(root.rglob('*.attempt.json')))
   reason=reject(lambda:tool.process('batch-a',[entry]))
   check(reason=='incomplete-word-boundaries' and not (root/entry['processedOutput']).exists()
         and not (root/'assets/audio/xue-er/batch-a').exists()
         and len(list(root.rglob('*.attempt.json')))==before_count,
         'missing-character-prevents-final-media-and-no-new-attempt',reason=reason)
   check(tool.result(entry)['wordBoundaryDetails']==[{'textOffset':37,'wordLength':1}],
         'alignment-failure-does-not-rewrite-original-sdk-metadata')

  # Same written character has two readings in this exact approved B segment.
  entry=production.entries['xue-er-10-s03-dog'];text=entry['plainText'];aliases=entry['aliasesBySourcePosition']
  valid=[[0.1,0.2,'求之于'],[0.5,0.2,'抑与之于']]
  times=batch.character_times(text,valid,aliases,1.5,ssml=entry['ssml'],
        details=[{'textOffset':123,'wordLength':3},{'textOffset':201,'wordLength':4}])
  wrong=[[0.1,0.2,'求之于'],[0.5,0.2,'抑于之于']]
  reason=reject(lambda:batch.character_times(text,wrong,aliases,1.5,ssml=entry['ssml']))
  check(sum(x is not None for x in times)==sum(map(batch.han,text)) and reason=='word-boundary-character-mismatch-at-5',
        'real-B-repeated-yu-readings-use-specific-original-positions',aliases=aliases,rejectedWrongPosition=reason)
  # An altered fragment that consumes an unreviewed third character must not be repaired.
  text='说乎？';alias=[{'index':0,'original':'说','alias':'悦'}]
  ssml='<speak xmlns="http://www.w3.org/2001/10/synthesis"><sub alias="悦">说</sub>乎？</speak>'
  fragment_prefix = chr(34) + chr(62)
  for suffix in ("说乎乎", "悦乎", "说，乎"):
   fragment = fragment_prefix + suffix
   reason=reject(lambda f=fragment:batch.character_times(text,[[.1,.2,"悦"],[.3,.2,f]],alias,1,ssml=ssml))
   check(reason=="unresolved-ssml-boundary-fragment","unknown-HD-fragment-not-discarded",
         fragment=fragment,reason=reason)
  slash_fragment = chr(92) + fragment_prefix + "说乎乎"
  slash_reason=reject(lambda:batch.character_times(text,[[.1,.2,"悦"],[.3,.2,slash_fragment]],alias,1,ssml=ssml))
  check(slash_reason=="unexpected-spoken-character","literal-backslash-fragment-rejected",
        fragment=slash_fragment,reason=slash_reason)

  with fixture(parent) as (root,tool):
   calls=[]
   def renderer(e): calls.append(e['id']);return rendered(e)
   all_a=tool.select('batch-a',all_entries=True);all_b=tool.select('batch-b',all_entries=True)
   reason=reject(lambda:tool.execute('batch-b',[all_b[0]],renderer))
   check(reason=='batch-a-must-succeed-before-b' and not calls,'B-order-gate-prevents-stub-call')
   tool.execute('batch-a',all_a,renderer)
   b_prefixes={'xue-er-04-s01','xue-er-10-s04'}
   selected_b=[e for e in all_b if e['segment'] in b_prefixes]
   tool.execute('batch-b',selected_b,renderer)
   calls_before_processing=len(calls)
   tool.process('batch-a',[e for e in all_a if e['segment']=='xue-er-01-s01'])
   tool.process('batch-b',selected_b)
   candidate=tool.index('batch-b',write=False);refs=candidate['segments']
   check(len(calls)==calls_before_processing==38 and len(list(root.rglob('*.attempt.json')))==38,
         'processing-and-unison-never-add-stub-calls',stubCalls=len(calls),realAPICalls=0)
   expected_roles={'elephant','bunny','cat','dog','children'}
   reuse=[('xue-er-05-s01','xue-er-01-s01','batch-a'),
          ('xue-er-09-s01','xue-er-04-s01','batch-b'),
          ('xue-er-15-s01','xue-er-10-s04','batch-b'),
          ('xue-er-15-s06','xue-er-10-s04','batch-b')]
   for target,source,source_batch in reuse:
    check(refs[target]==refs[source] and set(refs[target])==expected_roles
          and all(r['batch']==source_batch for r in refs[target].values()),
          'approved-cross-batch-or-B-internal-reuse-keeps-target-segment',target=target,source=source,sourceBatch=source_batch)
   actual_refs=[r for roles in refs.values() for r in roles.values()]
   check(candidate['publicationReady'] is False and not candidate['titles']
         and len([i for i in candidate['missing'] if '-title-' in i])==15
         and len(candidate['pendingListening'])==15
         and all('listening' not in r for r in actual_refs)
         and all(p['status']=='not-listened' for p in candidate['pendingListening']),
         'partial-candidate-does-not-fabricate-titles-readiness-or-listening')
   mixed=json.loads((root/refs['xue-er-04-s01']['children']['timingFile']).read_text())
   check([x['id'] for x in mixed['sources']]==['xue-er-04-s01-'+role for role in batch.CHILDREN]
         and mixed['processing']['childrenAlignment']['delaysMs']==[0,70,140],
         'unison-retains-three-source-tracks-and-approved-delays')
 report['status']='passed-independent-offline-review'
except Exception as error:
 report['status']='failed-independent-offline-review'
 report['error']={'type':type(error).__name__,'message':str(error)}
finally:
 report['protectedFilesBefore']=before;report['protectedFilesAfter']=inventory()
 report['protectedBytesUnchanged']=report['protectedFilesBefore']==report['protectedFilesAfter']
 report['trackedAssetCount']=len(asset_names)
 report['newProductionMediaDirectoriesBefore']=media_before
 report['newProductionMediaDirectoriesAfter']={p:(ROOT/p).exists() for p in media_dirs}
 report['sdkImports']=sdk_imports
 report['leadEvidence']={'log':'docs/tts/batch-tests.log','result':'docs/tts/batch-tests-result.json','tests':17,'exitCode':0}
 report['limitations']=['Mock renderers and temporary tones only; no actual SDK/service interaction.',
                       'Actual provider behavior, pronunciations, HD realization, word boundaries from newly synthesized speech and human listening await real media.',
                       'USD10 is the approved shared budget; this review validates exact request-count controls, not an actual provider invoice.']
 if not report['protectedBytesUnchanged'] or sdk_imports or report['newProductionMediaDirectoriesBefore']!=report['newProductionMediaDirectoriesAfter']:
  report['status']='failed-independent-offline-review'
 OUT.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
 print(json.dumps({k:report[k] for k in ('status','realAPICalls','sdkImports','protectedBytesUnchanged','trackedAssetCount')},
                  ensure_ascii=False,indent=2))
 print(json.dumps({'checks':len(checks),'failed':[x for x in checks if not x['passed']],'error':report.get('error')},ensure_ascii=False,indent=2))
 if report['status'].startswith('failed'):sys.exit(1)
