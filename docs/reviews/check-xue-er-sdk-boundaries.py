#!/usr/bin/env python3
"""Independent read-only alignment evidence from real SDK records; no SDK import."""
import argparse,copy,hashlib,json,math,re,unicodedata
from datetime import datetime,timezone
from pathlib import Path
import xml.etree.ElementTree as ET
ROOT=Path('/Users/mengxionghan/workspace/lunyu-storybook')
SPEC={'batch-a':('docs/tts/xue-er-generation-request.json','0c0a0fc0ee93868a91fcb76765a906c2bbe79d7a4a3e88c8cf60e462132be6da'),'batch-b':('docs/tts/xue-er-generation-request-b.json','26b79e3aa570877d917ce741079d0b67140ce1b33a29db7557b83d133396ead4')}
sha=lambda b:hashlib.sha256(b).hexdigest()
def han(c):return '\u3400'<=c<='\u9fff' or '\U00020000'<=c<='\U0002fa1f'
def need(ok,reason):
    if not ok:raise ValueError(reason)
def finite(x):return type(x) in (float,int) and math.isfinite(x)
def source_aliases(entry):
    xml=ET.fromstring(entry['ssml']);need(''.join(xml.itertext())==entry['plainText'],'SSML original text differs')
    found=[];position=0
    def visit(node):
        nonlocal position
        if node.tag.endswith('}sub'):
            need(not list(node),'nested sub unsupported')
            found.append({'index':position,'original':node.text or '', 'alias':node.get('alias')})
        position+=len(node.text or '')
        for child in node:
            visit(child);position+=len(child.tail or '')
    visit(xml)
    need(found==entry['aliasesBySourcePosition'],'alias positions differ from exact SSML')
    return {a['index']:a['alias'] for a in found}
def inspect(entry,result,total=None):
    text=entry['plainText'];positions=[i for i,c in enumerate(text) if han(c)];aliases=source_aliases(entry)
    wb=result.get('wb',[]);details=result.get('wordBoundaryDetails',[])
    need(len(details)==len(wb)>0,'wb/details absent or length differs')
    times=[None]*len(text);events=[];word_groups=[];cursor=0;last_offset=-1
    for number,(event,info) in enumerate(zip(wb,details)):
        need(len(event)==3,'bad event shape');offset,duration,word=event
        need(finite(offset) and finite(duration) and offset>=0 and duration>=0 and offset>=last_offset,'invalid/backward event time')
        if total is not None:need(offset<total and offset+duration<=total+.002,'raw event exceeds actual duration')
        last_offset=offset
        sdk_offset=info.get('textOffset');sdk_length=info.get('wordLength')
        need(type(sdk_offset) is int and sdk_offset>=-1 and type(sdk_length) is int and sdk_length>=0,'SDK position outside known -1 sentinel/nonnegative domain')
        need(isinstance(word,str) and sdk_length==len(word.encode('utf-16-le'))//2,'SDK wordLength differs from unmodified event text')
        if sdk_offset>=0:need(sdk_offset+sdk_length<=len(entry['ssml'].encode('utf-16-le'))//2,'SDK position outside exact SSML')
        row={'eventIndex':number,'rawEvent':event,'sdkPosition':info,'sdkPositionKnown':sdk_offset>=0}
        letters=None
        if word.startswith(chr(34)+chr(62)):
            need(number>0 and cursor>0 and cursor<len(positions),'fragment has no mapped prior/remaining source')
            body=word[2:];need(len(body) in (2,3) and all(han(c) for c in body),'fragment is not duplicate plus one/two Han remainder')
            previous=positions[cursor-1];remainder=body[1:];mapped=positions[cursor:cursor+len(remainder)]
            need(previous in aliases and body[0]==text[previous],'fragment duplicate lacks approved source alias')
            need(events[-1]['sourceIndices']==[previous] and wb[number-1][2]==aliases[previous],'immediate predecessor is not the exact single approved alias')
            need(offset>=wb[number-1][0]+wb[number-1][1]-.002,'fragment time overlaps its preceding alias')
            need(mapped==list(range(previous+1,previous+1+len(remainder))),'fragment remainder not contiguous source positions')
            need(remainder==''.join(text[i] for i in mapped),'fragment remainder not exact complete next source run')
            need(not any(i in aliases for i in mapped),'fragment remainder crosses another approved alias')
            letters=list(remainder)
            row.update({'classification':'unknown-position-proven-alias-repeat-run' if sdk_offset==-1 else 'proven-alias-repeat-run','alreadyMappedSourceIndex':previous,'sourceIndices':mapped,'droppedDuplicate':text[previous],'remainingText':remainder})
        else:
            need(all(han(c) or c.isspace() or unicodedata.category(c).startswith('P') for c in word),'unrecognized literal/SSML fragment')
            letters=[c for c in word if han(c)];mapped=positions[cursor:cursor+len(letters)]
            need(len(mapped)==len(letters),'extra spoken characters')
            need(all(c==text[i] or c==aliases.get(i) for c,i in zip(letters,mapped)),'unexpected character/alias at source '+str(positions[cursor] if cursor<len(positions) else 'end'))
            row.update({'classification':'known-sdk-position' if sdk_offset>=0 else 'unknown-sdk-position-exact-ordered-text','sourceIndices':mapped})
            if sdk_offset==-1 and len(mapped)==1 and word==aliases.get(mapped[0]):row['classification']='unknown-sdk-position-approved-alias'
        if len(letters)>1 and duration==0:
            # User-approved word-level anchor: preserve the real whole-word onset;
            # this does not establish any internal character pronunciation boundary.
            word_groups.append({'granularity':'word','boundaryIndex':number,'originalBoundaryText':word,'sourceIndexes':row['sourceIndices'],'offsetSeconds':offset,'sourceDurationSeconds':0,'sdkPosition':info})
            row['timingGranularity']='word'
        for j,index in enumerate(row['sourceIndices']):times[index]=round(offset+duration*j/len(letters),6)
        cursor+=len(letters);events.append(row)
    need(cursor==len(positions),'missing original Han positions '+str(positions[cursor:]))
    previous=-1
    for i,c in enumerate(text):
        if han(c):
            need(times[i] is not None and times[i]>=previous,'missing/nonmonotonic timing');previous=times[i]
            if total is not None:need(times[i]<total,'character timestamp exceeds duration')
        else:need(times[i] is None,'punctuation incorrectly timed')
    return {'text':text,'sourceCodePoints':len(text),'sourceHan':len(positions),'expectedTimes':times,'events':events,'unknownSDKPositions':sum(not e['sdkPositionKnown'] for e in events),'fragmentCorrections':[e for e in events if 'alreadyMappedSourceIndex' in e],'wordGroups':word_groups}
def main():
    parser=argparse.ArgumentParser();parser.add_argument('--batch',choices=SPEC,required=True);args=parser.parse_args()
    need(Path.cwd()==ROOT,'Use explicit target workdir');file,expected=SPEC[args.batch];raw=(ROOT/file).read_bytes();need(sha(raw)==expected,'approved request file changed');request=json.loads(raw)
    out={'reviewedAt':datetime.now(timezone.utc).isoformat(),'kind':'independent-real-boundary-proof','batch':args.batch,'requestSHA256':sha(raw),'entrySetSHA256':request['entrySetSHA256'],'completed':[],'pending':[],'findings':[],'counterexamples':[],'sdkCalls':0,'listeningPerformed':False,'scope':'Original SDK positioning -1 is retained as unknown. Every original Han position must be mapped exactly once. Zero-duration multi-character events use the user-approved shared real word onset, explicitly identified in wordGroups; no internal character onset or word duration is estimated. MP3 decoding is a separate check.'}
    for entry in request['entries']:
        result_file=Path(entry['rawOutput']).with_suffix('.result.json');p=ROOT/result_file
        if not p.exists():out['pending'].append(entry['id']);continue
        result_bytes=p.read_bytes();result=json.loads(result_bytes)
        if result.get('status')!='succeeded':out['findings'].append({'id':entry['id'],'status':result.get('status'),'kind':'completed-nonsuccess-result'});continue
        row={'id':entry['id'],'resultFile':str(result_file),'resultSHA256':sha(result_bytes),'ssmlSHA256':entry['ssmlSHA256'],'rawSHA256':result['rawSHA256']}
        try:row.update(inspect(entry,result));row['status']='complete-original-positions-proven'
        except ValueError as error:row.update({'status':'needs-review','reason':str(error)});out['findings'].append({'id':entry['id'],'reason':str(error)})
        out['completed'].append(row)
    if args.batch=='batch-a':
        entry=next(e for e in request['entries'] if e['id']=='xue-er-02-s02-dog');original=json.loads((ROOT/Path(entry['rawOutput']).with_suffix('.result.json')).read_text())
        def case(name,mutate):
            changed=copy.deepcopy(original);mutate(changed)
            # Keep wordLength faithful to the mutated text so rejection tests alignment, not a trivial length mismatch.
            for i,event in enumerate(changed['wb']):changed['wordBoundaryDetails'][i]['wordLength']=len(event[2].encode('utf-16-le'))//2
            try:inspect(entry,changed);out['counterexamples'].append({'name':name,'rejected':False});out['findings'].append({'counterexample':name,'reason':'accepted invalid input'})
            except ValueError as error:out['counterexamples'].append({'name':name,'rejected':True,'reason':str(error)})
        prefix=chr(34)+chr(62)
        case('extra Han after valid remainder',lambda d:d['wb'][7].__setitem__(2,prefix+'好犯上错'))
        case('missing 上 must not disappear',lambda d:d['wb'][7].__setitem__(2,prefix+'好犯'))
        case('wrong homophonic alias 毫 is unapproved',lambda d:d['wb'][6].__setitem__(2,'毫'))
        case('fragment across punctuation is nonadjacent',lambda d:d['wb'][5].__setitem__(2,prefix+'弟而'))
        case('fragment without previous event',lambda d:d['wb'][0].__setitem__(2,prefix+'好犯上'))
        case('fragment with wrong repeated original',lambda d:d['wb'][7].__setitem__(2,prefix+'弟犯上'))
        case('literal backslash must not be stripped',lambda d:d['wb'][7].__setitem__(2,chr(92)+prefix+'好犯上'))
        case('negative offset below -1 is not an unknown sentinel',lambda d:d['wordBoundaryDetails'][7].__setitem__('textOffset',-2))
    out['status']='needs-review' if out['findings'] else 'completed-records-proven-pending-generation' if out['pending'] else 'all-recorded-boundaries-proven'
    target=ROOT/('docs/reviews/xue-er-real-'+args.batch+'-boundaries.json');target.write_text(json.dumps(out,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps({'status':out['status'],'completed':len(out['completed']),'pending':len(out['pending']),'unknownSDKPositions':sum(c.get('unknownSDKPositions',0) for c in out['completed']),'fragments':sum(len(c.get('fragmentCorrections',[])) for c in out['completed']),'counterexamples':len(out['counterexamples']),'findings':out['findings']},ensure_ascii=False))
    raise SystemExit(1 if out['findings'] else 0)
if __name__=='__main__':main()
