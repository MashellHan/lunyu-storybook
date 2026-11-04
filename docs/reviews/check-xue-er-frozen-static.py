#!/usr/bin/env python3
"""Read existing B candidate files only; write evidence under docs/reviews."""
import hashlib
import json
from datetime import datetime, timezone
from html.parser import HTMLParser
from pathlib import Path
import re
from urllib.request import urlopen

ROOT = Path('/Users/mengxionghan/workspace/lunyu-storybook')
assert Path.cwd() == ROOT, 'Use the explicit target workdir'
OUT = ROOT / 'docs/reviews/xue-er-phase-b-36ce75f'
OUT.mkdir(exist_ok=True)
sha = lambda b: hashlib.sha256(b).hexdigest()
read = lambda p: (ROOT / p).read_bytes()
load = lambda p: json.loads(read(p))
freeze_path = 'tests/artifacts/xue-er-phase-b/frozen-inputs-before.json'
freeze = load(freeze_path)
EXPECTED = '36ce75f047f73f1ab7ed49c17e2d0278d952dc9ef2e8fe1cb2c4464421e9c8c1'
assert freeze['sha256'] == EXPECTED, 'Different candidate: do not overwrite this review'
sources = {p: read(p) for p in freeze['files']}
inputs = {p: sha(b) for p, b in sources.items()}
aggregate = lambda d: sha(''.join(p+'\t'+h+'\n' for p,h in sorted(d.items())).encode())
report = {'reviewedAt': datetime.now(timezone.utc).isoformat(), 'kind': 'candidate-static-review-only',
          'inputFingerprint': {'file': freeze_path, 'expected': EXPECTED, 'actual': aggregate(inputs), 'count': len(inputs), 'files': inputs},
          'checks': 0, 'findings': [], 'previews': [], 'directories': [], 'http': [], 'artifacts': {},
          'releaseAccepted': False, 'limitations': ['No build, frontend suite, timing repro, SDK or synthesis executed.', 'Static previews do not establish new media or publication readiness.', 'Physical devices, real new audio, human listening and billing not verified.']}
def check(ok, where, expectation):
    report['checks'] += 1
    if not ok: report['findings'].append({'where': where, 'expectation': expectation})
def source(p): return sources[p].decode()
def artifact(p):
    b = read(p)
    report['artifacts'][p] = {'sha256': sha(b), 'bytes': len(b)}
    return b.decode()
def payload(html, name):
    match = re.search(r'^const '+name+r' = (.*);$', html, re.M)
    assert match, name+' payload absent'
    return json.loads(match[1])
def code_match(file, html, chapter):
    scripts = re.findall(r'<script>([\s\S]*?)</script>', html)
    app = next(s for s in scripts if re.search(r'^const AUD = ', s, re.M))
    for key, placeholder in [('AUD','AUDIO'),('TIM','TIMINGS'),('CHAPTER','CHAPTER')]:
        app = re.sub(r'^const '+key+r' = .*;$', 'const '+key+' = __'+placeholder+'__;', app, flags=re.M)
    normalized = app.removeprefix('\n')
    check(normalized == source('src/app.js'), file, 'embedded app.js matches source except the three JSON payloads')
    check('<style>\n'+source('src/styles.css')+'</style>' in html, file, 'embedded base CSS matches source')
    check(not re.search(r'__[A-Z_]+__', html), file, 'no unresolved build placeholder')
    if chapter:
        check('<script>\n'+source('src/chapter-player.js')+'</script>' in html, file, 'chapter player matches source')
        check('<style>\n'+source('src/chapter.css')+'</style>' in html, file, 'chapter CSS matches source')
    return {'normalizedAppSHA256': sha(normalized.encode()), 'chapterCodePresent': chapter}

check(inputs == freeze['files'] and aggregate(inputs) == EXPECTED and len(inputs) == 48, freeze_path, '48/48 frozen inputs and aggregate match')
content = json.loads(sources['docs/content/xue-er.json'])
design = json.loads(sources['docs/design/xue-er-scene-config.json'])
for chapter, scene in zip(content['chapters'], design['chapters']):
    n = chapter['number']
    file = 'build/xue-er-preview/'+('index-single.html' if n == 1 else 'xue-er-'+str(n).zfill(2)+'.html')
    html = artifact(file)
    data = payload(html, 'CHAPTER')
    code = code_match(file, html, True)
    check(data['id'] == chapter['id'] and data['number'] == n and data['title'] == chapter['title'], file, 'chapter identity')
    check(data['preview'] is True and data['playable'] is False, file, 'preview only, not playable')
    check(data['contentSHA256'] == inputs['docs/content/xue-er.json'], file, 'frozen content provenance')
    check(payload(html, 'AUD') == {} and payload(html, 'TIM') == {} and 'data:audio' not in html, file, 'no preview media')
    check(data['scene'] == {k:v for k,v in scene.items() if k != 'pages'}, file, 'exact scene including prop and cue references')
    check(data['profiles'] == design['viewportProfiles'] and data['layouts'] == design['layoutPresets'].get(scene['layoutPresetId']), file, '17a163e geometry profiles and layouts')
    check(data['templates'] == {p['templateId']:design['propTemplates'][p['templateId']] for p in scene['props']} and data['motions'] == design['motionPresets'], file, 'exact templates and motion data')
    check([p['pageId'] for p in data['pages']] == [p['pageId'] for p in scene['pages']], file, 'page identities and order')
    segments = []
    groups = []
    for actual, expected in zip(data['pages'], scene['pages']):
        check({k:v for k,v in actual.items() if k != 'groups'} == expected, actual['pageId'], 'all scene page fields match')
        for group, wanted in zip(actual['groups'], expected['readingGroups']):
            check({k:group[k] for k in wanted} == wanted, group['id'], 'group references match')
            groups.append(group)
            segments.extend(group['segments'])
    wanted = [{'id':s['id'],'text':s['text'],'py':s['pinyin'],'start':s['start'],'end':s['end']} for s in chapter['segments']]
    check(segments == wanted, file, 'every original segment/pinyin/source position once in order')
    check(''.join(g['text'] for g in groups) == chapter['fullText'] and [p for g in groups for p in g['py']] == [p for s in chapter['segments'] for p in s['pinyin']], file, 'full text and pinyin including punctuation retained')
    report['previews'].append({'file':file, 'chapter':n, 'pages':len(data['pages']), 'segments':len(segments), 'groups':len(groups), **code})

class Directory(HTMLParser):
    def __init__(self):
        super().__init__(); self.entries = []; self.entry = None
    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag == 'li' and re.fullmatch(r'chapter-\d+', a.get('id','')):
            self.entry = {'id':a['id'], 'ready':a.get('data-publication-ready'), 'edition':a.get('data-edition'), 'links':[], 'disabled':False}
            self.entries.append(self.entry)
        elif self.entry:
            if tag == 'a': self.entry['links'].append({'href':a.get('href'), 'ariaLabel':a.get('aria-label')})
            if a.get('aria-disabled') == 'true': self.entry['disabled'] = True
    def handle_endtag(self, tag):
        if tag == 'li': self.entry = None

for file, preview, offline in [('public/learn/xue-er/index.html',False,False), ('dist/xue-er.html',False,True), ('build/xue-er-preview/xue-er.html',True,True)]:
    html = artifact(file); parser = Directory(); parser.feed(html); entries = parser.entries
    check(len(entries) == 16 and [e['id'] for e in entries] == ['chapter-'+str(n) for n in range(1,17)], file, '16 unique ordered chapters')
    check(all(e['ready'] == 'false' for e in entries), file, 'no full chapter marked ready')
    links = [a for e in entries for a in e['links']]
    check(len(links) == (16 if preview else 1), file, 'only intended entries are linked')
    if not preview:
        check(entries[0]['edition'] == 'legacy-demo' and '现有三句原文' in links[0]['ariaLabel'], file, 'first chapter explicitly identifies legacy demo')
        check(links[0]['href'] == ('./index-single.html' if offline else '/learn/xue-er/1/'), file, 'real legacy route')
        check(all(not e['links'] and e['disabled'] for e in entries[1:]), file, '15 unready chapters have no fake production link')
    else:
        check(all((ROOT/file).parent.joinpath(a['href']).is_file() for a in links), file, 'all static preview links exist')
    check(not re.search(r'data:audio|new Audio\(|<audio\b|rel=[\"\x27](?:preload|prefetch)', html, re.I), file, 'directory has no audio/preload')
    check('<style>\n'+source('src/volume.css')+'</style>' in html, file, 'embedded volume CSS matches source')
    report['directories'].append({'file':file, 'preview':preview, 'entries':entries})

report['productionHTMLFiles'] = {d: sorted(str(p.relative_to(ROOT/d)) for p in (ROOT/d).rglob('*.html')) for d in ['public','dist']}
check(report['productionHTMLFiles']['public'] == ['index.html','learn/xue-er/1/index.html','learn/xue-er/index.html'], 'public', 'only home, directory and legacy demo')
check(report['productionHTMLFiles']['dist'] == ['index-single.html','index.html','xue-er.html'], 'dist', 'only offline home, directory and legacy demo')
for folder, paths in report['productionHTMLFiles'].items():
    for path in paths:
        file = folder+'/'+path
        html = artifact(file)
        check('runtime-fixture' not in html and 'build/xue-er-preview' not in html, file, 'no private fixture/preview link leakage')
        if file in ['public/learn/xue-er/1/index.html','dist/index-single.html']:
            code_match(file, html, False)
            check(payload(html,'CHAPTER') is None and len(payload(html,'AUD')) == 15, file, 'production still uses legacy three-sentence demo only')

report['readiness'] = []
for mode in ['online','offline','preview']:
    file = 'build/xue-er-readiness-'+mode+'.json'; data = json.loads(artifact(file))
    check(data['contentSHA256'] == inputs['docs/content/xue-er.json'] and data['sceneSHA256'] == inputs['docs/design/xue-er-scene-config.json'], file, 'readiness provenance')
    check(len(data['chapters']) == 16 and all(c['ready'] is False and c['blockers'] for c in data['chapters']), file, '16 chapters remain nonready with actual blockers')
    report['readiness'].append({'file':file,'counts':data['counts'],'chapters':data['chapters']})

for route,file in [('/learn/xue-er/','public/learn/xue-er/index.html'),('/learn/xue-er/1/','public/learn/xue-er/1/index.html')]:
    with urlopen('http://127.0.0.1:4173'+route, timeout=10) as response:
        body = response.read(); status = response.status
    check(status == 200 and sha(body) == report['artifacts'][file]['sha256'], route, 'existing HTTP response equals inspected local file')
    report['http'].append({'route':route,'status':status,'bytes':len(body),'sha256':sha(body)})

report['screenshots'] = load('docs/reviews/xue-er-phase-b-36ce75f/screenshots.json')
for shot in report['screenshots']:
    b = read(shot['snapshot'])
    check(sha(b) == shot['sha256'], shot['snapshot'], 'fixed screenshot bytes match manifest')
    shot['actualDimensions'] = [int.from_bytes(b[16:20],'big'),int.from_bytes(b[20:24],'big')]
    shot['sourceStillMatches'] = sha(read(shot['source'])) == shot['sha256']

result_path = 'tests/artifacts/xue-er-phase-b/npm-test-b-result.json'
result_bytes = read(result_path); result = json.loads(result_bytes); log = read(result['log'])
check(sha(log) == result['log_sha256'], result['log'], 'suite result refers to exact raw log')
(OUT/'engineering-suite.log').write_bytes(log)
(OUT/'engineering-suite-result.json').write_bytes(result_bytes)
report['engineeringSuite'] = {k:result[k] for k in ['command','started_at','finished_at','exit_code','passed','failed','skipped','did not run','log','log_sha256']}
report['engineeringSuite']['sourceResultSHA256'] = sha(result_bytes)
report['engineeringSuite']['interpretation'] = '59 passed / 3 failed; root causes pending Engineer, no engineering or release acceptance'
report['engineeringSuite']['localEvidence'] = ['engineering-suite.log','engineering-suite-result.json']
report['inputFingerprintAfter'] = {p:sha(read(p)) for p in inputs}
report['inputChangedDuringCheck'] = [p for p,h in inputs.items() if report['inputFingerprintAfter'][p] != h]
check(not report['inputChangedDuringCheck'], 'snapshot', 'inputs stable during this read-only check')
report['staticStatus'] = 'passed-limited-static-scope' if not report['findings'] else 'needs-review'
report['overallStatus'] = 'not-accepted-await-corrected-green-freeze'
(OUT/'static-check.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'staticStatus':report['staticStatus'],'checks':report['checks'],'findings':report['findings'],'inputSHA256':report['inputFingerprint']['actual'],'previewPages':sum(c['pages'] for c in report['previews']),'suite':{'exit':result['exit_code'],'passed':result['passed'],'failed':result['failed']},'overallStatus':report['overallStatus']},ensure_ascii=False))
raise SystemExit(1 if report['findings'] else 0)
