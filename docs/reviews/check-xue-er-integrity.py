#!/usr/bin/env python3
"""Read-only preflight of the frozen content and Designer references; never a publication gate."""
from pathlib import Path
from copy import deepcopy
import hashlib
import json
import re
import sys

ROOT=Path('/Users/mengxionghan/workspace/lunyu-storybook')
CONTENT='docs/content/xue-er.json'
SCENES='docs/design/xue-er-scene-config.json'
FROZEN_CONTENT='85168c306fd68f1006f96ce189801b387252fcfef9fcdc982c0388705cb13b73'

def require(ok,message):
    if not ok:
        raise ValueError(message)

def sha(raw):
    return hashlib.sha256(raw).hexdigest()

def validate(content,scenes):
    require(scenes['content']['sha256']==FROZEN_CONTENT,'scene/content fingerprint mismatch')
    require([c['number'] for c in content['chapters']]==list(range(1,17)),'chapter order')
    require([c['chapterId'] for c in scenes['chapters']]==[c['id'] for c in content['chapters']],'scene chapter order')
    require(content['review']['publicationReady'] is False,'media-less content cannot become ready')
    actors=set(scenes['characterAssets'])
    ensembles=scenes['audioContract']['ensembles']
    ids=[]; page_ids=[]; group_ids=[]; summary=[]; bindings=0
    for original,scene in zip(content['chapters'],scenes['chapters']):
        chapter=original['id']
        require(scene['chapterNumber']==original['number'],chapter+': chapter number')
        require(original['review']['publicationReady'] is False,chapter+': premature ready')
        segments={s['id']:s for s in original['segments']}
        order=[s['id'] for s in original['segments']]
        require(len(segments)==len(order),chapter+': duplicate segment')
        require(''.join(s['text'] for s in original['segments'])==original['fullText'],chapter+': full text')
        props={p['id']:p for p in scene['props']}
        cues={q['id']:q for q in scene['cues']}
        require(len(props)==len(scene['props']) and len(cues)==len(scene['cues']),chapter+': duplicate prop/cue')
        require(scene['layoutPresetId']=='legacy-demo' or scene['layoutPresetId'] in scenes['layoutPresets'],chapter+': unknown layout')
        for p in props.values():
            require(p['templateId'] in scenes['propTemplates'],chapter+': unknown prop template')
        for cue in cues.values():
            for step in cue['steps']:
                for track in step['tracks']:
                    require(track['motionId'] in scenes['motionPresets'],chapter+': unknown motion')
                    target=track['target']
                    if 'propId' in target:
                        require(target['propId'] in props,chapter+': unknown cue prop')
                        parts={p['id'] for p in scenes['propTemplates'][props[target['propId']]['templateId']]['parts']}
                        require(target.get('partId') == '$whole' or target.get('partId') in parts,chapter+': unknown cue part')
                    else:
                        require(target.get('characterId') in actors,chapter+': unknown cue character')
        flattened=[]; group_count=0; last=0
        for page in scene['pages']:
            pid=page['pageId']; page_ids.append(pid)
            require(page['segmentIds'] and all(s in segments for s in page['segmentIds']),pid+': unknown/empty segment')
            flattened.extend(page['segmentIds'])
            selected=[segments[s] for s in page['segmentIds']]
            expected_range=[selected[0]['start'],selected[-1]['end']]
            require(page['sourceRange']==expected_range and expected_range[0]==last,pid+': source range gap')
            page_text=''.join(s['text'] for s in selected)
            require(page_text==original['fullText'][last:expected_range[1]],pid+': text splice')
            require(len([py for s in selected for py in s['pinyin']])==len(page_text),pid+': pinyin splice')
            last=expected_range[1]
            groups={g['id']:g for g in page['readingGroups']}
            require(len(groups)==len(page['readingGroups']),pid+': duplicate reading group')
            require([s for g in page['readingGroups'] for s in g['segmentIds']]==page['segmentIds'],pid+': reading group order/coverage')
            require(page['defaultReadingGroupId'] in groups,pid+': unknown default group')
            visible=page['visiblePropIds']
            require(len(visible)==len(set(visible)) and set(visible)<=set(props),pid+': invalid visible prop')
            for g in groups.values():
                group_ids.append(g['id'])
                require(g['audio']['leadRole'] in actors and g['audio']['soloRole'] in actors,g['id']+': unknown voice role')
                require(g['audio']['followEnsemble'] in ensembles,g['id']+': unknown ensemble')
                require(g['onReadCompleteCueId'] is None or g['onReadCompleteCueId'] in cues,g['id']+': unknown completion cue')
                for i,sid in enumerate(g['segmentIds']):
                    if segments[sid]['kind']=='attribution':
                        require(i+1<len(g['segmentIds']),g['id']+': stranded attribution')
            for binding in page['propBindings']:
                bindings+=1
                require(binding['propId'] in visible,pid+': invisible/unknown bound prop')
                if 'readingGroupId' in binding:
                    require(binding['readingGroupId'] in groups,pid+': prop points outside page')
                else:
                    selection=binding['readingGroupSelection']
                    allowed=selection['allowedReadingGroupIds']
                    require(allowed and len(allowed)==len(set(allowed)) and set(allowed)<=set(groups),pid+': invalid group selection')
                    require(selection['fallbackReadingGroupId'] in allowed,pid+': invalid fallback')
            for actor,refs in page.get('characterReadingGroupOverrides',{}).items():
                require(actor in actors and refs and len(refs)==len(set(refs)) and set(refs)<=set(groups),pid+': invalid character override')
            group_count+=len(groups)
        require(flattened==order and len(flattened)==len(set(flattened)),chapter+': page coverage/order/duplicate')
        require(last==len(original['fullText']),chapter+': final source range')
        ids.extend(order)
        summary.append({'chapterId':chapter,'pages':len(scene['pages']),'segments':len(order),'readingGroups':group_count,'publicationReady':False})
    require(len(ids)==len(set(ids))==72,'segment inventory')
    require(len(page_ids)==len(set(page_ids))==26,'page inventory')
    require(len(group_ids)==len(set(group_ids))==49,'reading-group inventory')
    all_segments={s['id']:s for c in content['chapters'] for s in c['segments']}
    for reuse in scenes['audioContract']['plannedAttributionReuse']:
        source=all_segments[reuse['sourceSegmentId']]; target=all_segments[reuse['segmentId']]
        require(source['text']==target['text'] and source['pinyin']==target['pinyin'],'reused attribution differs')
        require(reuse['requiresSourceAudioReady'] is True,'reuse cannot bypass source readiness')
    return {'chapters':summary,'pages':len(page_ids),'segments':len(ids),'readingGroups':len(group_ids),'propBindings':bindings}

def legacy_mapping(content,scenes,timings):
    segments={s['id']:s for c in content['chapters'] for s in c['segments']}
    result=[]
    for override in scenes['audioContract']['legacyOverrides']:
        segment=segments[override['segmentId']]
        for role in ('lead','follow','solo'):
            spec=override[role]; file=ROOT/spec['path']
            require(file.is_file() and file.stat().st_size>0,'missing legacy media '+str(file))
            timing=timings[spec['timingKey']]
            require(timing['dur']>0 and len(timing['text'])==len(timing['t']),'invalid legacy timing shape')
            points=[x for x in timing['t'] if x is not None]
            require(points==sorted(points) and all(0<=x<=timing['dur'] for x in points),'invalid legacy timing range')
            han=lambda t:''.join(re.findall(r'[\u4e00-\u9fff]',t))
            require(han(timing['text'])==han(segment['text']),'legacy voiced text mismatch')
            result.append({'segmentId':segment['id'],'kind':role,'path':spec['path'],'sha256':sha(file.read_bytes()),'timingKey':spec['timingKey'],'exactTextMatch':timing['text']==segment['text'],'timingText':timing['text'],'contentText':segment['text'],'requiresPunctuationIndexRemap':timing['text']!=segment['text']})
    return result

def main():
    require(Path.cwd()==ROOT,'Run with the explicit target workdir')
    raw={p:(ROOT/p).read_bytes() for p in (CONTENT,SCENES)}
    require(sha(raw[CONTENT])==FROZEN_CONTENT,'frozen content changed')
    content=json.loads(raw[CONTENT]); scenes=json.loads(raw[SCENES])
    checked=validate(content,scenes)
    assets=[p for asset in scenes['characterAssets'].values() for p in asset['layers']]
    require(all((ROOT/p).is_file() for p in assets),'missing character layer')
    mapped=legacy_mapping(content,scenes,json.loads((ROOT/'assets/audio/timings.json').read_text()))
    negative=[]
    for name in ('duplicate-page-segment','invalid-source-range','foreign-prop-reading-group','premature-ready'):
        c=deepcopy(content); s=deepcopy(scenes)
        if name=='duplicate-page-segment': s['chapters'][0]['pages'][0]['segmentIds'].append('xue-er-01-s02')
        elif name=='invalid-source-range': s['chapters'][0]['pages'][0]['sourceRange'][1]-=1
        elif name=='foreign-prop-reading-group': s['chapters'][1]['pages'][1]['propBindings'][0]['readingGroupId']='xue-er-03-p01-r01'
        else: c['chapters'][0]['review']['publicationReady']=True
        try:
            validate(c,s)
        except ValueError as error:
            negative.append({'case':name,'rejected':True,'reason':str(error)})
        else:
            raise ValueError('self-check failed: '+name)
    require(all((ROOT/p).read_bytes()==v for p,v in raw.items()),'inputs changed during preflight')
    report={'status':'content-scene-reference-preflight-passed','inputSha256':{p:sha(v) for p,v in raw.items()},**checked,'characterLayersPresent':len(assets),'legacyMappings':mapped,'negativeSelfChecks':negative,'formalReadyChapters':[],'productionMediaCompleteness':'not-verified; no frozen runtime media manifest handed off','runtimeFlows':'not-run; await stage-B implementation','scope':'Read-only inputs; no build, synthesis, media edits, Batch A manifest edits or publication.'}
    print(json.dumps(report,ensure_ascii=False,indent=2))

if __name__=='__main__':
    try:
        main()
    except (ValueError,KeyError,TypeError) as error:
        print(json.dumps({'status':'failed','error':str(error)},ensure_ascii=False))
        sys.exit(1)
