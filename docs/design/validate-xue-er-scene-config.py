"""Validate the design handoff only; no build, browser, media or production writes."""
import hashlib
import json
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
CONFIG_PATH = Path(__file__).with_name("xue-er-scene-config.json")
REPORT_PATH = Path(__file__).with_name("xue-er-scene-config.validation.json")
EXPECTED_PAGES = [1, 2, 1, 2, 1, 2, 3, 1, 1, 2, 1, 2, 1, 1, 4, 1]
ROLES = {"elephant", "bunny", "cat", "dog"}


def sha(data):
    return hashlib.sha256(data).hexdigest()


def require(condition, message):
    if not condition:
        raise ValueError(message)


def bounds(box, width):
    w, h = box["widthPx"], box["heightPx"]
    return (width * box["cx"] + box["dxPx"] - w / 2, box["topPx"], w, h)


def separated(a, b, gap=8):
    ax, ay, aw, ah = a
    bx, by, bw, bh = b
    return ax + aw + gap <= bx or bx + bw + gap <= ax or ay + ah + gap <= by or by + bh + gap <= ay


def inside(box, width, height):
    x, y, w, h = box
    return x >= 0 and y >= 0 and w > 0 and h > 0 and x + w <= width and y + h <= height


def main():
    config_bytes = CONFIG_PATH.read_bytes()
    config = json.loads(config_bytes)
    source_path = REPO / config["content"]["path"]
    source_bytes = source_path.read_bytes()
    source = json.loads(source_bytes)
    require(sha(source_bytes) == config["content"]["sha256"], "Content fingerprint changed; reread the source before updating the handoff.")
    require(config["schemaVersion"] == 1, "Unsupported schema.")
    require([c["chapterId"] for c in config["chapters"]] == [c["id"] for c in source["chapters"]], "Chapter IDs or order differ.")
    require(len(source["chapters"]) == 16, "Expected 16 chapters.")
    require([len(c["pages"]) for c in config["chapters"]] == EXPECTED_PAGES, "The agreed 26-page plan changed.")
    require(len({c["sceneId"] for c in config["chapters"]}) == 16, "Scene IDs must be unique.")
    require(set(config["characterAssets"]) == ROLES, "Unexpected character.")
    for asset in config["characterAssets"].values():
        for path in asset["layers"]:
            require(path.startswith("assets/img/") and (REPO / path).is_file(), f"Missing existing layer: {path}")
    require(sum(len(a["layers"]) for a in config["characterAssets"].values()) == 7, "Expected only seven existing layers.")
    for template in config["propTemplates"].values():
        require(template.get("preserveAspectRatio", "xMidYMid meet") in {"xMidYMid meet", "none"}, "Unexpected static SVG fit mode.")
        ids = [p["id"] for p in template["parts"]]
        require(len(ids) == len(set(ids)), "Duplicate SVG part ID.")
        require(all(p["tag"] in {"rect", "circle", "ellipse", "line", "path", "polygon"} for p in template["parts"]), "A prop contains text, image, script or a non-geometry node.")
        require(all(set(s) <= {"transform", "opacity"} for s in template["baseStyles"].values()), "Unexpected base style.")
    for mid, motion in config["motionPresets"].items():
        require(0 < motion["durationMs"] <= 650 and motion["iterations"] == 1, f"Loop or unbounded motion: {mid}")
        require(motion["reducedMotion"]["mode"] == "apply-final-opacity-only", f"Missing reduced-motion branch: {mid}")
        require(motion["keyframes"][0]["offset"] == 0 and motion["keyframes"][-1]["offset"] == 1, f"Incomplete keyframes: {mid}")
        require(all(set(k) <= {"offset", "transform", "opacity"} for k in motion["keyframes"]), f"Forbidden animated property: {mid}")

    all_segments, all_pages, all_groups = [], [], []
    chapter_results, geometry_results = [], []
    attribution_count = 0
    source_segments = {s["id"]: s for c in source["chapters"] for s in c["segments"]}
    for cfg, src, expected_pages in zip(config["chapters"], source["chapters"], EXPECTED_PAGES):
        cid = src["id"]
        original_ids = [s["id"] for s in src["segments"]]
        require(len(original_ids) == len(set(original_ids)), f"Duplicate content ID: {cid}")
        require("".join(s["text"] for s in src["segments"]) == src["fullText"], f"Source segment text does not match fullText: {cid}")
        cursor = 0
        for seg in src["segments"]:
            require(seg["start"] == cursor and seg["end"] == cursor + len(seg["text"]), f"Noncontinuous source range: {seg['id']}")
            require(len(seg["pinyin"]) == len(seg["text"]), f"Pinyin alignment changed: {seg['id']}")
            cursor = seg["end"]
        props = {p["id"]: p for p in cfg["props"]}
        cues = {c["id"]: c for c in cfg["cues"]}
        require(len(props) == len(cfg["props"]) and len(cues) == len(cfg["cues"]), f"Duplicate prop/cue ID: {cid}")
        for prop in props.values():
            require(prop["templateId"] in config["propTemplates"], f"Unknown template: {prop['id']}")
            require(config["propTemplates"][prop["templateId"]].get("preserveAspectRatio") != "none" or prop["layer"] == "background", "Stretch-to-frame is limited to static backgrounds.")
        for cue in cues.values():
            require(cue["steps"], f"Empty cue: {cue['id']}")
            for step in cue["steps"]:
                focal_objects = set()
                require(step["tracks"], f"Empty cue step: {cue['id']}")
                for track in step["tracks"]:
                    require(track["motionId"] in config["motionPresets"], f"Unknown motion: {track['motionId']}")
                    target = track["target"]
                    if "characterId" in target:
                        require(target["characterId"] in ROLES and target["layer"] == "act", "Invalid character motion target.")
                        focal_objects.add(("character", target["characterId"]))
                    else:
                        require(target["propId"] in props, f"Unknown prop target: {target}")
                        part_ids = {p["id"] for p in config["propTemplates"][props[target["propId"]]["templateId"]]["parts"]}
                        require(target["partId"] == "$whole" or target["partId"] in part_ids, f"Unknown prop part: {target}")
                        focal_objects.add(("prop", target["propId"]))
                require(len(focal_objects) == 1, f"Competing focal objects in {cid}/{cue['id']}")

        flattened, page_texts, ranges = [], [], []
        for page in cfg["pages"]:
            pid = page["pageId"]
            ids = page["segmentIds"]
            require(ids and all(s in original_ids for s in ids), f"Foreign/empty page: {pid}")
            require(page["primaryResponder"] in ROLES, f"Invalid responder: {pid}")
            groups = {g["id"]: g for g in page["readingGroups"]}
            require(len(groups) == len(page["readingGroups"]), f"Duplicate group: {pid}")
            require([s for g in page["readingGroups"] for s in g["segmentIds"]] == ids, f"Reading groups omit/reorder/duplicate text: {pid}")
            require(page["defaultReadingGroupId"] in groups, f"Unknown default group: {pid}")
            require(set(page["visiblePropIds"]) <= set(props), f"Unknown visible prop: {pid}")
            page_range = [source_segments[ids[0]]["start"], source_segments[ids[-1]]["end"]]
            require(page["sourceRange"] == page_range, f"Incorrect source range: {pid}")
            page_text = "".join(source_segments[s]["text"] for s in ids)
            require(page_text == src["fullText"][page_range[0]:page_range[1]], f"Page is not a continuous source slice: {pid}")
            for group in groups.values():
                require(group["responder"] in ROLES, f"Invalid group responder: {group['id']}")
                require(group["audio"] == {"leadRole":"elephant", "followEnsemble":"children", "soloRole":group["responder"]}, f"Audio role/source contract differs: {group['id']}")
                cue_id = group["onReadCompleteCueId"]
                require(cue_id is None or cue_id in cues, f"Unknown cue: {group['id']}")
                if cue_id:
                    for step in cues[cue_id]["steps"]:
                        for track in step["tracks"]:
                            prop_id = track["target"].get("propId")
                            require(prop_id is None or prop_id in page["visiblePropIds"], f"Cue animates a hidden prop: {group['id']}")
                for sid in group["segmentIds"]:
                    if source_segments[sid]["kind"] == "attribution":
                        i = original_ids.index(sid)
                        require(i + 1 < len(original_ids), f"Trailing attribution: {sid}")
                        next_id = original_ids[i + 1]
                        require(source_segments[next_id]["kind"] == "speech" and next_id in group["segmentIds"], f"Attribution orphaned from following speech: {sid}")
                        attribution_count += 1
                all_groups.append(group["id"])
            for binding in page["propBindings"]:
                require(binding["propId"] in page["visiblePropIds"], f"Invisible interactive prop: {pid}")
                require(binding["hitTarget"]["minWidthPx"] >= 48 and binding["hitTarget"]["minHeightPx"] >= 48, f"Small target: {pid}")
                refs = [binding["readingGroupId"]] if "readingGroupId" in binding else binding["readingGroupSelection"]["allowedReadingGroupIds"]
                require(refs and all(g in groups for g in refs), f"Prop reads a different page: {pid}")
                if "readingGroupSelection" in binding:
                    require(binding["readingGroupSelection"]["fallbackReadingGroupId"] in refs, f"Invalid selected-group fallback: {pid}")
            flattened.extend(ids)
            page_texts.append(page_text)
            ranges.append({"pageId":pid,"range":page_range,"readingGroupCount":len(groups)})
            all_pages.append(pid)
        require(flattened == original_ids, f"Page flattening differs from source ID sequence: {cid}")
        require("".join(page_texts) == src["fullText"], f"Page concatenation differs from fullText: {cid}")
        all_segments.extend(flattened)
        chapter_results.append({"chapterId":cid,"pages":expected_pages,"segments":len(original_ids),"pageTextEqualsFullText":True,"exactSegmentOrder":True,"pageRanges":ranges})

        if cfg["layoutPresetId"] == "legacy-demo":
            require(src["number"] == 1, "Legacy layout used for a new scene.")
            continue
        require(set(cfg["characterSlots"]) == ROLES, f"Incomplete cast: {cid}")
        preset = config["layoutPresets"][cfg["layoutPresetId"]]
        for viewport in [320, 360, 389, 390, 599, 600, 768, 1023, 1024, 1440]:
            name, profile = next((name, p) for name, p in config["viewportProfiles"].items() if viewport >= p["minViewportWidthPx"] and (p["maxViewportWidthPx"] is None or viewport <= p["maxViewportWidthPx"]))
            width = min(viewport - 2 * profile["pageInsetPx"], profile["sceneMaxWidthPx"])
            height = profile["sceneHeightPx"]
            layout = preset[name]
            role_boxes = {r:bounds(layout["slots"][slot], width) for r, slot in cfg["characterSlots"].items()}
            require(len(set(cfg["characterSlots"].values())) == 4, f"Two characters occupy one slot: {cid}")
            for role, box in role_boxes.items():
                require(inside(box, width, height) and min(box[2:]) >= 80, f"Actor outside scene/small at {viewport}: {cid}/{role}")
            role_items = list(role_boxes.items())
            for i, (role, box) in enumerate(role_items):
                for other, other_box in role_items[i+1:]:
                    require(separated(box, other_box), f"Actor hotzones overlap at {viewport}: {cid}/{role}/{other}")
            dock = bounds(layout["propDock"], width)
            for page in cfg["pages"]:
                targets = []
                for binding in page["propBindings"]:
                    prop = props[binding["propId"]]
                    placement = prop["placement"]
                    if placement["anchor"] == "scene":
                        box = bounds(placement["frames"][name], width)
                        w, h = box[2:]
                    else:
                        require(placement["anchor"] == "propDock", "Interactive prop must use a measured scene frame or dock.")
                        w = placement["widthPx"] or dock[2]
                        h = placement["heightPx"] or dock[3]
                        box = (dock[0]+dock[2]/2+placement["dxPx"]-w/2, dock[1]+dock[3]/2+placement["dyPx"]-h/2, w, h)
                    require(w >= 48 and h >= 48 and inside(box,width,height), f"Prop outside scene/small at {viewport}: {page['pageId']}/{prop['id']}")
                    for role, role_box in role_boxes.items():
                        require(separated(box, role_box), f"Prop/actor target gap below 8px at {viewport}: {page['pageId']}/{prop['id']}/{role}")
                    for other in targets:
                        require(separated(box, other["rect"]), f"Prop targets overlap: {page['pageId']}")
                    targets.append({"propId":prop["id"],"rect":list(box)})
                if viewport in [320,390] and src["number"] in [2,3,4,15]:
                    geometry_results.append({"pageId":page["pageId"],"viewportWidth":viewport,"sceneSize":[width,height],"targets":targets,"insideScene":True,"minimumTargetGapPx":8})

    require(len(all_segments) == 72 and all(n == 1 for n in Counter(all_segments).values()), "Omitted or duplicated segment across pages.")
    require(len(all_pages) == 26 and len(set(all_pages)) == 26, "Page count/IDs invalid.")
    require(len(all_groups) == 49 and len(set(all_groups)) == 49, "Reading group count/IDs invalid.")
    require(attribution_count == 20, "Expected all 20 attribution segments with following speech.")
    for entry in config["audioContract"]["legacyOverrides"]:
        require(entry["segmentId"] in source_segments, "Invalid legacy segment.")
        for kind in ["lead","follow","solo"]:
            require((REPO/entry[kind]["path"]).is_file(), f"Existing audio missing: {entry[kind]['path']}")
    for reuse in config["audioContract"]["plannedAttributionReuse"]:
        require(source_segments[reuse["segmentId"]]["text"] == source_segments[reuse["sourceSegmentId"]]["text"], "Attribution reuse differs in source text.")
    report = {"status":"passed","checkedAt":datetime.now(timezone.utc).isoformat(),"validator":"docs/design/validate-xue-er-scene-config.py","configSha256":sha(config_bytes),"sourceSha256":sha(source_bytes),"counts":{"chapters":16,"pages":26,"segments":72,"readingGroups":49,"attributionsWithFollowingSpeech":20,"originalHanzi":sum(sum('\u3400' <= ch <= '\u9fff' for ch in c['fullText']) for c in source['chapters'])},"chapters":chapter_results,"priorityMobileTargets":geometry_results,"checks":["Exact segment order and uniqueness","Strict per-page/fullText concatenation including punctuation","Continuous Unicode source ranges","Attribution and following speech share page and reading group","All prop/cue/audio-group/character references resolve","Only existing layers and approved legacy audio paths referenced","Only transform/opacity, one-shot motion and one focal object per step","Static geometry at 320/360/389/390/599/600/768/1023/1024/1440: targets >=48, role boxes >=80, gaps >=8, contained in scene","Optional preserveAspectRatio=none is restricted to static background props"],"limits":["Data and geometry validation alone does not establish rendered visual acceptance; see xue-er-phase-b-review.md","This validator performs no build, browser run, media generation or listening","Audio readiness and publication remain separate Lead/Engineer responsibilities"]}
    REPORT_PATH.write_text(json.dumps(report,ensure_ascii=False,indent=2)+"\n")
    print(json.dumps({"status":report["status"],"counts":report["counts"],"configSha256":report["configSha256"],"report":str(REPORT_PATH)},ensure_ascii=False,indent=2))


if __name__ == "__main__":
    main()
