import fs from "node:fs";
import path from "node:path";
import { ROOT, playerData } from "../scripts/chapter-data.mjs";

// Test-only adapter harness: the three real v5 sentences, divided into pages.
// This is not a new chapter recording and is never written to public/ or dist/.
export function writeRuntimeFixture(book) {
  const first = book.chapters[0];
  const data = playerData(first, book.design, { preview: true });
  const short = playerData(book.chapters[2], book.design, { preview: true });
  Object.assign(data, { id: "legacy-runtime-fixture", playable: true, publicationReady: false, testOnly: true, scene: short.scene, layouts: short.layouts, templates: short.templates });
  data.pages = data.pages[0].groups.map((group, i) => {
    const segments = group.segments.filter(segment => segment.id !== "xue-er-01-s01");
    const selected = { ...group, segments, segmentIds: segments.map(s => s.id), text: segments.map(s => s.text).join(""), py: segments.flatMap(s => s.py), onReadCompleteCueId: "fan-fold" };
    return { pageId: `legacy-test-page-${i + 1}`, groups: [selected], defaultReadingGroupId: group.id, visiblePropIds: ["screen", "fan"], propOverrides: {}, propBindings: [{ propId: "fan", readingGroupId: group.id }], primaryResponder: group.responder };
  });
  const audio = {}, timings = {};
  const legacyTimings = JSON.parse(fs.readFileSync(path.join(ROOT, "assets/audio/timings.json"), "utf8"));
  for (const key of ["title", "again", "squeak", "meow", "woof", "trumpet"]) {
    audio[key] = "data:audio/mpeg;base64," + fs.readFileSync(path.join(ROOT, "assets/audio", `${key}.mp3`)).toString("base64");
    timings[key] = legacyTimings[key];
  }
  for (const [key, clip] of Object.entries(first.readiness.clips)) {
    if (key.startsWith("xue-er-01-s01:")) continue;
    audio[key] = "data:audio/mpeg;base64," + fs.readFileSync(path.join(ROOT, clip.file)).toString("base64");
    timings[key] = clip.timing;
  }
  const fixture = path.join(ROOT, "build/xue-er-preview/runtime-fixture.html");
  let html = fs.readFileSync(path.join(ROOT, "build/xue-er-preview/index-single.html"), "utf8");
  for (const [name, value] of Object.entries({ AUD: audio, TIM: timings, CHAPTER: data })) {
    html = html.replace(new RegExp(`const ${name} = [^\\n]+;`), () => `const ${name} = ${JSON.stringify(value).replaceAll("<", "\\u003c")};`);
  }
  fs.writeFileSync(fixture, html);
  return fixture;
}
