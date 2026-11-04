#!/usr/bin/env python3
"""Read-only, offline audit of exact Batch B requests. JSON evidence goes to stdout."""
from pathlib import Path
from collections import Counter
from datetime import datetime, timezone
from decimal import Decimal
import ast
import hashlib
import json
import re
import sys
import unicodedata
import xml.etree.ElementTree as ET

ROOT = Path('/Users/mengxionghan/workspace/lunyu-storybook')
FILES = {
    'batchB': 'docs/tts/xue-er-generation-request-b.json',
    'batchBMarkdown': 'docs/tts/xue-er-generation-request-b.md',
    'batchA': 'docs/tts/xue-er-generation-request.json',
    'content': 'docs/content/xue-er.json',
    'voices': 'scripts/tts/config.py',
}
EXPECTED = {
    'content': '85168c306fd68f1006f96ce189801b387252fcfef9fcdc982c0388705cb13b73',
    'batchA': '0c0a0fc0ee93868a91fcb76765a906c2bbe79d7a4a3e88c8cf60e462132be6da',
    'entrySetB': 'ff9384ff4d805bdab7567bda65d12c0101ec4007d10b17ee00a55b06ee6ea54f',
    'entrySetA': '472d68446e3209689037534c3e9dedab710503b1036719d07a0e22752f672296',
}
ROLES = ['elephant', 'bunny', 'cat', 'dog']
NS = 'http://www.w3.org/2001/10/synthesis'
MSTTS = 'https://www.w3.org/2001/mstts'
XML = 'http://www.w3.org/XML/1998/namespace'
issues = []
check_count = 0


def check(ok, location, message):
    global check_count
    check_count += 1
    if not ok:
        issues.append({'location': location, 'message': message})
    return ok


def sha(raw):
    return hashlib.sha256(raw).hexdigest()


def canonical(obj):
    return sha(json.dumps(obj, ensure_ascii=False, sort_keys=True, separators=(',', ':')).encode())


def hanzi(text):
    return sum('\u3400' <= ch <= '\u9fff' for ch in text)


def numeric_pinyin(pinyin):
    tones = {'\u0304': '1', '\u0301': '2', '\u030c': '3', '\u0300': '4'}
    tone = next((tones[ch] for ch in unicodedata.normalize('NFD', pinyin) if ch in tones), '5')
    base = ''.join(ch for ch in unicodedata.normalize('NFD', pinyin) if ch not in tones)
    return unicodedata.normalize('NFC', base) + ' ' + tone


def main():
    if Path.cwd() != ROOT:
        raise ValueError('Run with explicit /Users/mengxionghan/workspace/lunyu-storybook workdir')
    raw = {name: (ROOT / path).read_bytes() for name, path in FILES.items()}
    b = json.loads(raw['batchB'])
    a = json.loads(raw['batchA'])
    content = json.loads(raw['content'])
    md = raw['batchBMarkdown'].decode()
    for name in ('content', 'batchA'):
        check(sha(raw[name]) == EXPECTED[name], FILES[name], 'frozen byte fingerprint')
    for batch, label in ((b, 'B'), (a, 'A')):
        digest = canonical(batch['entries'])
        check(digest == batch['entrySetSHA256'] == EXPECTED['entrySet' + label],
              FILES['batch' + label] + '#/entrySetSHA256', 'exact canonical request-set fingerprint')
        check(batch['configSHA256'] == sha(raw['voices']), FILES['batch' + label], 'approved voice config fingerprint')
    check(b['sourceFile'] == FILES['content'] and b['sourceFileSHA256'] == EXPECTED['content'],
          FILES['batchB'], 'frozen content source binding')
    projection = {'edition': content['edition'], 'chapters': [
        {key: ch[key] for key in ('number', 'id', 'title', 'fullText', 'segments')}
        for ch in content['chapters'][3:]
    ]}
    check(canonical(projection) == b['contentSubsetSHA256'], '#/contentSubsetSHA256', 'chapter 4-16 content projection')
    check(b['batchADependency']['unchangedFileSHA256'] == sha(raw['batchA'])
          and b['batchADependency']['entrySetSHA256'] == EXPECTED['entrySetA']
          and b['batchADependency']['requests'] == len(a['entries']) == 30,
          '#/batchADependency', 'exact unchanged Batch A dependency')
    check(b['paidCallsPerformed'] == 0 and b['automaticRetries'] == 0 and b['maxRequests'] == 205,
          '#/', 'prepared state and bounded request count')
    check(b['voices'] == a['voices'], '#/voices', 'Batch A voice/style/rate/pitch compatibility')
    check(b['sampleRate'] == a['sampleRate'] == 'Audio24Khz96KBitRateMonoMp3'
          and b['wordBoundaries'] is True
          and b['targetProcessedFormat'] == a['targetProcessedFormat'] == '24kHz mono MP3 64kbps',
          '#/', 'output and word-boundary settings')
    check(b['mixing'] == a['mixing'], '#/mixing', 'unchanged offline children mixing')
    assignments = {}
    for node in ast.parse(raw['voices'].decode()).body:
        if isinstance(node, ast.Assign) and len(node.targets) == 1 and isinstance(node.targets[0], ast.Name):
            if node.targets[0].id in ('VOICES', 'DOG_FIRST_BREAK'):
                assignments[node.targets[0].id] = ast.literal_eval(node.value)
    for role, configured in assignments['VOICES'].items():
        check(b['voices'][role] == dict(zip(('voice', 'expressAsOpen', 'rate', 'pitch'),
                                         (configured[0], configured[1], configured[3], configured[4]))),
              '#/voices/' + role, 'voice parameters match config without executing it')
    check(assignments['DOG_FIRST_BREAK'] == '100ms', 'scripts/tts/config.py', 'approved dog pause')

    chapters = {ch['number']: ch for ch in content['chapters']}
    segments = {s['id']: (ch, s) for ch in content['chapters'] for s in ch['segments']}
    check([ch['number'] for ch in content['chapters']] == list(range(1, 17)), 'content', 'chapter order')
    check(content['review']['publicationReady'] is False
          and all(ch['review']['publicationReady'] is False for ch in content['chapters']),
          'content', 'no media-less chapter becomes publication ready')
    for ch in content['chapters']:
        check(''.join(s['text'] for s in ch['segments']) == ch['fullText'], ch['id'], 'full text and attribution preserved')
        offset = 0
        for s in ch['segments']:
            check(s['start'] == offset and s['end'] == offset + len(s['text'])
                  and len(s['pinyin']) == len(s['text']), s['id'], 'continuous original character positions')
            check(all(bool(py) == bool(hanzi(char)) for char, py in zip(s['text'], s['pinyin'])),
                  s['id'], 'punctuation pinyin remains empty')
            offset = s['end']
            for p in s['pronunciations']:
                i = p['index']
                check(s['text'][i] == p['char'] and s['pinyin'][i] == p['pinyin']
                      and p['chapterIndex'] == s['start'] + i, s['id'], 'pronunciation position and pinyin')
                check(p['sapi']['ph'] == numeric_pinyin(p['pinyin']), s['id'] + ':' + str(i), 'SAPI syllable and tone')

    texts = {t['id']: t for t in b['texts']}
    check(len(texts) == len(b['texts']) == 61, '#/texts', '61 unique text IDs')
    body_texts = [t for t in b['texts'] if t['segment'] is not None]
    titles = [t for t in b['texts'] if t['segment'] is None]
    check(len(body_texts) == 48 and len(titles) == 13, '#/texts', '48 new segments and 13 titles')
    title_details = []
    title_marks = {}
    for t in b['texts']:
        ch = chapters[t['chapter']]
        loc = '#/texts/' + t['id']
        check(4 <= t['chapter'] <= 16, loc, 'correct batch chapter range')
        check(t['characters'] == len(t['text']) and t['hanzi'] == hanzi(t['text']), loc, 'text counts')
        if t['segment'] is not None:
            owner, s = segments[t['segment']]
            check(t['id'] == s['id'] and owner['number'] == t['chapter']
                  and t['text'] == s['text'] and t['roles'] == ROLES, loc, 'exact body and four roles')
        else:
            positions = t['titleSourcePositions']
            chapter_py = [p for s in ch['segments'] for p in s['pinyin']]
            check(t['id'] == ch['id'] + '-title' and t['roles'] == ['elephant']
                  and t['text'] == '论语，之，' + ch['title'] + '。', loc, 'title format and voice')
            check(positions == sorted(set(positions)) and len(positions) == len(ch['title'])
                  and all(type(p) is int and 0 <= p < len(ch['fullText']) for p in positions), loc, 'title positions unique, ordered, in range')
            check(''.join(ch['fullText'][p] for p in positions) == ch['title'], loc, 'title characters from original body')
            check(t['titlePinyin'] == [chapter_py[p] for p in positions], loc, 'title pinyin from original positions')
            chapter_pron = {p['chapterIndex']: p for s in ch['segments'] for p in s['pronunciations']}
            marks = [{'index': 0, 'char': '论', 'ph': 'lun 2'}]
            marks += [{'index': 5 + i, 'char': chapter_pron[p]['char'], 'ph': chapter_pron[p]['sapi']['ph']}
                      for i, p in enumerate(positions)
                      if p in chapter_pron and chapter_pron[p]['sapi']['suggestedForNewSpeech']]
            title_marks[t['id']] = marks
            title_details.append({'textId': t['id'], 'title': ch['title'], 'sourcePositions': positions,
                                  'pinyin': t['titlePinyin'], 'expectedPhonemes': marks})
    check(sorted(t['chapter'] for t in titles) == list(range(4, 17)), '#/texts', 'one title per chapter')

    entries = b['entries']
    all_entries = a['entries'] + entries
    check(len(entries) == len({e['id'] for e in entries}) == 205, '#/entries', '205 unique IDs')
    check(len(all_entries) == len({e['id'] for e in all_entries}) == 235, '#/entries', 'no Batch A ID collision')
    check(len({e['ssml'] for e in all_entries}) == 235, '#/entries', 'no exact SSML request billed twice across A+B')
    check(Counter((e['textId'], e['role']) for e in entries)
          == Counter((t['id'], role) for t in b['texts'] for role in t['roles']),
          '#/entries', 'one request per planned text and role')
    check(Counter(e['role'] for e in entries) == {'elephant': 61, 'bunny': 48, 'cat': 48, 'dog': 48},
          '#/entries', 'voice distribution')
    check(dict(Counter(str(e['chapter']) for e in entries)) == b['requestsByChapter'],
          '#/requestsByChapter', 'chapter request subtotals')
    paths = [e[key] for e in entries for key in ('rawOutput', 'processedOutput')]
    all_paths = [e[key] for e in all_entries for key in ('rawOutput', 'processedOutput')]
    check(len(set(paths)) == 410 and len(set(all_paths)) == 470, '#/entries', 'raw/processed paths unique, no A collision')
    entry_details = []
    for e in entries:
        loc = '#/entries/' + e['id']
        start_issues = len(issues)
        t = texts[e['textId']]
        voice = b['voices'][e['role']]
        check(e['id'] == t['id'] + '-' + e['role'] and e['chapter'] == t['chapter']
              and e['segment'] == t['segment'] and e['plainText'] == t['text']
              and e['textCharacters'] == t['characters'] and e['hanzi'] == t['hanzi'], loc, 'entry/text identity')
        check(all(e[key] == voice[key] for key in ('voice', 'rate', 'pitch')), loc, 'entry voice/rate/pitch')
        check(sha(e['ssml'].encode()) == e['ssmlSHA256'], loc, 'SSML exact SHA')
        check('<!DOCTYPE' not in e['ssml'] and '<!ENTITY' not in e['ssml'], loc, 'self-contained XML')
        root = ET.fromstring(e['ssml'])
        check(root.tag == '{' + NS + '}speak'
              and root.attrib == {'version': '1.0', '{' + XML + '}lang': 'zh-CN'}
              and len(root) == 1, loc, 'speak structure')
        v = root[0]
        check(v.tag == '{' + NS + '}voice' and v.attrib == {'name': voice['voice']} and len(v) == 1,
              loc, 'single exact voice')
        wrapper = v
        if voice['expressAsOpen']:
            wrapper = v[0]
            expected = ET.fromstring('<root xmlns:mstts="' + MSTTS + '">' + voice['expressAsOpen'] + '</mstts:express-as></root>')[0]
            check(wrapper.tag == expected.tag and wrapper.attrib == expected.attrib and len(wrapper) == 1, loc, 'style/role/degree')
        pnode = wrapper[0]
        check(pnode.tag == '{' + NS + '}prosody' and pnode.attrib == {'rate': voice['rate'], 'pitch': voice['pitch']},
              loc, 'single prosody')
        check(''.join(root.itertext()) == e['plainText'], loc, 'XML original text includes every punctuation/code point')
        plain = pnode.text or ''
        phonemes, aliases, breaks = [], [], []
        for child in pnode:
            index = len(plain)
            tag = child.tag.rsplit('}', 1)[-1]
            check(len(child) == 0 and child.tag in {'{' + NS + '}' + name for name in ('phoneme', 'sub', 'break')},
                  loc, 'only planned inline speech tags')
            if tag == 'phoneme':
                check(set(child.attrib) == {'alphabet', 'ph'} and child.attrib.get('alphabet') == 'sapi'
                      and len(child.text or '') == 1, loc, 'single-character SAPI markup')
                phonemes.append({'index': index, 'char': child.text, 'ph': child.attrib['ph']})
            elif tag == 'sub':
                check(set(child.attrib) == {'alias'} and len(child.text or '') == len(child.attrib.get('alias', '')) == 1,
                      loc, 'single-position HD alias')
                aliases.append({'index': index, 'original': child.text, 'alias': child.attrib['alias']})
            else:
                check(child.attrib == {'time': '100ms'} and not child.text, loc, 'approved break only')
                breaks.append(index)
            plain += child.text or ''
            plain += child.tail or ''
        check(plain == e['plainText'], loc, 'inline positions reproduce exact original text')
        if e['segment'] is not None:
            s = segments[e['segment']][1]
            expected_phonemes = [{'index': p['index'], 'char': p['char'], 'ph': p['sapi']['ph']}
                                 for p in s['pronunciations'] if p['sapi']['suggestedForNewSpeech']] if e['role'] != 'dog' else []
            expected_aliases = [{'index': p['index'], 'original': p['char'], 'alias': p['hd']['alias']}
                                for p in s['pronunciations'] if p['hd']['suggestedForNewSpeech']] if e['role'] == 'dog' else []
        else:
            expected_phonemes, expected_aliases = title_marks[e['textId']], []
        check(phonemes == expected_phonemes, loc, 'exact suggested SAPI marks at original positions, no global replacement')
        check(aliases == expected_aliases == e['aliasesBySourcePosition'], loc, 'HD alias metadata and XML at exact positions')
        expected_breaks = [e['plainText'].index('，') + 1] if e['role'] == 'dog' and '，' in e['plainText'] else []
        check(breaks == expected_breaks, loc, 'dog first-comma break only')
        for field, parent in (('rawOutput', 'assets/source/tts-raw/xue-er/batch-b/'),
                              ('processedOutput', 'assets/audio/xue-er/batch-b/')):
            check(e[field] == parent + e['id'] + '.mp3', loc + '/' + field, 'isolated new-media path')
            check(not (ROOT / e[field]).exists(), loc + '/' + field, 'new target does not overwrite existing file')
        entry_details.append({'id': e['id'], 'passed': len(issues) == start_issues, 'ssmlSHA256': e['ssmlSHA256'],
                              'phonemes': phonemes, 'aliasesBySourcePosition': aliases, 'breakPositions': breaks})

    reuse = b['reuse']
    new_segments = {t['segment'] for t in body_texts}
    reused_segments = [r['segment'] for r in reuse]
    expected_segments = [s['id'] for ch in content['chapters'][3:] for s in ch['segments']]
    check(len(reuse) == len(set(reused_segments)) == 13, '#/reuse', '13 unique retained attribution occurrences')
    check(not new_segments.intersection(reused_segments)
          and new_segments.union(reused_segments) == set(expected_segments) and len(expected_segments) == 61,
          '#/reuse', 'each chapter 4-16 segment resolves exactly once')
    segment_entries = {(e['segment'], e['role']): e for e in all_entries if e['segment']}
    reuse_details = []
    for r in reuse:
        owner, target = segments[r['segment']]
        source = segments[r['from']][1]
        loc = '#/reuse/' + r['segment']
        check(r['chapter'] == owner['number'] and target['kind'] == source['kind'] == 'attribution'
              and target['text'] == source['text'] and target['pinyin'] == source['pinyin']
              and target.get('attributedSpeaker') == source.get('attributedSpeaker')
              and r['roles'] == ROLES, loc, 'identical attribution text/readings, each original occurrence retained')
        source_batch = a if r['fromBatch'] == 'A' else b
        ids = []
        for role in ROLES:
            e = segment_entries.get((r['from'], role))
            check(e is not None and e in source_batch['entries'], loc, 'source request exists for every role in declared batch')
            if e:
                check(e['plainText'] == target['text'], loc, 'reused request text includes whole attribution')
                ids.append(e['id'])
        reuse_details.append({'segmentId': target['id'], 'chapterRange': [target['start'], target['end']],
                              'sourceSegmentId': source['id'], 'fromBatch': r['fromBatch'], 'sourceEntryIds': ids})
    all_reuse = {r['segment']: r['from'] for r in a['reuse'] + reuse}
    old_segments = {'xue-er-01-s02', 'xue-er-01-s03', 'xue-er-01-s04'}
    entire_coverage = []
    for ch in content['chapters']:
        coverage = []
        for s in ch['segments']:
            direct = all((s['id'], role) in segment_entries for role in ROLES)
            reuse_ok = s['id'] in all_reuse and all((all_reuse[s['id']], role) in segment_entries for role in ROLES)
            legacy = s['id'] in old_segments
            check(sum((direct, reuse_ok, legacy)) == 1, s['id'], 'full-book planned body coverage exactly once')
            coverage.append({'segmentId': s['id'], 'source': 'legacy-v5' if legacy else all_reuse.get(s['id'], s['id']),
                             'kind': 'legacy' if legacy else 'reuse' if reuse_ok else 'new-request-set'})
        title_count = sum(e['chapter'] == ch['number'] and e['segment'] is None for e in all_entries)
        check(title_count == (0 if ch['number'] == 1 else 1), ch['id'], 'full-book title coverage, legacy title not re-billed')
        entire_coverage.append({'chapter': ch['number'], 'segments': coverage, 'title': 'legacy' if ch['number'] == 1 else 'new'})

    neural = sum(e['textCharacters'] for e in entries if e['role'] != 'dog')
    hd = sum(e['textCharacters'] for e in entries if e['role'] == 'dog')
    neural_xml = sum(len(e['ssml']) for e in entries if e['role'] != 'dog')
    hd_xml = sum(len(e['ssml']) for e in entries if e['role'] == 'dog')
    estimate = lambda n, h: float((Decimal(n) * 15 + Decimal(h) * 22) / 1000000)
    budget = b['budget']
    check(neural == budget['neuralPlainCharacters'] == 1612 and hd == budget['hdPlainCharacters'] == 488, '#/budget', 'plain character totals')
    check(estimate(neural, hd) == budget['plainCharacterReferenceEstimate']
          and estimate(neural_xml, hd_xml) == budget['fullSSMLCharacterConservativeReference'],
          '#/budget', 'reference arithmetic, not invoice verification')
    combined_plain = estimate(sum(e['textCharacters'] for e in all_entries if e['role'] != 'dog'),
                              sum(e['textCharacters'] for e in all_entries if e['role'] == 'dog'))
    combined_xml = estimate(sum(len(e['ssml']) for e in all_entries if e['role'] != 'dog'),
                            sum(len(e['ssml']) for e in all_entries if e['role'] == 'dog'))
    check(combined_plain == budget['combinedABPlainCharacterReference']
          and combined_xml == budget['combinedABFullSSMLConservativeReference'], '#/budget', 'A+B reference arithmetic')
    check(budget['projectCeilingAuthorized'] == 10 and budget['batchInputsApproved'] is False, '#/budget', 'shared ceiling and unchanged historical review-state field')
    check(sum(t['hanzi'] for t in body_texts) == 373 and sum(t['characters'] for t in body_texts) == 488, '#/texts', 'body unique input totals')
    for chapter, count in b['requestsByChapter'].items():
        check(re.search(r'\|\s*' + chapter + r'\s*\|\s*' + str(count) + r'\s*\|', md) is not None,
              FILES['batchBMarkdown'], 'chapter count table ' + chapter)
    for marker in (EXPECTED['content'], EXPECTED['entrySetB'], '205', '48', '13', '52', '410', 'US$10', '1.086569', '0.034916'):
        check(marker in md, FILES['batchBMarkdown'], 'documented count/hash/limit ' + marker)
    check(all((ROOT / FILES[name]).read_bytes() == value for name, value in raw.items()),
          'inputs', 'all input bytes unchanged throughout audit')
    report = {
        'status': 'passed-static-request-audit' if not issues else 'failed-static-request-audit',
        'reviewedAt': datetime.now(timezone.utc).isoformat(),
        'reviewer': 'lunyu-review',
        'checker': 'docs/reviews/check-xue-er-tts-b.py',
        'checks': check_count,
        'findings': issues,
        'inputSha256': {FILES[name]: sha(value) for name, value in raw.items()},
        'requestSetSha256': {'A': canonical(a['entries']), 'B': canonical(entries)},
        'contentSubsetB': canonical(projection),
        'counts': {'newRequests': len(entries), 'newBodySegments': len(body_texts), 'titles': len(titles),
                   'uniqueTextInputs': len(texts), 'voiceDistribution': dict(Counter(e['role'] for e in entries)),
                   'reusedAttributions': len(reuse), 'avoidedRequests': len(reuse) * 4,
                   'uniqueNewPaths': len(set(paths)), 'bodyCodePoints': 488, 'bodyHanzi': 373,
                   'sapiMarks': sum(len(e['phonemes']) for e in entry_details),
                   'hdAliases': sum(len(e['aliasesBySourcePosition']) for e in entry_details),
                   'newTargetPathsPresent': sum((ROOT / path).exists() for path in paths),
                   'totalABRequests': len(all_entries), 'fullBookSegmentsCoveredInPlan': sum(len(c['segments']) for c in entire_coverage)},
        'referenceArithmetic': {'neuralPlainCharacters': neural, 'hdPlainCharacters': hd,
                                'neuralSSMLCharacters': neural_xml, 'hdSSMLCharacters': hd_xml,
                                'plainUSD': estimate(neural, hd), 'ssmlUSD': estimate(neural_xml, hd_xml),
                                'combinedABPlainUSD': combined_plain, 'combinedABSSMLUSD': combined_xml,
                                'billingValidation': 'not-performed; Dragon SKU and billed-character rules unconfirmed'},
        'titles': title_details,
        'reuse': reuse_details,
        'fullBookPlannedCoverage': entire_coverage,
        'entries': entry_details,
        'inputBytesUnchanged': all((ROOT / FILES[name]).read_bytes() == value for name, value in raw.items()),
        'scope': 'Read-only source inputs; only review files written. No SDK import/execution, service request, build, homepage tests, media or production edits.',
        'limitations': ['Main-session instruction authorizes exact A+B 235 requests within shared USD10; preserved manifest approval flags are historical. Credentials remain pending; this reviewer does not synthesize.',
                       'Manifest coverage is a production plan, not actual media completeness or publication readiness.',
                       'Azure acceptance, acoustic pronunciations, HD realization, word-boundary mapping and human listening are not verified.',
                       'No physical device or stage-B runtime was tested; old v5 and exact Batch A inputs are unchanged.']
    }
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0 if not issues else 1


if __name__ == '__main__':
    try:
        sys.exit(main())
    except (ValueError, KeyError, TypeError, ET.ParseError, IndexError) as error:
        print(json.dumps({'status': 'audit-could-not-complete', 'error': str(error), 'findingsBeforeError': issues}, ensure_ascii=False, indent=2))
        sys.exit(1)
