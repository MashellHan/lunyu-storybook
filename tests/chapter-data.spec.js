import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { loadBook, validateBook, validateAnnotations, playerData, readJSON, ANNOTATIONS_FILE, validateTiming, assessReadiness, verifyClip, verifyReleaseAuthorization, RELEASE_FILE, RELEASE_SHA, ROOT, CONTENT_SHA, SCENE_SHA, hash, BATCHES, approvedRequests, approvedSource } from "../scripts/chapter-data.mjs";
import { checkCandidate, importCandidates } from "../scripts/import-chapter-media.mjs";

test.describe.configure({ mode: "serial", timeout: 180_000 });

test("annotations cover all seventy-two segments including attributions and remain bound to the frozen text", () => {
  const content = readJSON("docs/content/xue-er.json"), design = readJSON("docs/design/xue-er-scene-config.json");
  const annotations = readJSON(ANNOTATIONS_FILE), segments = content.chapters.flatMap(chapter => chapter.segments);
  expect(validateAnnotations(annotations, content)).toBe(annotations);
  expect(Object.keys(annotations.segments)).toHaveLength(72);
  expect(segments.filter(segment => segment.kind === "attribution")).toHaveLength(20);
  expect(() => validateAnnotations({ ...annotations, schemaVersion: 2 }, content)).toThrow(/schema/);
  expect(() => validateAnnotations({ ...annotations, contentSHA256: "0".repeat(64) }, content)).toThrow(/edition/);
  const id = segments[0].id;
  for (const change of [
    value => { delete value.segments[id]; },
    value => { value.segments["xue-er-99-s01"] = value.segments[id]; },
  ]) {
    const invalid = structuredClone(annotations); change(invalid);
    expect(() => validateAnnotations(invalid, content)).toThrow(/coverage/);
  }
  for (const entry of [
    { meaning: " \n", terms: [] }, { meaning: "测试释义", terms: null },
    { meaning: "测试释义", terms: [{ term: "并非此段原文", explanation: "测试词注" }] },
    { meaning: "测试释义", terms: [{ term: segments[0].text[0], explanation: " " }] },
  ]) {
    const invalid = structuredClone(annotations); invalid.segments[id] = entry;
    expect(() => validateAnnotations(invalid, content)).toThrow(/annotation|explanation/);
  }
  content.chapters.forEach((chapter, i) => {
    const annotated = { ...chapter, scene: design.chapters[i], readiness: { ready: false }, segments: chapter.segments.map(segment => ({ ...segment, annotation: annotations.segments[segment.id] })) };
    const data = playerData(annotated, design, { preview: true });
    const mapped = data.pages.flatMap(page => page.groups.flatMap(group => group.segments));
    expect(mapped.map(segment => segment.id)).toEqual(chapter.segments.map(segment => segment.id));
    expect(mapped.map(segment => segment.annotation)).toEqual(chapter.segments.map(segment => annotations.segments[segment.id]));
  });
});

test("only the exact direct-release record can cover the current chapters, manifest and every audio/timing byte", () => {
  const bytes = fs.readFileSync(path.join(ROOT, RELEASE_FILE)), release = JSON.parse(bytes);
  const current = {
    contentSHA256: hash(fs.readFileSync(path.join(ROOT, "docs/content/xue-er.json"))),
    mediaManifestSHA256: hash(fs.readFileSync(path.join(ROOT, "src/chapter-media.json"))),
    chapterIds: Array.from({ length: 16 }, (_, i) => `xue-er-${String(i + 1).padStart(2, "0")}`),
  };
  expect(verifyReleaseAuthorization(bytes, current)).toEqual({ file: RELEASE_FILE, sha256: RELEASE_SHA, id: "xue-er-16-direct-release-2026-11-03", chapters: current.chapterIds, humanListeningApproved: false });
  expect(verifyReleaseAuthorization(null, current)).toBeNull();
  expect(() => verifyReleaseAuthorization(Buffer.concat([bytes, Buffer.from("\n")]), current)).toThrow(/fingerprint mismatch/);
  expect(() => verifyReleaseAuthorization(Buffer.from(JSON.stringify({ ...release, humanListeningApproved: true })), current)).toThrow(/fingerprint mismatch/);
  expect(() => verifyReleaseAuthorization(bytes, { ...current, contentSHA256: "0".repeat(64) })).toThrow(/content mismatch/);
  expect(() => verifyReleaseAuthorization(bytes, { ...current, mediaManifestSHA256: "0".repeat(64) })).toThrow(/manifest mismatch/);
  for (const chapterIds of [current.chapterIds.slice(1), [...current.chapterIds].reverse(), [...current.chapterIds, "xue-er-17"]]) {
    expect(() => verifyReleaseAuthorization(bytes, { ...current, chapterIds })).toThrow(/chapter scope mismatch/);
  }
  const files = { ...release.audioFiles, ...release.timingFiles };
  expect(Object.keys(release.audioFiles)).toHaveLength(305); expect(Object.keys(release.timingFiles)).toHaveLength(291);
  for (const changed of ["assets/audio/xue-er/batch-b/xue-er-15-s11-dog.mp3", "assets/audio/xue-er/batch-b/xue-er-15-s11-dog.timing.json", "assets/audio/again.mp3", "assets/audio/timings.json"]) {
    expect(() => verifyReleaseAuthorization(bytes, current, file => file === changed ? "0".repeat(64) : files[file])).toThrow(/Release media bytes changed/);
  }
});

test("the frozen edition maps exactly to sixteen chapters, twenty-six pages and forty-nine reading groups", () => {
  const book = loadBook();
  expect(book.counts).toEqual({ chapters: 16, pages: 26, segments: 72, groups: 49 });
  expect(hash(fs.readFileSync(path.join(ROOT, "docs/content/xue-er.json")))).toBe(CONTENT_SHA);
  expect(hash(fs.readFileSync(path.join(ROOT, "docs/design/xue-er-scene-config.json")))).toBe(SCENE_SHA);
  expect(Object.values(BATCHES).reduce((sum, b) => sum + b.requests, 0)).toBe(235);
  expect(book.chapters.flatMap(c => c.readiness.blockers).some(b => /human-text-review/.test(b))).toBe(false);
  expect(book.releaseAuthorization.sha256).toBe(RELEASE_SHA);
  expect(book.releaseAuthorization.humanListeningApproved).toBe(false);
  expect(book.chapters.every(chapter => chapter.readiness.ready && !chapter.readiness.blockers.length)).toBe(true);
  expect(book.chapters.flatMap(chapter => chapter.segments).every(segment => segment.annotation === book.annotations.segments[segment.id])).toBe(true);
});

test("the exact 235-request whitelist includes fifteen new titles and keeps prefix reuse position-specific", () => {
  const requests = approvedRequests();
  const titles = requests.flatMap(r => r.entries).filter(e => e.segment === null);
  expect(titles).toHaveLength(15);
  expect(titles.map(t => t.chapter)).toEqual(Array.from({ length: 15 }, (_, i) => i + 2));
  const source = approvedSource("xue-er-15-s09", "dog");
  expect(source.batch).toBe("batch-a"); expect(source.segment).toBe("xue-er-01-s01");
  expect(approvedSource("xue-er-15-s06", "children").file).toBe("assets/audio/xue-er/batch-b/xue-er-10-s04-children.mp3");
  const book = loadBook();
  const withoutTitle = structuredClone(book.media); delete withoutTitle.titles["xue-er-02"];
  expect(assessReadiness(book.chapters[1], book.chapters[1].scene, withoutTitle).blockers).toContain("xue-er-02:title:missing-media");
});

test("candidate import is read-only by default and rejects wrong voices, paths and invented listening approval", () => {
  test.setTimeout(180_000);
  const before = fs.readFileSync(path.join(ROOT, "src/chapter-media.json"));
  expect(importCandidates(["batch-a", "batch-b"]).write).toBe(false);
  expect(fs.readFileSync(path.join(ROOT, "src/chapter-media.json")).equals(before)).toBe(true);
  const source = approvedSource("xue-er-02-title", "elephant");
  const ref = { file: source.file, timingFile: source.file.replace(/\.mp3$/, ".timing.json"), sha256: "a".repeat(64), batch: "batch-a" };
  const candidate = { schemaVersion: 1, contentSHA256: CONTENT_SHA, publicationReady: false, batches: { "batch-a": { request: BATCHES["batch-a"].request, entrySetSHA256: BATCHES["batch-a"].entrySetSHA256 } }, segments: {}, titles: { "xue-er-02": ref } };
  expect(checkCandidate(candidate)).toHaveLength(1);
  expect(() => checkCandidate({ ...candidate, titles: { "xue-er-02": { ...ref, listening: { reviewedBy: "automatic" } } } })).toThrow(/approval/);
  expect(() => checkCandidate({ ...candidate, titles: { "xue-er-02": { ...ref, file: "assets/audio/title.mp3" } } })).toThrow(/path/);
  expect(() => checkCandidate({ ...candidate, titles: { "xue-er-01": ref } })).toThrow(/Only approved/);
  expect(() => checkCandidate({ ...candidate, segments: { "xue-er-02-s01": { dog: { ...ref } } }, titles: {} })).toThrow(/path/);
});

test("missing, repeated, reordered or separated attribution segments and pinyin gaps fail validation", () => {
  const book = loadBook();
  const duplicated = structuredClone(book.design);
  duplicated.chapters[14].pages[1].segmentIds.push(duplicated.chapters[14].pages[0].segmentIds[0]);
  expect(() => validateBook(book.content, duplicated)).toThrow(/coverage/);
  const separated = structuredClone(book.design);
  const groups = separated.chapters[2].pages[0].readingGroups;
  groups.splice(0, 1, { ...groups[0], segmentIds: ["xue-er-03-s01"] }, { ...groups[0], id: "separated", segmentIds: ["xue-er-03-s02"] });
  expect(() => validateBook(book.content, separated)).toThrow(/attribution separated/);
  const pinyin = structuredClone(book.content); pinyin.chapters[0].segments[0].pinyin[0] = "";
  expect(() => validateBook(pinyin, book.design)).toThrow(/pinyin/);
});

test("readiness refuses absent media and timing cannot invent, reorder or drop original character positions", () => {
  const book = loadBook();
  const withoutPrefix = structuredClone(book.media); delete withoutPrefix.segments["xue-er-01-s01"];
  const full = assessReadiness(book.chapters[0], book.chapters[0].scene, withoutPrefix);
  expect(full.ready).toBe(false);
  expect(full.blockers).toHaveLength(3);
  expect(full.blockers.every(b => b.startsWith("xue-er-01-s01:"))).toBe(true);
  const final = full.clips["xue-er-01-s04:elephant"].timing;
  expect(final.text.endsWith("？”")).toBe(true);
  expect(final.t.at(-1)).toBe(null);
  expect(() => validateTiming({ ...final, t: final.t.map((t, i) => i === 5 ? null : t) }, final.text)).toThrow(/Missing timing/);
  expect(() => validateTiming({ ...final, text: final.text.replace("愠", "运") }, final.text)).toThrow(/original text/);
  expect(() => validateTiming({ ...final, t: final.t.map((t, i) => i === 5 ? 100 : t) }, final.text)).toThrow(/Invalid timing/);
  expect(() => validateTiming({ ...final, t: final.t.map((t, i) => i === 5 ? 0 : t) }, final.text)).toThrow(/Invalid timing/);
});

test("generated media still requires actual listening evidence for every required new voice", () => {
  const book = loadBook(), unheard = structuredClone(book.media);
  expect(unheard.segments["xue-er-01-s01"].elephant.legacy).not.toBe(true);
  for (const roles of Object.values(unheard.segments)) for (const ref of Object.values(roles)) if (!ref.legacy) delete ref.listening;
  for (const ref of Object.values(unheard.titles)) if (!ref.legacy) delete ref.listening;
  const first = assessReadiness(book.chapters[0], book.chapters[0].scene, unheard);
  expect(first.ready).toBe(false);
  expect(first.blockers.sort()).toEqual(["bunny", "children", "elephant"].map(role => `xue-er-01-s01:${role}:Human listening pending`).sort());
  expect(assessReadiness(book.chapters[1], book.chapters[1].scene, unheard).blockers).toContain("xue-er-02:title:Human listening pending");
  const title = approvedSource("xue-er-02-title", "elephant");
  expect(() => verifyClip(unheard.titles["xue-er-02"], { id: "xue-er-02-title", text: title.plainText }, unheard)).toThrow(/Human listening pending/);
});

test("optional zero-duration word evidence keeps exact shared anchors and rejects missing or invalid source positions", () => {
  const timing = { text: "学而时习之", dur: 1.2, t: [.1, .1, .4, .6, .8], wordGroups: [{ granularity: "word", boundaryIndex: 0, originalBoundaryText: "学而", sourceIndexes: [0, 1], offsetSeconds: .1, sourceDurationSeconds: 0, sdkPosition: { textOffset: 10, wordLength: 2 } }] };
  expect(validateTiming(timing, timing.text)).toBe(timing);
  expect(validateTiming({ ...timing, wordGroups: undefined }, timing.text).wordGroups).toBeUndefined();
  expect(() => validateTiming({ ...timing, t: [.1, .2, .4, .6, .8] }, timing.text)).toThrow(/shared offset/);
  expect(() => validateTiming({ ...timing, t: [.1, null, .4, .6, .8] }, timing.text)).toThrow(/Missing timing/);
  for (const change of [{ sourceIndexes: [0, 0] }, { sourceIndexes: [-1, 0] }, { sourceIndexes: [0, 5] }, { offsetSeconds: -.1 }, { sourceDurationSeconds: .2 }]) {
    expect(() => validateTiming({ ...timing, wordGroups: [{ ...timing.wordGroups[0], ...change }] }, timing.text)).toThrow();
  }
});
