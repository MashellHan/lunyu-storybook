#!/usr/bin/env python3
"""Read only real A/B ledgers and media. Evidence/cache writes stay in docs/reviews."""
import argparse,concurrent.futures,hashlib,importlib.util,json,math,re,subprocess
from datetime import datetime,timezone
from pathlib import Path
ROOT=Path('/Users/mengxionghan/workspace/lunyu-storybook')
SPEC={'batch-a':('docs/tts/xue-er-generation-request.json','0c0a0fc0ee93868a91fcb76765a906c2bbe79d7a4a3e88c8cf60e462132be6da',30,'472d68446e3209689037534c3e9dedab710503b1036719d07a0e22752f672296'),'batch-b':('docs/tts/xue-er-generation-request-b.json','26b79e3aa570877d917ce741079d0b67140ce1b33a29db7557b83d133396ead4',205,'ff9384ff4d805bdab7567bda65d12c0101ec4007d10b17ee00a55b06ee6ea54f')}
CONTENT='85168c306fd68f1006f96ce189801b387252fcfef9fcdc982c0388705cb13b73'
sha=lambda b:hashlib.sha256(b).hexdigest()
read=lambda p:(ROOT/p).read_bytes()
load=lambda p:json.loads(read(p))
canonical=lambda v:json.dumps(v,ensure_ascii=False,sort_keys=True,separators=(',',':')).encode()
module_spec=importlib.util.spec_from_file_location('independent_boundaries',ROOT/'docs/reviews/check-xue-er-sdk-boundaries.py')
boundary=importlib.util.module_from_spec(module_spec);module_spec.loader.exec_module(boundary)
CACHE_PATH=ROOT/'docs/reviews/xue-er-real-media-codec-cache.json'
def codec(file,hash_value,cache,full_decode=True):
    if hash_value in cache and (not full_decode or cache[hash_value].get("decodeExit") == 0):return file,cache[hash_value],True
    probe=subprocess.run(['ffprobe','-v','error','-show_entries','stream=codec_name,sample_rate,channels,bit_rate,duration:format=duration,bit_rate,size','-of','json',str(ROOT/file)],cwd=str(ROOT),capture_output=True,text=True,timeout=30)
    decode=subprocess.run(['ffmpeg','-nostdin','-v','error','-threads','1','-i',str(ROOT/file),'-f','null','-'],cwd=str(ROOT),capture_output=True,text=True,timeout=30) if full_decode else None
    result={'sha256':hash_value,'firstCheckedFile':file,'checkedAt':datetime.now(timezone.utc).isoformat(),'probeExit':probe.returncode,'decodeExit':decode.returncode if decode else None,'probe':json.loads(probe.stdout) if probe.returncode==0 else None,'errors':(probe.stderr+(decode.stderr if decode else '')).strip(),'mode':'full-decode' if decode else 'format-duration-probe-only'}
    return file,result,False

def main():
    parser=argparse.ArgumentParser();parser.add_argument('--batch',choices=SPEC,required=True);parser.add_argument('--timing-ref-only',action='store_true');args=parser.parse_args()
    assert Path.cwd()==ROOT,'Use explicit target workdir'
    r={'reviewedAt':datetime.now(timezone.utc).isoformat(),'batch':args.batch,'kind':'real-media-read-only-review','raw':[],'processed':[],'findings':[],'pending':[],'requests':{},'reviewerSDKCalls':0,'listeningPerformed':False,'scope':'New selected-batch media only; inspect existing ledgers and bytes. Completed records only. No synthesis, SDK import, production changes, build or UI tests.'}
    def check(ok,where,expectation):
        if not ok:r['findings'].append({'where':where,'expectation':expectation})
    r['timingRefOnly']=args.timing_ref_only
    prior_boundaries={c['id']:c for c in load('docs/reviews/xue-er-real-'+args.batch+'-boundaries.json')['completed']} if args.timing_ref_only else {}
    prior_raw={c['id']:c for c in load('docs/reviews/xue-er-real-'+args.batch+'-raw-complete.json')['raw']} if args.timing_ref_only else {}
    requests={};entries={};batches={};all_segments={};reuse={};all_titles={}
    for batch,(file,expected,count,collection) in SPEC.items():
        raw=read(file);d=json.loads(raw);requests[batch]=d
        check(sha(raw)==expected and len(d['entries'])==count and sha(canonical(d['entries']))==collection==d['entrySetSHA256'],file,'immutable approved request and collection hash')
        r['requests'][batch]={'file':file,'sha256':sha(raw),'entrySetSHA256':collection,'entries':count}
        for entry in d['entries']:
            entries[entry['id']]=entry;batches[entry['id']]=batch
            if entry['segment']:all_segments.setdefault(entry['segment'],{})[entry['role']]=entry
            else:all_titles['xue-er-'+str(entry['chapter']).zfill(2)]=entry
        for item in d['reuse']:reuse[item['segment']]=item['from']
    selected=requests[args.batch]['entries'];raw_root=Path('assets/source/tts-raw/xue-er')/args.batch;output_root=Path('assets/audio/xue-er')/args.batch
    selected_segments=sorted({e['segment'] for e in selected if e['segment']})
    expected_names={e['id'] for e in selected};known_output_names=expected_names|{s+'-children' for s in selected_segments}
    for suffix in ['.attempt.json','.result.json','.mp3']:
        extra=[p.name for p in (ROOT/raw_root).glob('*'+suffix) if p.name[:-len(suffix)] not in expected_names]
        check(not extra,str(raw_root),'no unapproved '+suffix+' records: '+str(extra))
    for suffix in ['.mp3','.timing.json']:
        extra=[p.name for p in (ROOT/output_root).glob('*'+suffix) if p.name[:-len(suffix)] not in known_output_names]
        check(not extra,str(output_root),'no unapproved processed paths: '+str(extra))
    completed={};attempt_ids={};generation_order={};snapshots={};jobs={};processed_specs={}
    for entry in entries.values():
        batch=batches[entry['id']];raw_file=entry['rawOutput'];attempt_file=str(Path(raw_file).with_suffix('.attempt.json'));result_file=str(Path(raw_file).with_suffix('.result.json'))
        attempt=None;result=None
        try:
            if (ROOT/attempt_file).exists():attempt=load(attempt_file)
            if (ROOT/result_file).exists():result=load(result_file)
        except json.JSONDecodeError:
            if batch==args.batch:r['pending'].append({'id':entry['id'],'stage':'ledger-being-written'})
            continue
        if attempt:
            ident=attempt.get('attemptId');check(ident and ident not in attempt_ids,attempt_file,'unique persisted attempt ID across A/B');attempt_ids[ident]=entry['id']
        if not result:
            if batch==args.batch:r['pending'].append({'id':entry['id'],'stage':'in-progress' if attempt else 'not-yet-attempted'})
            continue
        if result.get('status')!='succeeded':
            if batch==args.batch:r['findings'].append({'where':result_file,'expectation':'completed result succeeded','actualStatus':result.get('status')})
            continue
        completed[entry['id']]=result;generation_order.setdefault(batch,[]).append((result['startedAt'],result['finishedAt']))
        if batch!=args.batch:continue
        before=len(r['findings'])
        check(attempt is not None,attempt_file,'successful raw result has persisted attempt')
        expected={'id':entry['id'],'batch':batch,'contentSHA256':CONTENT,'sourceEntrySetSHA256':SPEC[batch][3],'ssmlSHA256':entry['ssmlSHA256'],'maximumApplicationCalls':1,'automaticRetries':0}
        for key,value in expected.items():check(attempt and attempt.get(key)==value and result.get(key)==value,result_file,'attempt/result '+key)
        check(attempt and all(attempt.get(k)==result.get(k) for k in ['attemptId','startedAt','budgetCeilingUSD']),result_file,'same single persisted attempt')
        check(attempt and attempt.get('status')=='reserved' and result['finishedAt']>=result['startedAt'],result_file,'valid success chronology')
        check(sha(entry['ssml'].encode())==entry['ssmlSHA256'],result_file,'exact approved SSML')
        files=[attempt_file,result_file,raw_file]
        missing=[f for f in files if not (ROOT/f).is_file()]
        check(not missing,result_file,'completed record files exist: '+str(missing))
        if missing:continue
        hashes={f:sha(read(f)) for f in files};snapshots.update(hashes)
        check(hashes[raw_file]==result['rawSHA256'],raw_file,'original MP3 matches succeeded result SHA')
        jobs[raw_file]=hashes[raw_file]
        row={'id':entry['id'],'voice':entry['voice'],'attemptFile':attempt_file,'resultFile':result_file,'rawFile':raw_file,'hashes':hashes,'attemptId':result['attemptId'],'startedAt':result['startedAt'],'finishedAt':result['finishedAt'],'ledgerPassed':len(r['findings'])==before}
        r['raw'].append(row)
    if generation_order.get('batch-b'):
        check(len(generation_order.get('batch-a',[]))==30,'A-before-B','all A raw results succeeded before B')
        a_end=max(end for _,end in generation_order['batch-a']);b_start=min(start for start,_ in generation_order['batch-b'])
        check(a_end<=b_start,'A-before-B','B starts after final A success');r['generationOrder']={'ACompletedAt':a_end,'BFirstStartedAt':b_start,'ordered':a_end<=b_start}
    for entry in selected:processed_specs[entry['id']]={'text':entry['plainText'],'sourceEntries':[entry]}
    for segment in selected_segments:processed_specs[segment+'-children']={'text':all_segments[segment]['bunny']['plainText'],'sourceEntries':[all_segments[segment][role] for role in ['bunny','cat','dog']]}
    for name,spec in processed_specs.items():
        audio=str(output_root/(name+'.mp3'));timing_file=str(output_root/(name+'.timing.json'))
        if not (ROOT/audio).exists() or not (ROOT/timing_file).exists():
            r['pending'].append({'id':name,'stage':'processing-not-complete','mp3Exists':(ROOT/audio).exists(),'timingExists':(ROOT/timing_file).exists()});continue
        try:timing_bytes=read(timing_file);timing=json.loads(timing_bytes)
        except json.JSONDecodeError:r['pending'].append({'id':name,'stage':'timing-being-written'});continue
        audio_hash=sha(read(audio));timing_hash=sha(timing_bytes);snapshots[audio]=audio_hash;snapshots[timing_file]=timing_hash;jobs[audio]=audio_hash
        row={'id':name,'audioFile':audio,'audioSHA256':audio_hash,'timingFile':timing_file,'timingSHA256':timing_hash,'sourceIds':[e['id'] for e in spec['sourceEntries']],'timing':timing}
        r['processed'].append(row)
    cache=json.loads(CACHE_PATH.read_text()) if CACHE_PATH.exists() else {}
    codecs={};new_decodes=0;new_probes=0
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
        futures=[pool.submit(codec,file,h,cache,not args.timing_ref_only) for file,h in jobs.items()]
        for future in concurrent.futures.as_completed(futures):
            file,result,cached=future.result();codecs[file]=result;cache[jobs[file]]=result;new_decodes+=not cached and result["decodeExit"] is not None;new_probes+=not cached
    CACHE_PATH.write_text(json.dumps(cache,ensure_ascii=False,indent=2)+'\n')
    r['codecs']={'files':len(codecs),'newDecodes':new_decodes,'newFormatDurationProbes':new_probes,'cachedByExactSHA':len(codecs)-new_probes,'cache':'docs/reviews/xue-er-real-media-codec-cache.json'}
    proofs={}
    def actual_codec(file,rate):
        d=codecs[file]
        if args.timing_ref_only and file.startswith('assets/audio/xue-er/'):
            check(d['probeExit']==0 and not d['errors'],file,'new processed MP3 format and duration readable; full decoding outside final comparison scope')
        else:check(d['probeExit']==d['decodeExit']==0 and not d['errors'],file,'full raw decode evidence retained for exact SHA')
        if not d['probe']:return None
        streams=d['probe']['streams'];check(len(streams)==1,file,'one audio stream');s=streams[0]
        check(s['codec_name']=='mp3' and int(s['sample_rate'])==24000 and s['channels']==1 and int(s['bit_rate'])==rate,file,'MP3 24kHz mono expected bitrate '+str(rate))
        return float(d['probe']['format']['duration'])
    for row in r['raw']:
        entry=entries[row['id']];result=completed[row['id']];duration=actual_codec(row['rawFile'],96000);row['actualDuration']=duration
        try:
            if args.timing_ref_only:
                proof=prior_boundaries[row['id']];old=prior_raw[row['id']]
                check(proof['resultSHA256']==row['hashes'][row['resultFile']] and old['hashes']==row['hashes'] and old['alignmentPassed'],row['resultFile'],'reuse completed raw/source-event evidence without rerunning boundary scan')
            else:proof=boundary.inspect(entry,result,duration)
            proofs[row['id']]=proof
            row.update({'alignmentPassed':True,'mappedSourceCodePoints':proof['sourceCodePoints'],'mappedHan':proof['sourceHan'],'unknownSDKPositions':proof['unknownSDKPositions'],'fragmentCorrections':proof['fragmentCorrections'],'wordGroups':proof['wordGroups']})
        except ValueError as error:row['alignmentPassed']=False;r['findings'].append({'where':row['resultFile'],'expectation':'complete bounded original-text alignment','reason':str(error)})
    for row in r['processed']:
        before=len(r['findings']);timing=row['timing'];spec=processed_specs[row['id']];sources=spec['sourceEntries'];duration=actual_codec(row['audioFile'],64000)
        row['actualDuration']=duration
        row['formatVerificationMode']=codecs[row['audioFile']].get('mode','prior-full-decode')
        check(timing.get('text')==spec['text'] and len(timing.get('t',[]))==len(spec['text']),row['timingFile'],'exact original codepoints including punctuation')
        check(timing.get('audioSHA256')==row['audioSHA256'] and timing.get('contentSHA256')==CONTENT and timing.get('sourceEntrySetSHA256')==SPEC[args.batch][3],row['timingFile'],'audio and frozen-input provenance')
        expected_sources=[{'id':e['id'],'rawSHA256':completed[e['id']]['rawSHA256'],'ssmlSHA256':e['ssmlSHA256']} for e in sources if e['id'] in completed]
        check(len(expected_sources)==len(sources) and timing.get('sources')==expected_sources,row['timingFile'],'all original source IDs/hashes preserved')
        check(duration is not None and abs(duration-timing.get('dur',-10))<.002,row['timingFile'],'duration matches actual processed MP3')
        proof=proofs.get(sources[0]['id'])
        if proof:
            check(timing.get('t')==proof['expectedTimes'],row['timingFile'],'each source position retains its observed-event anchor; shared zero-duration word onset is not character precision')
            check(timing.get('wordGroups',[])==proof['wordGroups'],row['timingFile'],'optional wordGroups exactly preserves original word event, source positions and unknown internal boundaries')
            check(all(t is None or 0<=t<duration for t in timing['t']),row['timingFile'],'no out-of-range timestamp')
            wanted=proof['fragmentCorrections'];corrections=timing.get('alignmentCorrections',[])
            check(len(wanted)==len(corrections),row['timingFile'],'exact count of justified fragment corrections')
            for want,got in zip(wanted,corrections):
                check(got.get('boundaryIndex')==want['eventIndex'] and got.get('alreadyTimedSourceIndex')==want['alreadyMappedSourceIndex'] and got.get('remainingSourceIndices')==want['sourceIndices'] and got.get('originalBoundaryText')==want['rawEvent'][2] and got.get('usedBoundaryOffsetSeconds')==want['rawEvent'][0] and got.get('usedBoundaryDurationSeconds')==want['rawEvent'][1] and got.get('sdkPosition')==want['sdkPosition'],row['timingFile'],'correction preserves exact event, all remaining indices, offset/duration and original SDK positioning')
        processing=timing.get('processing',{});check(all(processing.get(k)==v for k,v in {'sampleRate':24000,'channels':1,'bitRate':64000,'normalization':'loudnorm=I=-16:TP=-1.5:LRA=11'}.items()),row['timingFile'],'approved processing metadata')
        if len(sources)==3:
            alignment=processing.get('childrenAlignment',{});lengths=[float(codecs[e['rawOutput']]['probe']['format']['duration']) for e in sources];ratios=[1,lengths[1]/lengths[0],lengths[2]/lengths[0]]
            check(alignment.get('roles')==['bunny','cat','dog'] and alignment.get('delaysMs')==[0,70,140] and len(alignment.get('tempo',[]))==3 and all(abs(a-b)<1e-10 for a,b in zip(alignment.get('tempo',[]),ratios)),row['timingFile'],'free chorus references three original tracks and approved delays/actual duration ratios')
        check('listening' not in timing,row['timingFile'],'no fabricated human listening')
        row['technicalChecksPassed']=len(r['findings'])==before
    candidate_file=str(output_root/'media-candidate.json')
    if not (ROOT/candidate_file).exists():r['pending'].append({'id':'media-candidate','stage':'candidate-not-written'})
    else:
        candidate_bytes=read(candidate_file);candidate=json.loads(candidate_bytes);r['candidate']={'file':candidate_file,'sha256':sha(candidate_bytes),'segmentCount':len(candidate['segments']),'titleCount':len(candidate['titles']),'missing':candidate['missing'],'pendingListeningCount':len(candidate['pendingListening'])}
        check(candidate.get('publicationReady') is False and candidate.get('contentSHA256')==CONTENT,candidate_file,'candidate stays nonready, correct content edition')
        for batch in SPEC:check(candidate['batches'][batch]=={'request':SPEC[batch][0],'entrySetSHA256':SPEC[batch][3]},candidate_file,'candidate approved batch provenance '+batch)
        expected_missing=[]
        for ident,entry in entries.items():
            present=entry['role'] in candidate['segments'].get(entry['segment'],{}) if entry['segment'] else 'xue-er-'+str(entry['chapter']).zfill(2) in candidate['titles']
            if not present:expected_missing.append(ident)
        expected_missing.extend(segment+'-children' for segment in all_segments if 'children' not in candidate['segments'].get(segment,{}))
        expected_missing.extend(segment+':'+role for segment in reuse for role in ['elephant','bunny','cat','dog','children'] if role not in candidate['segments'].get(segment,{}))
        check(set(candidate['missing'])==set(expected_missing),candidate_file,'exact missing/present partition of approved native and reused references')
        r['candidate']['missingPartitionMatches']=set(candidate['missing'])==set(expected_missing)
        refs=[];known_missing=set(entries)|{s+'-children' for s in all_segments}|{s+':'+role for s in reuse for role in ['elephant','bunny','cat','dog','children']}
        check(len(candidate['missing'])==len(set(candidate['missing'])) and set(candidate['missing'])<=known_missing,candidate_file,'missing list has no duplicate or unapproved identity')
        for segment,roles in candidate['segments'].items():
            source_id=reuse.get(segment,segment);check(source_id in all_segments,candidate_file,'approved segment/reuse '+segment)
            if source_id not in all_segments:continue
            for role,ref in roles.items():
                check(role in ['elephant','bunny','cat','dog','children'],candidate_file,'approved role '+role)
                if role not in ['elephant','bunny','cat','dog','children']:continue
                entry=all_segments[source_id]['bunny' if role=='children' else role];name=source_id+'-children' if role=='children' else entry['id'];refs.append((segment+':'+role,ref,batches[entry['id']],name))
        for chapter,ref in candidate['titles'].items():
            check(chapter in all_titles,candidate_file,'approved title '+chapter)
            if chapter in all_titles:entry=all_titles[chapter];refs.append((chapter,ref,batches[entry['id']],entry['id']))
        unique={}
        for label,ref,batch,name in refs:
            file='assets/audio/xue-er/'+batch+'/'+name+'.mp3';timing_file=file[:-4]+'.timing.json'
            check(ref.get('file')==file and ref.get('timingFile')==timing_file and ref.get('batch')==batch,candidate_file,'approved exact reference '+label)
            exists=(ROOT/file).is_file() and (ROOT/timing_file).is_file();check(exists,candidate_file,'reference files exist '+label)
            if exists:
                h=sha(read(file));check(ref.get('sha256')==h and load(timing_file).get('audioSHA256')==h,candidate_file,'reference audio/timing SHA '+label);unique[file]=h
            check('listening' not in ref,candidate_file,'no fabricated listening '+label)
        pending={v['file']:v for v in candidate['pendingListening']}
        check(len(pending)==len(candidate['pendingListening']) and set(pending)==set(unique) and all(v.get('status')=='not-listened' and v.get('audioSHA256')==unique[p] for p,v in pending.items()),candidate_file,'every unique actual file is explicitly pending human listening')
        selected_refs={str(output_root/(name+'.mp3')) for name in processed_specs}
        absent=selected_refs-set(unique)
        if absent:r['pending'].append({'id':'candidate-selected-references','stage':'candidate-incomplete-or-not-yet-refreshed','paths':sorted(absent)})
        r['candidate'].update({'referenceCount':len(refs),'uniqueFiles':len(unique),'selectedExpectedFiles':len(selected_refs),'selectedFilesPresent':len(selected_refs&set(unique))})
    products=load('docs/reviews/xue-er-phase-b-final.json')['products'];r['publishedDirectoryBytesUnchanged']=all(sha(read(p))==h for p,h in products.items());check(r['publishedDirectoryBytesUnchanged'],'published public/dist','prior published directory HTML unchanged')
    r['rawComplete']=len(r['raw'])==len(selected);r['processedComplete']=len(r['processed'])==len(processed_specs)
    r['changedWhileReading']=[p for p,h in snapshots.items() if not (ROOT/p).exists() or sha(read(p))!=h]
    check(not r['changedWhileReading'],'raw/processed evidence','completed immutable files stable during review')
    r['wordLevelAnchors']=[{'id':row['id'],'groups':row['wordGroups']} for row in r['raw'] if row.get('wordGroups')]
    r['alignmentBlockedIds']=[row['id'] for row in r['raw'] if row.get('alignmentPassed') is False]
    r['generationPendingIds']=[row['id'] for row in r['pending'] if row['stage'] in ['in-progress','not-yet-attempted','ledger-being-written']]
    r['status']='technical-blockers-with-generation-pending' if r['findings'] and r['generationPendingIds'] else 'needs-offline-alignment-review' if r['findings'] else 'completed-items-pass-pipeline-pending' if r['pending'] else 'technical-pass-human-listening-pending'
    target=ROOT/('docs/reviews/xue-er-real-'+args.batch+'-media.json');target.write_text(json.dumps(r,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps({'status':r['status'],'raw':len(r['raw']),'processed':len(r['processed']),'newDecodes':new_decodes,'pending':len(r['pending']),'candidate':r.get('candidate',{}).get('selectedFilesPresent'),'findings':r['findings']},ensure_ascii=False))
    raise SystemExit(1 if r['findings'] else 0)
if __name__=='__main__':main()
