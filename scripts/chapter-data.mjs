import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const CONTENT_SHA = "85168c306fd68f1006f96ce189801b387252fcfef9fcdc982c0388705cb13b73";
export const ANNOTATIONS_FILE = "docs/content/xue-er-annotations.json";
export const SCENE_SHA = "17a163e213a206b39622fec527e185a7e5ff8a4c71a18e63fa22eb8225e97a9c";
export const RELEASE_FILE = "docs/xue-er-release-authorization.json";
export const RELEASE_SHA = "9dcafa05a26b38c05c14c5c770221d7c3de7d7bcc2a6324d4aa26e23d54b51c2";
export const BATCHES = {
  "batch-a": { entrySetSHA256: "472d68446e3209689037534c3e9dedab710503b1036719d07a0e22752f672296", requests: 30, request: "docs/tts/xue-er-generation-request.json", fileSHA256: "0c0a0fc0ee93868a91fcb76765a906c2bbe79d7a4a3e88c8cf60e462132be6da" },
  "batch-b": { entrySetSHA256: "ff9384ff4d805bdab7567bda65d12c0101ec4007d10b17ee00a55b06ee6ea54f", requests: 205, request: "docs/tts/xue-er-generation-request-b.json", fileSHA256: "26b79e3aa570877d917ce741079d0b67140ce1b33a29db7557b83d133396ead4" },
};
export const hash = data => crypto.createHash("sha256").update(data).digest("hex");
export const readJSON = file => JSON.parse(fs.readFileSync(path.join(ROOT, file), "utf8"));
const assert = (ok, message) => { if (!ok) throw new Error(message); };
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const han = ch => /\p{Script=Han}/u.test(ch);
const roles = ["elephant", "bunny", "cat", "dog"];
let approved;
export function approvedRequests() {
  if (approved) return approved;
  approved = Object.entries(BATCHES).map(([batch, spec]) => {
    const bytes = fs.readFileSync(path.join(ROOT, spec.request));
    assert(hash(bytes) === spec.fileSHA256, `Changed approved request: ${batch}`);
    const request = JSON.parse(bytes);
    assert(request.entrySetSHA256 === spec.entrySetSHA256 && request.entries.length === spec.requests, `Changed approved entries: ${batch}`);
    return { batch, ...request };
  });
  return approved;
}
export function approvedSource(textId, role) {
  const requests = approvedRequests();
  const lookupRole = role === "children" ? "bunny" : role;
  const reuse = requests.flatMap(r => r.reuse).find(r => r.segment === textId && r.roles.includes(lookupRole));
  const sourceId = reuse?.from || textId;
  for (const request of requests) {
    const entry = request.entries.find(e => e.textId === sourceId && e.role === lookupRole);
    if (entry) return { ...entry, batch: request.batch, file: role === "children" ? `assets/audio/xue-er/${request.batch}/${sourceId}-children.mp3` : entry.processedOutput };
  }
  throw new Error(`Not in an approved request/reuse map: ${textId}:${role}`);
}

export function validateBook(content, design) {
  assert(content.chapters.length === 16 && design.chapters.length === 16, "Expected sixteen chapters");
  assert(design.content.sha256 === CONTENT_SHA, "Scene config references a different text edition");
  let pageCount = 0, segmentCount = 0, groupCount = 0;
  content.chapters.forEach((chapter, i) => {
    assert(chapter.number === i + 1 && chapter.id === `xue-er-${String(i + 1).padStart(2, "0")}`, "Chapter order/identity changed");
    let offset = 0;
    for (const segment of chapter.segments) {
      const chars = Array.from(segment.text);
      assert(segment.start === offset && segment.end === offset + chars.length, `${segment.id}: discontinuous offsets`);
      assert(chars.length === segment.pinyin.length, `${segment.id}: pinyin length`);
      assert(chars.every((ch, index) => han(ch) ? !!segment.pinyin[index] : segment.pinyin[index] === ""), `${segment.id}: pinyin/punctuation mismatch`);
      offset = segment.end;
    }
    assert(chapter.segments.map(s => s.text).join("") === chapter.fullText, `${chapter.id}: incomplete text`);
    const scene = design.chapters[i];
    assert(scene.chapterId === chapter.id && scene.chapterNumber === chapter.number, `${chapter.id}: scene identity`);
    const ids = chapter.segments.map(s => s.id);
    assert(new Set(ids).size === ids.length, `${chapter.id}: duplicate segment`);
    assert(same(scene.pages.flatMap(p => p.segmentIds), ids), `${chapter.id}: page coverage/order`);
    assert(new Set(scene.pages.map(p => p.pageId)).size === scene.pages.length, `${chapter.id}: duplicate page`);
    const byId = Object.fromEntries(chapter.segments.map(s => [s.id, s]));
    const propIds = scene.props.map(p => p.id), cueIds = scene.cues.map(c => c.id);
    assert(new Set(propIds).size === propIds.length && new Set(cueIds).size === cueIds.length, `${chapter.id}: duplicate prop/cue`);
    for (const page of scene.pages) {
      groupCount += page.readingGroups.length;
      const segments = page.segmentIds.map(id => byId[id]);
      assert(same(page.sourceRange, [segments[0].start, segments.at(-1).end]), `${page.pageId}: source range`);
      assert(same(page.readingGroups.flatMap(g => g.segmentIds), page.segmentIds), `${page.pageId}: group coverage/order`);
      const groupIds = page.readingGroups.map(g => g.id);
      assert(new Set(groupIds).size === groupIds.length && groupIds.includes(page.defaultReadingGroupId), `${page.pageId}: group identity`);
      for (const group of page.readingGroups) {
        assert(roles.includes(group.responder), `${group.id}: unknown responder`);
        assert(!group.onReadCompleteCueId || cueIds.includes(group.onReadCompleteCueId), `${group.id}: missing cue`);
        for (const id of group.segmentIds) {
          if (byId[id].kind === "attribution") {
            const following = ids[ids.indexOf(id) + 1];
            assert(group.segmentIds.includes(following), `${group.id}: attribution separated from speech`);
          }
        }
      }
      assert(page.visiblePropIds.every(id => propIds.includes(id)), `${page.pageId}: missing visible prop`);
      for (const binding of page.propBindings) {
        assert(page.visiblePropIds.includes(binding.propId), `${page.pageId}: invisible interactive prop`);
        const bound = binding.readingGroupId ? [binding.readingGroupId] : binding.readingGroupSelection.allowedReadingGroupIds;
        assert(bound.every(id => groupIds.includes(id)), `${page.pageId}: prop reads outside page`);
      }
    }
    for (const prop of scene.props) {
      const template = design.propTemplates[prop.templateId];
      assert(template, `${prop.id}: missing template`);
      assert(!template.preserveAspectRatio || template.preserveAspectRatio === "none" && prop.layer === "background", `${prop.id}: only static backgrounds may stretch`);
    }
    for (const cue of scene.cues) for (const step of cue.steps) {
      const focal = new Set(step.tracks.map(t => t.target.propId || t.target.characterId));
      assert(focal.size === 1, `${cue.id}: simultaneous focal objects`);
      for (const track of step.tracks) {
        assert(design.motionPresets[track.motionId], `${cue.id}: missing motion`);
        const prop = scene.props.find(p => p.id === track.target.propId);
        assert(track.target.characterId ? roles.includes(track.target.characterId) : prop && (track.target.partId === "$whole" || design.propTemplates[prop.templateId].parts.some(p => p.id === track.target.partId)), `${cue.id}: invalid target`);
      }
    }
    segmentCount += ids.length; pageCount += scene.pages.length;
  });
  assert(segmentCount === 72 && pageCount === 26 && groupCount === 49, "Expected 72 segments / 26 continuous pages / 49 groups");
  for (const motion of Object.values(design.motionPresets)) {
    assert(motion.iterations === 1 && motion.durationMs > 0 && motion.reducedMotion, "Motion must be finite and support reduced motion");
    assert(motion.keyframes.every(f => Object.keys(f).every(k => ["transform", "opacity", "offset", "easing"].includes(k))), "Motion changes layout/paint properties");
  }
  return { chapters: 16, pages: pageCount, segments: segmentCount, groups: groupCount };
}

export function validateAnnotations(annotations, content) {
  assert(annotations?.schemaVersion === 1, "Invalid annotation schema");
  assert(annotations.contentSHA256 === CONTENT_SHA, "Annotations use a different text edition");
  const entries = annotations.segments;
  assert(entries && typeof entries === "object" && !Array.isArray(entries), "Invalid annotation segments");
  const segments = content.chapters.flatMap(chapter => chapter.segments);
  assert(same(Object.keys(entries).sort(), segments.map(segment => segment.id).sort()), "Annotation segment coverage mismatch");
  for (const segment of segments) {
    const entry = entries[segment.id];
    assert(typeof entry?.meaning === "string" && entry.meaning.trim(), `${segment.id}: missing annotation meaning`);
    assert(Array.isArray(entry.terms), `${segment.id}: annotation terms must be an array`);
    for (const term of entry.terms) {
      assert(typeof term?.term === "string" && term.term.trim() && segment.text.includes(term.term), `${segment.id}: annotation term is not in the original segment`);
      assert(typeof term.explanation === "string" && term.explanation.trim(), `${segment.id}: missing term explanation`);
    }
  }
  return annotations;
}

export function validateTiming(timing, text) {
  const chars = Array.from(text);
  assert(timing.text === text && timing.t.length === chars.length, "Timing does not match the original text positions");
  assert(Number.isFinite(timing.dur) && timing.dur > 0, "Invalid audio duration");
  let last = -1;
  timing.t.forEach((time, i) => {
    if (time == null) { assert(!han(chars[i]), `Missing timing at character ${i}`); return; }
    assert(Number.isFinite(time) && time >= last && time >= 0 && time < timing.dur, `Invalid timing at character ${i}`);
    last = time;
  });
  const groups = timing.wordGroups === undefined ? [] : timing.wordGroups;
  assert(Array.isArray(groups), "Invalid word timing groups");
  const groupedIndexes = new Set();
  for (const group of groups) {
    assert(group?.granularity === "word" && Number.isInteger(group.boundaryIndex) && group.boundaryIndex >= 0 && typeof group.originalBoundaryText === "string" && group.originalBoundaryText.length > 0, "Invalid word boundary evidence");
    assert(group.sourceDurationSeconds === 0 && Number.isFinite(group.offsetSeconds) && group.offsetSeconds >= 0 && group.offsetSeconds < timing.dur, "Invalid word timing offset");
    assert(group.sdkPosition && typeof group.sdkPosition === "object" && !Array.isArray(group.sdkPosition), "Missing SDK word position");
    for (const key of ["textOffset", "wordLength"]) assert(group.sdkPosition[key] == null || Number.isInteger(group.sdkPosition[key]) && group.sdkPosition[key] >= 0, "Invalid SDK word position");
    assert(Array.isArray(group.sourceIndexes) && group.sourceIndexes.length > 0, "Missing word source positions");
    let previous = -1;
    for (const index of group.sourceIndexes) {
      assert(Number.isInteger(index) && index > previous && index < chars.length && han(chars[index]) && !groupedIndexes.has(index), "Invalid word source positions");
      assert(timing.t[index] === group.offsetSeconds, "Word positions must retain the real shared offset");
      groupedIndexes.add(index); previous = index;
    }
  }
  return timing;
}

function safeMediaPath(file) {
  assert(typeof file === "string" && /^assets\/audio\//.test(file) && !file.split("/").includes(".."), "Media path must stay under assets/audio");
  const full = path.join(ROOT, file);
  assert(fs.realpathSync(full).startsWith(fs.realpathSync(path.join(ROOT, "assets/audio")) + path.sep), "Media symlink leaves assets/audio");
  return full;
}
const decoded = new Map();
export function verifyClip(ref, segment, manifest, { role = "elephant", requireListening = true } = {}) {
  const full = safeMediaPath(ref.file), bytes = fs.readFileSync(full), sha256 = hash(bytes);
  assert(bytes.length > 100 && sha256 === ref.sha256, "Missing or changed audio bytes");
  const stored = JSON.parse(fs.readFileSync(safeMediaPath(ref.timingFile), "utf8"));
  let timing = ref.timingKey ? stored[ref.timingKey] : stored;
  if (ref.legacy) {
    assert(["e1", "e2", "e3", "u1", "u2", "u3", "b1", "c2", "d3", "title"].includes(ref.timingKey) && ref.file === `assets/audio/${ref.timingKey}.mp3` && ref.timingFile === "assets/audio/timings.json", "Unrecognized legacy media");
    // The existing final closing quote is silent; preserve it in text without inventing a word boundary.
    assert(timing.text === segment.text || timing.text + "”" === segment.text, "Legacy clip text mismatch");
    timing = { ...timing, text: segment.text, t: [...timing.t, ...Array(Array.from(segment.text).length - timing.t.length).fill(null)] };
  } else {
    assert(["batch-a", "batch-b"].includes(ref.batch) && ref.file.startsWith(`assets/audio/xue-er/${ref.batch}/`), "Unapproved media batch");
    const source = approvedSource(segment.id, role);
    assert(ref.batch === source.batch && ref.file === source.file && source.plainText === segment.text, "Media role/source/reuse mismatch");
    assert(ref.timingFile === ref.file.replace(/\.mp3$/, ".timing.json"), "Unexpected per-item timing path");
    assert(timing.audioSHA256 === sha256 && timing.contentSHA256 === CONTENT_SHA, "Timing provenance mismatch");
    assert(manifest.batches[ref.batch].entrySetSHA256 === BATCHES[ref.batch].entrySetSHA256 && timing.sourceEntrySetSHA256 === BATCHES[ref.batch].entrySetSHA256, "Unreviewed synthesis input");
  }
  validateTiming(timing, segment.text);
  if (!ref.legacy && requireListening) {
    assert(ref.listening?.audioSHA256 === sha256 && ref.listening?.reviewedBy && ref.listening?.evidence, "Human listening pending");
    assert(fs.existsSync(path.join(ROOT, ref.listening.evidence)), "Listening evidence missing");
  }
  if (!decoded.has(sha256)) {
    const result = spawnSync("ffmpeg", ["-v", "error", "-i", full, "-f", "null", "-"], { encoding: "utf8" });
    assert(result.status === 0, "Audio cannot be decoded");
    const probe = spawnSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "json", full], { encoding: "utf8" });
    assert(probe.status === 0, "Audio duration cannot be measured");
    decoded.set(sha256, Number(JSON.parse(probe.stdout).format.duration));
  }
  assert(Math.abs(decoded.get(sha256) - timing.dur) < .1, "Timing duration differs from actual audio");
  return { file: ref.file, sha256, timing };
}

export function assessReadiness(chapter, scene, media, { requireListening = true } = {}) {
  const blockers = [], clips = {};
  const titleRef = media.titles?.[chapter.id];
  if (!titleRef) blockers.push(`${chapter.id}:title:missing-media`);
  else try {
    const text = chapter.number === 1 ? readJSON("assets/audio/timings.json").title.text : approvedSource(`${chapter.id}-title`, "elephant").plainText;
    clips.title = verifyClip(titleRef, { id: `${chapter.id}-title`, text }, media, { requireListening });
  } catch (error) { blockers.push(`${chapter.id}:title:${error.message}`); }
  for (const page of scene.pages) for (const group of page.readingGroups) for (const segmentId of group.segmentIds) {
    const segment = chapter.segments.find(s => s.id === segmentId);
    const required = chapter.number === 1 ? ["elephant", "children", group.audio.soloRole] : ["elephant", "children", "bunny", "cat", "dog"];
    for (const role of new Set(required)) {
      const key = `${segmentId}:${role}`;
      if (key in clips || blockers.some(b => b.startsWith(key + ":"))) continue;
      const ref = media.segments[segmentId]?.[role];
      if (!ref) { blockers.push(key + ":missing-media"); continue; }
      try { clips[key] = verifyClip(ref, segment, media, { role, requireListening }); }
      catch (error) { blockers.push(key + ":" + error.message); }
    }
  }
  return { ready: blockers.length === 0, blockers, clips };
}

export function verifyReleaseAuthorization(bytes, current, fileHash = file => hash(fs.readFileSync(safeMediaPath(file)))) {
  if (bytes == null) return null;
  assert(hash(bytes) === RELEASE_SHA, "Release authorization fingerprint mismatch");
  const release = JSON.parse(bytes);
  assert(release.schemaVersion === 1 && release.allowPublicationWithoutListening === true && release.humanListeningApproved === false, "Invalid direct release authorization");
  assert(release.content.file === "docs/content/xue-er.json" && release.content.sha256 === current.contentSHA256, "Release content mismatch");
  assert(release.mediaManifest.file === "src/chapter-media.json" && release.mediaManifest.sha256 === current.mediaManifestSHA256, "Release media manifest mismatch");
  assert(same(release.chapters, current.chapterIds), "Release chapter scope mismatch");
  for (const [file, digest] of Object.entries({ ...release.audioFiles, ...release.timingFiles })) {
    assert(fileHash(file) === digest, `Release media bytes changed: ${file}`);
  }
  return { file: RELEASE_FILE, sha256: RELEASE_SHA, id: release.id, chapters: release.chapters, humanListeningApproved: false };
}

export function loadBook() {
  const bytes = fs.readFileSync(path.join(ROOT, "docs/content/xue-er.json"));
  assert(hash(bytes) === CONTENT_SHA, "Frozen content fingerprint changed; review before integrating");
  const mediaBytes = fs.readFileSync(path.join(ROOT, "src/chapter-media.json"));
  const content = JSON.parse(bytes), design = readJSON("docs/design/xue-er-scene-config.json"), media = JSON.parse(mediaBytes);
  assert(hash(fs.readFileSync(path.join(ROOT, "docs/design/xue-er-scene-config.json"))) === SCENE_SHA, "Scene configuration fingerprint changed");
  assert(hash(fs.readFileSync(path.join(ROOT, media.contentValidation.file))) === media.contentValidation.sha256, "Content validation record changed");
  const validation = readJSON(media.contentValidation.file);
  assert(validation.status === "passed" && validation.sha256 === CONTENT_SHA && validation.pinyinAlignedIncludingPunctuation, "Content/pinyin validation is not complete");
  const counts = validateBook(content, design);
  const annotations = validateAnnotations(readJSON(ANNOTATIONS_FILE), content);
  assert(media.contentSHA256 === CONTENT_SHA, "Media manifest uses a different edition");
  const authorizationPath = path.join(ROOT, RELEASE_FILE);
  const releaseAuthorization = verifyReleaseAuthorization(fs.existsSync(authorizationPath) ? fs.readFileSync(authorizationPath) : null, {
    contentSHA256: hash(bytes), mediaManifestSHA256: hash(mediaBytes), chapterIds: content.chapters.map(chapter => chapter.id),
  });
  // Only this exact user-authorized edition bypasses listening; every technical check still runs.
  const chapters = content.chapters.map((chapter, i) => ({ ...chapter,
    segments: chapter.segments.map(segment => ({ ...segment, annotation: annotations.segments[segment.id] })),
    scene: design.chapters[i], readiness: assessReadiness(chapter, design.chapters[i], media, { requireListening: releaseAuthorization === null }),
  }));
  return { content, design, media, annotations, counts, chapters, releaseAuthorization };
}

export function playerData(chapter, design, { preview = false, rehearsal = false } = {}) {
  const scene = chapter.scene;
  const colors = ["#f08a5d", "#5fb3a1", "#7a8fd6"];
  return {
    id: chapter.id, number: chapter.number, title: chapter.title, preview, rehearsal,
    titleReadingText: chapter.number === 1 ? readJSON("assets/audio/timings.json").title.text : approvedSource(`${chapter.id}-title`, "elephant").plainText,
    playable: !preview && (rehearsal ? chapter.technicalReadiness?.ready === true : chapter.readiness.ready),
    publicationReady: chapter.readiness.ready, contentSHA256: CONTENT_SHA,
    scene: { ...scene, pages: undefined },
    profiles: design.viewportProfiles, layouts: design.layoutPresets[scene.layoutPresetId] || null,
    templates: Object.fromEntries(scene.props.map(p => [p.templateId, design.propTemplates[p.templateId]])),
    motions: design.motionPresets,
    pages: scene.pages.map(page => ({ ...page, groups: page.readingGroups.map((group, i) => {
      const segments = group.segmentIds.map(id => chapter.segments.find(s => s.id === id));
      return { ...group, text: segments.map(s => s.text).join(""), py: segments.flatMap(s => s.pinyin), color: colors[i % 3], segments: segments.map(s => ({ id: s.id, text: s.text, py: s.pinyin, start: s.start, end: s.end, annotation: s.annotation })) };
    }) })),
  };
}
