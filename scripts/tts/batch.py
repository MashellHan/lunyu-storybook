#!/usr/bin/env python3
"""Isolated, approved Xue Er TTS batches. Default: offline validate, zero API calls.

See docs/tts/xue-er-batch-interface.md. Never invokes the legacy gen/process scripts.
"""

import argparse
import hashlib
import json
import math
import os
from pathlib import Path, PurePosixPath
import re
import subprocess
import sys
import tempfile
from datetime import datetime, timezone
import unicodedata
import uuid
import xml.etree.ElementTree as ET


ROOT = Path(__file__).resolve().parents[2]
CONTENT_SHA = "85168c306fd68f1006f96ce189801b387252fcfef9fcdc982c0388705cb13b73"
CONFIG_SHA = "5b8947b8ceedf4c92b6f8387d7c3b5716c1e296374d9115f4d2160d3f58b5f60"
BATCHES = {
    "batch-a": {
        "request": "docs/tts/xue-er-generation-request.json", "count": 30,
        "fileSHA256": "0c0a0fc0ee93868a91fcb76765a906c2bbe79d7a4a3e88c8cf60e462132be6da",
        "entrySetSHA256": "472d68446e3209689037534c3e9dedab710503b1036719d07a0e22752f672296",
    },
    "batch-b": {
        "request": "docs/tts/xue-er-generation-request-b.json", "count": 205,
        "fileSHA256": "26b79e3aa570877d917ce741079d0b67140ce1b33a29db7557b83d133396ead4",
        "entrySetSHA256": "ff9384ff4d805bdab7567bda65d12c0101ec4007d10b17ee00a55b06ee6ea54f",
    },
}
VOICES = {
    "elephant": "zh-CN-YunzeNeural", "bunny": "zh-CN-XiaoyouNeural",
    "cat": "zh-CN-YunxiaNeural", "dog": "zh-CN-Yunxi:DragonHDFlashLatestNeural",
}
CHILDREN = ("bunny", "cat", "dog")
NORM = "loudnorm=I=-16:TP=-1.5:LRA=11"
MAX_BYTES = 5 * 1024 * 1024


class BatchError(Exception):
    """Only messages composed locally, without credentials or provider error text."""


def require(condition, message):
    if not condition:
        raise BatchError(message)


def sha(data):
    return hashlib.sha256(data).hexdigest()


def canonical(value):
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8")


def json_bytes(value):
    return (json.dumps(value, ensure_ascii=False, indent=2) + "\n").encode("utf-8")


def read_json(path):
    return json.loads(path.read_text(encoding="utf-8"))


def han(char):
    return unicodedata.name(char, "").startswith(("CJK UNIFIED IDEOGRAPH-", "CJK COMPATIBILITY IDEOGRAPH-"))


def finite(value):
    return type(value) in (int, float) and math.isfinite(value)


def utc_now():
    return datetime.now(timezone.utc).isoformat()


def write_new(path, data):
    """An attempt must be durable before any paid call; never truncate an old file."""
    path.parent.mkdir(parents=True, exist_ok=True)
    flags = os.O_WRONLY | os.O_CREAT | os.O_EXCL | getattr(os, "O_NOFOLLOW", 0)
    with os.fdopen(os.open(path, flags, 0o644), "wb") as handle:
        handle.write(data)
        handle.flush()
        os.fsync(handle.fileno())
    directory = os.open(path.parent, os.O_RDONLY)
    try:
        os.fsync(directory)
    finally:
        os.close(directory)


def write_same_or_new(path, data):
    if path.exists():
        require(path.read_bytes() == data, "existing-output-differs: " + path.name)
    else:
        write_new(path, data)


def run_tool(args):
    result = subprocess.run(args, capture_output=True, check=False)
    require(result.returncode == 0, Path(args[0]).name + "-failed (provider/command details suppressed)")
    return result.stdout


def duration(path):
    data = json.loads(run_tool([
        "ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "json", str(path),
    ]))
    value = float(data["format"]["duration"])
    require(finite(value) and value > 0, "invalid-audio-duration")
    return value


def validate_timing(timing, text):
    require(timing.get("text") == text and len(timing.get("t", [])) == len(text), "timing-text-mismatch")
    total = timing.get("dur")
    require(finite(total) and total > 0, "invalid-timing-duration")
    last = -1
    for char, value in zip(text, timing["t"]):
        if not han(char):
            require(value is None, "punctuation-must-have-null-time")
        else:
            require(finite(value) and 0 <= value < total and value >= last, "missing-or-invalid-character-time")
            last = value
    return timing


def ssml_aliases(ssml, text):
    """Recover aliases at original-text positions, never by global character replace."""
    xml = ET.fromstring(ssml)
    require("".join(xml.itertext()) == text, "alignment-ssml-text-mismatch")
    found, position = [], 0

    def visit(node):
        nonlocal position
        if node.tag == "{http://www.w3.org/2001/10/synthesis}sub":
            require(not list(node), "unsupported-nested-alias")
            found.append({"index": position, "original": node.text or "", "alias": node.get("alias")})
        position += len(node.text or "")
        for child in node:
            visit(child)
            position += len(child.tail or "")

    visit(xml)
    return found


def character_times(text, boundaries, aliases, total, *, ssml=None, details=None, corrections=None, word_groups=None):
    """Match every spoken character in order; only explicit source positions may alias."""
    positions = [i for i, char in enumerate(text) if han(char)]
    allowed = {}
    for item in aliases:
        i = item["index"]
        require(type(i) is int and i in positions and i not in allowed, "invalid-alias-position")
        require(text[i] == item["original"] and len(item["alias"]) == 1 and han(item["alias"]), "invalid-alias-text")
        allowed[i] = item["alias"]
    if ssml is not None:
        require(ssml_aliases(ssml, text) == aliases, "alignment-aliases-not-in-approved-ssml")
    if details is not None:
        require(isinstance(details, list) and len(details) == len(boundaries), "boundary-details-length-mismatch")
        for info in details:
            # HD uses -1 when its SSML text location is unknown. Retain the sentinel;
            # character alignment still requires the actual words in source order.
            require(isinstance(info, dict) and type(info.get("textOffset")) is int and info["textOffset"] >= -1 and
                    type(info.get("wordLength")) is int and info["wordLength"] >= 0, "invalid-sdk-boundary-position")
    times, cursor = [None] * len(text), 0
    require(isinstance(boundaries, list), "missing-word-boundaries")
    for boundary_index, row in enumerate(boundaries):
        require(isinstance(row, (list, tuple)) and len(row) == 3, "invalid-word-boundary")
        offset, span, word = row
        require(finite(offset) and finite(span) and offset >= 0 and span >= 0 and isinstance(word, str), "invalid-word-boundary")
        if word.startswith('\">'):
            # Retained d1 and real batch A: an alias event is followed by \">原字
            # and one or two consecutive original Han characters. Do not strip
            # other fragments or borrow time from the already timed alias.
            require(ssml is not None and 0 < cursor < len(positions) and boundary_index > 0, "unresolved-ssml-boundary-fragment")
            previous, following = positions[cursor - 1], positions[cursor]
            prior = boundaries[boundary_index - 1]
            remainder = word[3:]
            remaining = positions[cursor:cursor + len(remainder)]
            require(len(remainder) in (1, 2) and previous in allowed and
                    remaining == list(range(previous + 1, previous + 1 + len(remainder))) and
                    not any(i in allowed for i in remaining) and
                    word == '\">' + text[previous] + ''.join(text[i] for i in remaining) and
                    prior[2] == allowed[previous] and offset >= prior[0] + prior[1] - 0.002,
                    "unresolved-ssml-boundary-fragment")
            if corrections is not None:
                corrections.append({"boundaryIndex": boundary_index, "kind": "hd-sub-duplicate-after-alias",
                                    "alreadyTimedSourceIndex": previous, "remainingSourceIndex": following,
                                    "remainingSourceIndices": remaining,
                                    "originalBoundaryText": word, "usedBoundaryOffsetSeconds": offset,
                                    "usedBoundaryDurationSeconds": span,
                                    "sdkPosition": details[boundary_index] if details is not None else None})
            word = remainder
        require(all(han(c) or c.isspace() or unicodedata.category(c).startswith("P") for c in word), "unexpected-spoken-character")
        letters = [c for c in word if han(c)]
        if not letters:
            continue
        require(cursor + len(letters) <= len(positions), "extra-word-boundary-characters")
        require(len(letters) == 1 or span > 0 or word_groups is not None, "multi-character-word-has-no-duration")
        first_position = cursor
        for j, char in enumerate(letters):
            i = positions[cursor]
            require(char in (text[i], allowed.get(i)), "word-boundary-character-mismatch-at-" + str(i))
            times[i] = round(offset + span * j / len(letters), 6)
            cursor += 1
        if len(letters) > 1 and span == 0:
            # A real word start is known, but its internal character times are not.
            # Preserve a shared anchor and its precision; never infer an end time.
            word_groups.append({"granularity": "word", "boundaryIndex": boundary_index,
                                "originalBoundaryText": row[2], "sourceIndexes": positions[first_position:cursor],
                                "offsetSeconds": offset, "sourceDurationSeconds": span,
                                "sdkPosition": details[boundary_index] if details is not None else None})
    require(cursor == len(positions), "incomplete-word-boundaries")
    return validate_timing({"text": text, "dur": total, "t": times}, text)["t"]


def azure_renderer():
    """Lazy: validate, process, index and tests never load the SDK or need credentials."""
    key, region = os.environ.get("AZURE_SPEECH_KEY"), os.environ.get("AZURE_SPEECH_REGION")
    require(bool(key and region), "Azure credentials not configured; no request reserved or sent")
    import azure.cognitiveservices.speech as sdk

    config = sdk.SpeechConfig(subscription=key, region=region)
    config.set_speech_synthesis_output_format(sdk.SpeechSynthesisOutputFormat.Audio24Khz96KBitRateMonoMp3)
    config.set_property(sdk.PropertyId.SpeechServiceResponse_RequestWordBoundary, "true")

    def render(entry):
        boundaries, positions = [], []
        synthesizer = sdk.SpeechSynthesizer(speech_config=config, audio_config=None)

        def boundary(event):
            if event.boundary_type == sdk.SpeechSynthesisBoundaryType.Word:
                boundaries.append([event.audio_offset / 1e7, event.duration.total_seconds(), event.text])
                positions.append({"textOffset": int(event.text_offset), "wordLength": int(event.word_length)})

        synthesizer.synthesis_word_boundary.connect(boundary)
        result = synthesizer.speak_ssml_async(entry["ssml"]).get()  # Exactly one application call, no retry loop.
        require(result.reason == sdk.ResultReason.SynthesizingAudioCompleted, "azure-synthesis-not-completed")
        return bytes(result.audio_data), boundaries, positions

    return render


class BatchTool:
    def __init__(self, root=ROOT):
        self.root = Path(root).resolve()
        content_bytes = (self.root / "docs/content/xue-er.json").read_bytes()
        require(sha(content_bytes) == CONTENT_SHA, "frozen-content-changed")
        require(sha((self.root / "scripts/tts/config.py").read_bytes()) == CONFIG_SHA, "existing-voice-config-changed")
        self.content = json.loads(content_bytes)
        self.chapters = {c["number"]: c for c in self.content["chapters"]}
        self.texts = {s["id"]: s["text"] for c in self.content["chapters"] for s in c["segments"]}
        self.manifests, self.entries, self.entry_batches = {}, {}, {}
        for batch, spec in BATCHES.items():
            raw = (self.root / spec["request"]).read_bytes()
            require(sha(raw) == spec["fileSHA256"], batch + ": reviewed-manifest-changed")
            data = json.loads(raw)
            require(sha(canonical(data["entries"])) == spec["entrySetSHA256"] == data["entrySetSHA256"], batch + ": unapproved-entry-set")
            require(len(data["entries"]) == data["maxRequests"] == spec["count"] and data["automaticRetries"] == 0, "request-limit-changed")
            self.manifests[batch] = data
            for entry in data["entries"]:
                self.validate_entry(entry, batch)
                require(entry["id"] not in self.entries, "duplicate-entry-id")
                self.entries[entry["id"]] = entry
                self.entry_batches[entry["id"]] = batch
        for data in self.manifests.values():
            for reuse in data["reuse"]:
                require(self.texts[reuse["segment"]] == self.texts[reuse["from"]], "reuse-text-mismatch")
                require(all(reuse["from"] + "-" + r in self.entries for r in VOICES), "reuse-source-missing")
        require(sum(e["segment"] is None for e in self.entries.values()) == 15, "expected-fifteen-new-titles")

    def media_path(self, relative, batch, raw=False):
        require(batch in BATCHES and isinstance(relative, str), "unknown-media-batch")
        prefix = ("assets/source/tts-raw" if raw else "assets/audio") + "/xue-er/" + batch + "/"
        require(relative.startswith(prefix) and "\\" not in relative, "media-path-outside-approved-batch")
        parts = relative.split("/")
        require(all(p not in ("", ".", "..") for p in parts) and not PurePosixPath(relative).is_absolute(), "invalid-media-path")
        path = self.root
        for part in parts:
            path = path / part
            require(not path.is_symlink(), "media-symlink-rejected")
        return path

    def sidecar(self, entry, suffix):
        batch = self.entry_batches[entry["id"]]
        return self.media_path(entry["rawOutput"].removesuffix(".mp3") + suffix, batch, raw=True)

    def validate_entry(self, entry, batch):
        ident, text = entry["id"], entry["plainText"]
        require(re.fullmatch(r"xue-er-\d{2}-(?:s\d{2}|title)-(?:elephant|bunny|cat|dog)", ident) is not None, "invalid-entry-id")
        require(ident == entry["textId"] + "-" + entry["role"], "entry-identity-mismatch")
        require(entry["voice"] == VOICES[entry["role"]], "unapproved-voice")
        require(entry["textCharacters"] == len(text) and entry["hanzi"] == sum(map(han, text)), "text-count-mismatch")
        expected = self.texts[entry["segment"]] if entry["segment"] else "论语，之，" + self.chapters[entry["chapter"]]["title"] + "。"
        require(text == expected, "entry-content-mismatch")
        require(sha(entry["ssml"].encode("utf-8")) == entry["ssmlSHA256"], "ssml-hash-mismatch")
        xml = ET.fromstring(entry["ssml"])
        require("".join(xml.itertext()) == text, "ssml-text-mismatch")
        require(ssml_aliases(entry["ssml"], text) == entry["aliasesBySourcePosition"], "ssml-alias-position-mismatch")
        voice = xml.find("{http://www.w3.org/2001/10/synthesis}voice")
        require(voice is not None and voice.get("name") == entry["voice"], "ssml-voice-mismatch")
        for key, prefix, raw in (("rawOutput", "assets/source/tts-raw", True), ("processedOutput", "assets/audio", False)):
            require(entry[key] == f"{prefix}/xue-er/{batch}/{ident}.mp3", "unexpected-output-name")
            self.media_path(entry[key], batch, raw=raw)

    def select(self, batch, ids=None, all_entries=False, explicit=True):
        require(batch in BATCHES, "select-one-batch")
        require(not (ids and all_entries), "choose-ids-or-all")
        require(not explicit or ids or all_entries, "explicit-entry-selection-required")
        selected = ids or [e["id"] for e in self.manifests[batch]["entries"]]
        require(len(set(selected)) == len(selected), "duplicate-selection")
        require(all(i in self.entries and self.entry_batches[i] == batch for i in selected), "entry-outside-selected-batch")
        return [self.entries[i] for i in selected]

    def identity(self, entry):
        batch = self.entry_batches[entry["id"]]
        return {"id": entry["id"], "batch": batch, "contentSHA256": CONTENT_SHA,
                "sourceEntrySetSHA256": BATCHES[batch]["entrySetSHA256"], "ssmlSHA256": entry["ssmlSHA256"]}

    def result(self, entry):
        attempt_path, result_path = self.sidecar(entry, ".attempt.json"), self.sidecar(entry, ".result.json")
        raw_path = self.media_path(entry["rawOutput"], self.entry_batches[entry["id"]], raw=True)
        if not attempt_path.exists():
            require(not result_path.exists() and not raw_path.exists(), "untracked-raw-output: " + entry["id"])
            return None
        attempt = read_json(attempt_path)
        require(all(attempt.get(k) == v for k, v in self.identity(entry).items()) and attempt.get("attemptId"), "attempt-provenance-mismatch")
        if not result_path.exists():
            return {"status": "unknown"}
        result = read_json(result_path)
        require(all(result.get(k) == v for k, v in self.identity(entry).items()), "result-provenance-mismatch")
        require(result.get("attemptId") == attempt["attemptId"] and result.get("status") in ("succeeded", "failed"), "invalid-result-state")
        if result["status"] == "succeeded":
            require(raw_path.is_file(), "successful-raw-output-missing")
            audio = raw_path.read_bytes()
            require(100 < len(audio) < MAX_BYTES and sha(audio) == result.get("rawSHA256"), "raw-audio-hash-mismatch")
            require(isinstance(result.get("wb"), list), "raw-word-boundaries-missing")
            require(isinstance(result.get("wordBoundaryDetails"), list) and len(result["wordBoundaryDetails"]) == len(result["wb"]), "raw-sdk-positions-missing")
        return result

    def validate(self, batch="all", selected=None):
        chosen = list(BATCHES) if batch == "all" else [batch]
        require(all(b in BATCHES for b in chosen), "unknown-batch")
        state = {}
        for name in chosen:
            counts = {"unstarted": 0, "unknown": 0, "failed": 0, "succeeded": 0}
            for entry in self.manifests[name]["entries"]:
                result = self.result(entry)
                counts[result["status"] if result else "unstarted"] += 1
            state[name] = {"entries": BATCHES[name]["count"], "entrySetSHA256": BATCHES[name]["entrySetSHA256"], "recordedResults": counts}
        return {"status": "validated", "mode": "offline-dry-run", "paidCallsThisRun": 0, "mediaWritesThisRun": 0,
                "contentSHA256": CONTENT_SHA, "batches": state, "selectedEntries": len(selected) if selected is not None else sum(BATCHES[b]["count"] for b in chosen),
                "newTitles": 15, "uniqueNewSegments": 55, "reusedSegmentPositions": 14,
                "approvedMaximumRequests": 235, "approvedBudgetUSD": 10,
                "fullSSMLPlanningReferenceUSD": 1.266060, "referenceIsActualQuote": False,
                "credentialsPresent": {k: bool(os.environ.get(k)) for k in ("AZURE_SPEECH_KEY", "AZURE_SPEECH_REGION")}}

    def execute(self, batch, selected, renderer=None):
        require(batch in BATCHES and selected, "explicit-entry-selection-required")
        require(all(self.entries.get(e["id"]) == e and self.entry_batches[e["id"]] == batch for e in selected), "unapproved-execution-entry")
        require(len({e["id"] for e in selected}) == len(selected), "duplicate-selection")
        if batch == "batch-b":
            require(all((self.result(e) or {}).get("status") == "succeeded" for e in self.manifests["batch-a"]["entries"]), "batch-a-must-succeed-before-b")
        pending, skipped = [], []
        for entry in selected:
            result = self.result(entry)
            if result:
                require(result["status"] == "succeeded", "no-retry-for-recorded-attempt: " + entry["id"])
                skipped.append(entry["id"])
            else:
                pending.append(entry)
        if pending and renderer is None:
            renderer = azure_renderer()
        completed = []
        for entry in pending:
            attempt = {**self.identity(entry), "attemptId": str(uuid.uuid4()), "startedAt": utc_now(),
                       "status": "reserved", "maximumApplicationCalls": 1, "automaticRetries": 0, "budgetCeilingUSD": 10}
            write_new(self.sidecar(entry, ".attempt.json"), json_bytes(attempt))
            try:
                audio, boundaries, positions = renderer(entry)
                require(isinstance(audio, bytes) and 100 < len(audio) < MAX_BYTES, "invalid-synthesis-audio-size")
                require(isinstance(boundaries, list) and isinstance(positions, list) and len(boundaries) == len(positions), "missing-synthesis-boundaries-or-positions")
                write_new(self.media_path(entry["rawOutput"], batch, raw=True), audio)
                result = {**attempt, "status": "succeeded", "finishedAt": utc_now(), "rawSHA256": sha(audio),
                          "wb": boundaries, "wordBoundaryDetails": positions,
                          "positionSemantics": "Unmodified SDK text_offset/word_length; retain exact approved SSML for interpretation"}
            except Exception as error:
                # Never log cancellation_details/error_details: SDK messages may include credentials.
                failure = {**attempt, "status": "failed", "finishedAt": utc_now(), "errorType": type(error).__name__}
                write_new(self.sidecar(entry, ".result.json"), json_bytes(failure))
                raise BatchError("request-failed-no-retry: " + entry["id"]) from None
            write_new(self.sidecar(entry, ".result.json"), json_bytes(result))
            completed.append(entry["id"])
        return {"status": "executed", "paidCallsThisRun": len(completed), "completed": completed, "verifiedSkipped": skipped}

    def processed_ref(self, name, batch, text, source_entries):
        prefix = f"assets/audio/xue-er/{batch}/{name}"
        audio_path = self.media_path(prefix + ".mp3", batch)
        timing_path = self.media_path(prefix + ".timing.json", batch)
        if not audio_path.exists() and not timing_path.exists():
            return None
        require(audio_path.exists() and timing_path.exists(), "partial-processed-output-run-process: " + name)
        timing, audio = read_json(timing_path), audio_path.read_bytes()
        require(100 < len(audio) < MAX_BYTES and sha(audio) == timing.get("audioSHA256"), "processed-audio-hash-mismatch")
        require(timing.get("contentSHA256") == CONTENT_SHA and timing.get("sourceEntrySetSHA256") == BATCHES[batch]["entrySetSHA256"], "processed-provenance-mismatch")
        expected = []
        for entry in source_entries:
            result = self.result(entry)
            require(result and result["status"] == "succeeded", "processed-source-not-successful")
            expected.append({"id": entry["id"], "rawSHA256": result["rawSHA256"], "ssmlSHA256": entry["ssmlSHA256"]})
        require(timing.get("sources") == expected, "processed-source-hash-mismatch")
        validate_timing(timing, text)
        actual_duration = duration(audio_path)
        require(abs(actual_duration - timing["dur"]) < 0.002, "processed-duration-mismatch")
        first = self.result(source_entries[0])
        corrections, word_groups = [], []
        expected_times = character_times(text, first["wb"], source_entries[0]["aliasesBySourcePosition"], actual_duration,
                                         ssml=source_entries[0]["ssml"], details=first["wordBoundaryDetails"],
                                         corrections=corrections, word_groups=word_groups)
        require(timing["t"] == expected_times and timing.get("alignmentCorrections") == corrections and
                timing.get("wordGroups", []) == word_groups, "processed-boundary-mapping-changed")
        return {"file": prefix + ".mp3", "sha256": timing["audioSHA256"], "timingFile": prefix + ".timing.json", "batch": batch}

    def produce(self, name, batch, text, source_entries, filter_args, alignment=None):
        output = self.media_path(f"assets/audio/xue-er/{batch}/{name}.mp3", batch)
        timing_path = self.media_path(f"assets/audio/xue-er/{batch}/{name}.timing.json", batch)
        if output.exists() and timing_path.exists():
            return self.processed_ref(name, batch, text, source_entries)
        results = [self.result(e) for e in source_entries]
        require(all(r and r["status"] == "succeeded" for r in results), "raw-result-required-for-processing")
        raw_paths = [self.media_path(e["rawOutput"], batch, raw=True) for e in source_entries]
        # Reject missing/misaligned boundaries before producing any final media.
        character_times(text, results[0]["wb"], source_entries[0]["aliasesBySourcePosition"], duration(raw_paths[0]),
                        ssml=source_entries[0]["ssml"], details=results[0]["wordBoundaryDetails"], word_groups=[])
        output.parent.mkdir(parents=True, exist_ok=True)
        with tempfile.TemporaryDirectory(prefix=".process-", dir=output.parent) as scratch:
            temp_audio = Path(scratch) / "clip.mp3"
            args = ["ffmpeg", "-nostdin", "-v", "error", "-n"]
            for raw_path in raw_paths:
                args.extend(["-i", str(raw_path)])
            run_tool(args + filter_args + ["-ar", "24000", "-ac", "1", "-b:a", "64k", str(temp_audio)])
            total, audio = duration(temp_audio), temp_audio.read_bytes()
            require(100 < len(audio) < MAX_BYTES, "processed-output-too-large-or-empty")
            corrections, word_groups = [], []
            times = character_times(text, results[0]["wb"], source_entries[0]["aliasesBySourcePosition"], total,
                                    ssml=source_entries[0]["ssml"], details=results[0]["wordBoundaryDetails"],
                                    corrections=corrections, word_groups=word_groups)
            timing = {"text": text, "dur": total, "t": times, "alignmentCorrections": corrections,
                      "audioSHA256": sha(audio), "contentSHA256": CONTENT_SHA,
                      "sourceEntrySetSHA256": BATCHES[batch]["entrySetSHA256"],
                      "sources": [{"id": e["id"], "rawSHA256": r["rawSHA256"], "ssmlSHA256": e["ssmlSHA256"]} for e, r in zip(source_entries, results)],
                      "processing": {"sampleRate": 24000, "channels": 1, "bitRate": 64000, "normalization": NORM}}
            if alignment is not None:
                timing["processing"]["childrenAlignment"] = alignment
            if word_groups:
                timing["wordGroups"] = word_groups
            write_same_or_new(output, audio)
            write_same_or_new(timing_path, json_bytes(timing))
        return self.processed_ref(name, batch, text, source_entries)

    def children(self, segment):
        return [self.entries[segment + "-" + role] for role in CHILDREN]

    def process(self, batch, selected):
        require(batch in BATCHES and selected, "explicit-entry-selection-required")
        require(all(self.entries.get(e["id"]) == e and self.entry_batches[e["id"]] == batch for e in selected), "unapproved-processing-entry")
        require(len({e["id"] for e in selected}) == len(selected), "duplicate-selection")
        require(all((self.result(e) or {}).get("status") == "succeeded" for e in selected), "selected-raw-results-not-ready")
        produced = []
        for entry in selected:
            self.produce(entry["id"], batch, entry["plainText"], [entry], ["-af", NORM])
            produced.append(entry["id"])
        for segment in sorted({e["segment"] for e in selected if e["segment"]}):
            children = self.children(segment)
            if not all(self.processed_ref(e["id"], batch, e["plainText"], [e]) for e in children):
                continue
            lengths = [duration(self.media_path(e["rawOutput"], batch, raw=True)) for e in children]
            ratios = [1, lengths[1] / lengths[0], lengths[2] / lengths[0]]
            filters = (f"[1:a]{tempo_filter(ratios[1])},adelay=70[a1];"
                       f"[2:a]{tempo_filter(ratios[2])},adelay=140[a2];"
                       f"[0:a][a1][a2]amix=inputs=3:normalize=0,{NORM}")
            self.produce(segment + "-children", batch, children[0]["plainText"], children,
                         ["-filter_complex", filters], {"roles": list(CHILDREN), "tempo": ratios, "delaysMs": [0, 70, 140]})
            produced.append(segment + "-children")
        candidate = self.index(batch)
        return {"status": "processed", "paidCallsThisRun": 0, "processed": produced, "candidate": candidate}

    def index(self, batch, write=True):
        require(batch in BATCHES, "select-one-batch-for-index")
        segments, titles, missing = {}, {}, []
        for name, entry in self.entries.items():
            source_batch = self.entry_batches[name]
            ref = self.processed_ref(name, source_batch, entry["plainText"], [entry])
            if not ref:
                missing.append(name)
            elif entry["segment"]:
                segments.setdefault(entry["segment"], {})[entry["role"]] = ref
            else:
                titles[self.chapters[entry["chapter"]]["id"]] = ref
        unique_segments = sorted({e["segment"] for e in self.entries.values() if e["segment"]})
        for segment in unique_segments:
            children = self.children(segment)
            ref = self.processed_ref(segment + "-children", self.entry_batches[children[0]["id"]], children[0]["plainText"], children)
            if ref:
                segments.setdefault(segment, {})["children"] = ref
            else:
                missing.append(segment + "-children")
        for manifest in self.manifests.values():
            for reuse in manifest["reuse"]:
                refs = segments.get(reuse["from"], {})
                if refs:
                    segments[reuse["segment"]] = dict(refs)
                missing.extend(reuse["segment"] + ":" + role for role in (*VOICES, "children") if role not in refs)
        all_refs = [ref for roles in segments.values() for ref in roles.values()] + list(titles.values())
        pending = {ref["file"]: {"file": ref["file"], "audioSHA256": ref["sha256"], "status": "not-listened"} for ref in all_refs}
        candidate = {"schemaVersion": 1, "contentSHA256": CONTENT_SHA, "publicationReady": False,
                     "batches": {b: {"request": s["request"], "entrySetSHA256": s["entrySetSHA256"]} for b, s in BATCHES.items()},
                     "segments": segments, "titles": titles, "missing": missing, "pendingListening": list(pending.values())}
        if write:
            target = self.media_path(f"assets/audio/xue-er/{batch}/media-candidate.json", batch)
            target.parent.mkdir(parents=True, exist_ok=True)
            # Only this derived view is replaced; clips, timings and request records are immutable.
            with tempfile.NamedTemporaryFile(prefix=".candidate-", dir=target.parent, delete=False) as handle:
                temp = Path(handle.name)
                try:
                    handle.write(json_bytes(candidate))
                    handle.flush()
                    os.fsync(handle.fileno())
                except BaseException:
                    temp.unlink(missing_ok=True)
                    raise
            try:
                self.media_path(str(target.relative_to(self.root)), batch)
                os.replace(temp, target)
            finally:
                temp.unlink(missing_ok=True)
            return str(target.relative_to(self.root))
        return candidate


def tempo_filter(factor):
    require(finite(factor) and factor > 0, "invalid-tempo")
    steps = []
    while factor > 2:
        steps.append("atempo=2")
        factor /= 2
    while factor < 0.5:
        steps.append("atempo=0.5")
        factor *= 2
    return ",".join(steps + [f"atempo={factor:.9f}"])


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("command", choices=("validate", "execute", "process", "index"), nargs="?", default="validate")
    parser.add_argument("--batch", choices=("all", *BATCHES), default="all")
    selection = parser.add_mutually_exclusive_group()
    selection.add_argument("--ids", nargs="+")
    selection.add_argument("--all", action="store_true", dest="all_entries")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args(argv)
    try:
        tool = BatchTool()
        selected = None
        if args.command in ("execute", "process") or args.ids:
            selected = tool.select(args.batch, args.ids, args.all_entries)
        if args.command == "validate" or args.dry_run:
            result = tool.validate(args.batch, selected)
        elif args.command == "execute":
            result = tool.execute(args.batch, selected)
        elif args.command == "process":
            result = tool.process(args.batch, selected)
        else:
            result = {"status": "indexed", "paidCallsThisRun": 0, "candidate": tool.index(args.batch)}
        print(json.dumps(result, ensure_ascii=False, indent=2))
        return 0
    except Exception as error:
        message = str(error) if isinstance(error, BatchError) else type(error).__name__
        print(json.dumps({"status": "failed", "error": message}, ensure_ascii=False), file=sys.stderr)
        return 2


if __name__ == "__main__":
    sys.exit(main())
