#!/usr/bin/env node
// Read-only by default. Import real, isolated batch candidates without granting listening approval.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ROOT, CONTENT_SHA, BATCHES, readJSON, approvedSource, verifyClip } from "./chapter-data.mjs";

const assert = (ok, message) => { if (!ok) throw new Error(message); };
export function checkCandidate(candidate) {
  assert(candidate.schemaVersion === 1 && candidate.publicationReady === false && candidate.contentSHA256 === CONTENT_SHA, "Candidate edition/status mismatch");
  for (const [batch, declaration] of Object.entries(candidate.batches)) {
    assert(BATCHES[batch] && declaration.request === BATCHES[batch].request && declaration.entrySetSHA256 === BATCHES[batch].entrySetSHA256, "Unapproved candidate batch");
  }
  const content = readJSON("docs/content/xue-er.json");
  const segments = new Map(content.chapters.flatMap(c => c.segments.map(s => [s.id, s])));
  const refs = [];
  function add(section, id, role, ref, segment) {
    assert(segment && ["elephant", "bunny", "cat", "dog", "children"].includes(role), "Unknown candidate segment/role");
    assert(!ref.legacy && !ref.listening, "A generated candidate cannot grant legacy/listening approval");
    const source = approvedSource(segment.id, role);
    assert(ref.batch === source.batch && candidate.batches[ref.batch] && ref.file === source.file && ref.timingFile === ref.file.replace(/\.mp3$/, ".timing.json"), "Candidate source/path mismatch");
    assert(source.plainText === segment.text && /^[a-f0-9]{64}$/.test(ref.sha256), "Candidate text/hash mismatch");
    refs.push({ section, id, role, ref, segment });
  }
  for (const [id, roles] of Object.entries(candidate.segments)) for (const [role, ref] of Object.entries(roles)) add("segments", id, role, ref, segments.get(id));
  for (const [id, ref] of Object.entries(candidate.titles)) {
    assert(content.chapters.some(c => c.id === id && c.number >= 2), "Only approved new titles 2–16 can be imported");
    const source = approvedSource(`${id}-title`, "elephant");
    add("titles", id, "elephant", ref, { id: `${id}-title`, text: source.plainText });
  }
  return refs;
}

export function importCandidates(batchIds, { write = false } = {}) {
  assert(batchIds.length && new Set(batchIds).size === batchIds.length && batchIds.every(id => BATCHES[id]), "Select distinct batch-a/batch-b candidates");
  const manifest = readJSON("src/chapter-media.json");
  const missingCandidates = [], imported = [];
  for (const batch of batchIds) {
    const file = path.join(ROOT, `assets/audio/xue-er/${batch}/media-candidate.json`);
    if (!fs.existsSync(file)) { missingCandidates.push(batch); continue; }
    const candidate = JSON.parse(fs.readFileSync(file, "utf8"));
    for (const item of checkCandidate(candidate)) {
      verifyClip(item.ref, item.segment, manifest, { role: item.role, requireListening: false });
      const current = item.section === "titles" ? manifest.titles[item.id] : manifest.segments[item.id]?.[item.role];
      if (current) {
        assert(current.file === item.ref.file && current.sha256 === item.ref.sha256 && current.timingFile === item.ref.timingFile, `Would replace accepted media: ${item.id}:${item.role}`);
        continue;
      }
      if (item.section === "titles") manifest.titles[item.id] = item.ref;
      else { manifest.segments[item.id] ||= {}; manifest.segments[item.id][item.role] = item.ref; }
      imported.push(`${item.id}:${item.role}`);
    }
  }
  if (write) {
    assert(!missingCandidates.length, "Requested media candidates are not present");
    const target = path.join(ROOT, "src/chapter-media.json");
    fs.writeFileSync(target + ".tmp", JSON.stringify(manifest, null, 2) + "\n");
    fs.renameSync(target + ".tmp", target);
  }
  return { write, imported, missingCandidates, publicationReady: false, listeningApprovalAdded: false };
}

if (fileURLToPath(import.meta.url) === path.resolve(process.argv[1] || "")) {
  const args = process.argv.slice(2), write = args.includes("--write");
  const batches = args.filter(arg => arg !== "--write");
  try { console.log(JSON.stringify(importCandidates(batches.length ? batches : ["batch-a", "batch-b"], { write }), null, 2)); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
