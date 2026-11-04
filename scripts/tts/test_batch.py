#!/usr/bin/env python3
"""Offline regression tests. All SDK results and generated tones stay in temp dirs."""

import contextlib
import copy
import io
import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest
from unittest import mock

import batch


def boundary_fixture(entry):
    chars = list(entry["plainText"])
    for alias in entry["aliasesBySourcePosition"]:
        chars[alias["index"]] = alias["alias"]
    word = "".join(c for c in chars if batch.han(c))
    return [[0.1, 0.8, word]], [{"textOffset": 0, "wordLength": len(word)}]


class BatchTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        if not shutil.which("ffmpeg") or not shutil.which("ffprobe"):
            raise RuntimeError("The project's existing ffmpeg/ffprobe are required for offline tests")
        cls.tone_dir = tempfile.TemporaryDirectory(prefix="lunyu-batch-test-tones-")
        cls.tones = {}
        for role, seconds in (("elephant", 1.6), ("bunny", 1.4), ("cat", 1.8), ("dog", 1.2)):
            path = Path(cls.tone_dir.name) / (role + ".mp3")
            subprocess.run(["ffmpeg", "-nostdin", "-v", "error", "-n", "-f", "lavfi", "-i",
                            f"sine=frequency=440:duration={seconds}", "-ar", "24000", "-ac", "1", "-b:a", "96k", str(path)],
                           check=True, capture_output=True)
            cls.tones[role] = path.read_bytes()

    @classmethod
    def tearDownClass(cls):
        cls.tone_dir.cleanup()

    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix="lunyu-batch-test-")
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        for relative in ("docs/content/xue-er.json", "scripts/tts/config.py", *(s["request"] for s in batch.BATCHES.values())):
            target = self.root / relative
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(batch.ROOT / relative, target)
        self.legacy = self.root / "assets/audio/d3.mp3"
        self.legacy.parent.mkdir(parents=True, exist_ok=True)
        self.legacy.write_bytes(b"sentinel: retained-v5-must-not-change")
        self.tool = batch.BatchTool(self.root)
        self.entry = self.tool.entries["xue-er-01-s01-elephant"]

    def renderer(self, entry):
        boundaries, positions = boundary_fixture(entry)
        return self.tones[entry["role"]], boundaries, positions

    def inventory(self):
        return {str(p.relative_to(self.root)): batch.sha(p.read_bytes()) for p in self.root.rglob("*") if p.is_file()}

    def test_default_and_execute_dry_run_never_load_sdk_or_write(self):
        before = self.inventory()
        for argv in ([], ["execute", "--batch", "batch-a", "--ids", self.entry["id"], "--dry-run"]):
            stdout = io.StringIO()
            with mock.patch.object(batch, "BatchTool", return_value=self.tool), mock.patch.object(batch, "azure_renderer", side_effect=AssertionError("SDK touched")), contextlib.redirect_stdout(stdout):
                self.assertEqual(batch.main(argv), 0)
            result = json.loads(stdout.getvalue())
            self.assertEqual(result["paidCallsThisRun"], 0)
            self.assertEqual(result["mediaWritesThisRun"], 0)
        self.assertEqual(self.inventory(), before)

    def test_reviewed_manifests_and_content_are_bound_by_hash(self):
        for relative in ("docs/content/xue-er.json", "scripts/tts/config.py", *(s["request"] for s in batch.BATCHES.values())):
            path = self.root / relative
            before = path.read_bytes()
            path.write_bytes(before + b"\n")
            with self.assertRaises(batch.BatchError):
                batch.BatchTool(self.root)
            path.write_bytes(before)
        self.assertEqual(self.tool.validate()["selectedEntries"], 235)

    def test_selection_rejects_unknown_duplicate_and_cross_batch_ids(self):
        for ids in (["unknown"], [self.entry["id"], self.entry["id"]], ["xue-er-04-s01-elephant"]):
            with self.assertRaises(batch.BatchError):
                self.tool.select("batch-a", ids)
        with self.assertRaises(batch.BatchError):
            self.tool.select("batch-a")
        with self.assertRaises(batch.BatchError):
            self.tool.select("batch-a", [self.entry["id"]], all_entries=True)

    def test_media_paths_reject_escape_and_symlink(self):
        for relative in ("assets/audio/d3.mp3", "assets/audio/xue-er/batch-a/../d3.mp3", "/tmp/a.mp3", "assets/audio/xue-er/batch-a//a.mp3"):
            with self.assertRaises(batch.BatchError):
                self.tool.media_path(relative, "batch-a")
        outside = self.root / "outside"
        outside.mkdir()
        folder = self.root / "assets/audio/xue-er"
        folder.mkdir()
        (folder / "batch-a").symlink_to(outside, target_is_directory=True)
        with self.assertRaises(batch.BatchError):
            self.tool.media_path(self.entry["processedOutput"], "batch-a")
        self.assertEqual(list(outside.iterdir()), [])

    def test_missing_credentials_do_not_reserve_or_call(self):
        before = self.inventory()
        with mock.patch.dict(os.environ, {}, clear=True), self.assertRaisesRegex(batch.BatchError, "credentials not configured"):
            self.tool.execute("batch-a", [self.entry])
        self.assertEqual(self.inventory(), before)

    def test_attempt_precedes_call_and_success_is_skipped(self):
        seen = []

        def renderer(entry):
            record = batch.read_json(self.tool.sidecar(entry, ".attempt.json"))
            self.assertEqual(record["status"], "reserved")
            self.assertEqual(record["maximumApplicationCalls"], 1)
            seen.append(entry["id"])
            return self.renderer(entry)

        first = self.tool.execute("batch-a", [self.entry], renderer)
        before = self.inventory()
        second = self.tool.execute("batch-a", [self.entry], mock.Mock(side_effect=AssertionError("duplicate charge")))
        self.assertEqual(seen, [self.entry["id"]])
        self.assertEqual(first["paidCallsThisRun"], 1)
        self.assertEqual(second["paidCallsThisRun"], 0)
        self.assertEqual(self.inventory(), before)
        raw = self.tool.result(self.entry)
        self.assertEqual(raw["wordBoundaryDetails"], [{"textOffset": 0, "wordLength": 2}])

    def test_failure_is_sanitized_and_never_automatically_retried(self):
        secret_like = "credential-must-never-appear-in-records"
        with self.assertRaisesRegex(batch.BatchError, "request-failed-no-retry"):
            self.tool.execute("batch-a", [self.entry], mock.Mock(side_effect=RuntimeError(secret_like)))
        self.assertEqual(self.tool.result(self.entry)["status"], "failed")
        self.assertNotIn(secret_like, self.tool.sidecar(self.entry, ".result.json").read_text())
        callback = mock.Mock()
        with self.assertRaisesRegex(batch.BatchError, "no-retry-for-recorded-attempt"):
            self.tool.execute("batch-a", [self.entry], callback)
        callback.assert_not_called()

    def test_crash_after_reservation_stays_unknown_without_retry(self):
        with self.assertRaises(KeyboardInterrupt):
            self.tool.execute("batch-a", [self.entry], mock.Mock(side_effect=KeyboardInterrupt))
        self.assertEqual(self.tool.result(self.entry)["status"], "unknown")
        callback = mock.Mock()
        with self.assertRaisesRegex(batch.BatchError, "no-retry-for-recorded-attempt"):
            self.tool.execute("batch-a", [self.entry], callback)
        callback.assert_not_called()

    def test_full_selection_preflight_blocks_before_any_new_call(self):
        failed = self.tool.entries["xue-er-01-s01-bunny"]
        with self.assertRaises(batch.BatchError):
            self.tool.execute("batch-a", [failed], mock.Mock(side_effect=RuntimeError("cancelled")))
        callback = mock.Mock()
        with self.assertRaises(batch.BatchError):
            self.tool.execute("batch-a", [self.entry, failed], callback)
        callback.assert_not_called()
        self.assertIsNone(self.tool.result(self.entry))

    def test_raw_tamper_and_untracked_outputs_are_rejected(self):
        self.tool.execute("batch-a", [self.entry], self.renderer)
        path = self.root / self.entry["rawOutput"]
        path.write_bytes(path.read_bytes() + b"tampered")
        with self.assertRaisesRegex(batch.BatchError, "raw-audio-hash-mismatch"):
            self.tool.execute("batch-a", [self.entry], mock.Mock())
        other = self.tool.entries["xue-er-01-s01-cat"]
        untracked = self.root / other["rawOutput"]
        untracked.write_bytes(self.tones["cat"])
        with self.assertRaisesRegex(batch.BatchError, "untracked-raw-output"):
            self.tool.execute("batch-a", [other], mock.Mock())

    def test_batch_order_and_235_exact_requests_cannot_expand_on_rerun(self):
        all_a = self.tool.select("batch-a", all_entries=True)
        all_b = self.tool.select("batch-b", all_entries=True)
        callback = mock.Mock(side_effect=self.renderer)
        with self.assertRaisesRegex(batch.BatchError, "batch-a-must-succeed-before-b"):
            self.tool.execute("batch-b", [all_b[0]], callback)
        callback.assert_not_called()
        self.assertEqual(self.tool.execute("batch-a", all_a, callback)["paidCallsThisRun"], 30)
        self.assertEqual(self.tool.execute("batch-b", all_b, callback)["paidCallsThisRun"], 205)
        self.assertEqual(callback.call_count, 235)
        self.assertEqual(self.tool.execute("batch-a", all_a, callback)["paidCallsThisRun"], 0)
        self.assertEqual(self.tool.execute("batch-b", all_b, callback)["paidCallsThisRun"], 0)
        self.assertEqual(callback.call_count, 235)

    def test_aliases_are_position_based_with_punctuation_and_unicode(self):
        text = "说，悦说！"
        aliases = [{"index": 0, "original": "说", "alias": "悦"}]
        result = batch.character_times(text, [[0.1, 0.4, "悦悦"], [0.6, 0.2, "说"]], aliases, 1)
        self.assertEqual(result, [0.1, None, 0.3, 0.6, None])
        with self.assertRaises(batch.BatchError):
            batch.character_times(text, [[0.1, 0.4, "悦悦"], [0.6, 0.2, "悦"]], aliases, 1)
        self.assertEqual(batch.character_times("𠀀。", [[0.1, 0.3, "𠀀"]], [], 1), [0.1, None])

    def test_missing_extra_nonmonotonic_and_durationless_words_fail(self):
        for boundaries in ([[0.1, 0.2, "子"]], [[0.1, 0.8, "子曰曰"]], [[0.6, 0.1, "子"], [0.3, 0.1, "曰"]],
                           [[0.1, 0, "子曰"]], [[-1, 0.4, "子曰"]], [[0.1, 3, "子曰"]], [[float("nan"), 0.2, "子曰"]]):
            with self.assertRaises(batch.BatchError):
                batch.character_times("子曰：“", boundaries, [], 1)

    def test_real_legacy_sdk_boundaries_including_hd_sub_fragment(self):
        legacy = batch.read_json(batch.ROOT / "assets/source/tts-raw/meta.json")
        for key, record in legacy.items():
            with self.subTest(key=key):
                aliases = []
                if record["who"] == "dog":
                    aliases = [{"index": i, "original": c, "alias": {"说": "悦", "愠": "运"}[c]}
                               for i, c in enumerate(record["text"]) if c in ("说", "愠")]
                ssml, corrections = None, []
                if key == "d1":
                    # Exact retained gen.py/config.py d1 input; do not import the paid gen.py.
                    ssml = ('<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xmlns:mstts="https://www.w3.org/2001/mstts" xml:lang="zh-CN">'
                            '<voice name="zh-CN-Yunxi:DragonHDFlashLatestNeural"><mstts:express-as style="cheerful" styledegree="1.2">'
                            '<prosody rate="-15%" pitch="0%">学而时习之，<break time="100ms"/>不亦<sub alias="悦">说</sub>乎？'
                            '</prosody></mstts:express-as></voice></speak>')
                original = copy.deepcopy(record["wb"])
                times = batch.character_times(record["text"], record["wb"], aliases,
                                              batch.duration(batch.ROOT / f"assets/source/tts-raw/{key}.mp3"), ssml=ssml, corrections=corrections)
                self.assertEqual(record["wb"], original)
                self.assertEqual(sum(v is not None for v in times), sum(map(batch.han, record["text"])))
                if key == "d1":
                    self.assertEqual(times[8:10], [1.777, 2.06])
                    self.assertEqual(len(corrections), 1)
                    self.assertEqual(corrections[0]["originalBoundaryText"], '\">说乎')

    def test_hd_fragment_requires_exact_alias_context_and_does_not_drop_arbitrary_text(self):
        text = "说乎？"
        aliases = [{"index": 0, "original": "说", "alias": "悦"}]
        ssml = '<speak xmlns="http://www.w3.org/2001/10/synthesis"><sub alias="悦">说</sub>乎？</speak>'
        valid = [[0.1, 0.2, "悦"], [0.3, 0.2, '\">说乎']]
        with self.assertRaises(batch.BatchError):
            batch.character_times(text, valid, aliases, 1)
        for first, last in (("说", '\">说乎'), ("悦", '\">说乎乎'), ("悦", '<sub>说乎'), ("悦", '\">乐乎')):
            with self.assertRaises(batch.BatchError):
                batch.character_times(text, [[0.1, 0.2, first], [0.3, 0.2, last]], aliases, 1, ssml=ssml)
        self.assertEqual(batch.character_times(text, valid, aliases, 1, ssml=ssml,
                                              details=[{"textOffset": 10, "wordLength": 1}, {"textOffset": 18, "wordLength": 4}]), [0.1, 0.3, None])

    def test_real_batch_a_hd_unknown_offsets_and_contiguous_remainders(self):
        # Unmodified paid A results; fixture hashes identify the retained originals.
        fixtures = [{'id': 'xue-er-02-s02-dog',
          'rawSHA256': 'b30bd0b474ef3128bbf0ed3da763c877d75711e86e0f2ba45755def6b10a62b5',
          'total': 3.84,
          'wb': [[0.082, 0.282, '其'],
                 [0.364, 0.329, '为人'],
                 [0.694, 0.188, '也'],
                 [0.882, 0.235, '孝'],
                 [1.117, 0.329, '替'],
                 [1.617, 0.235, '而'],
                 [1.852, 0.188, '耗'],
                 [2.04, 0.47, '">好犯上'],
                 [2.511, 0.376, '者'],
                 [2.887, 0.47, '显'],
                 [3.358, 0.376, '">鲜矣']],
          'details': [{'textOffset': 263, 'wordLength': 1},
                      {'textOffset': 264, 'wordLength': 2},
                      {'textOffset': 266, 'wordLength': 1},
                      {'textOffset': 267, 'wordLength': 1},
                      {'textOffset': -1, 'wordLength': 1},
                      {'textOffset': 312, 'wordLength': 1},
                      {'textOffset': -1, 'wordLength': 1},
                      {'textOffset': -1, 'wordLength': 5},
                      {'textOffset': 337, 'wordLength': 1},
                      {'textOffset': -1, 'wordLength': 1},
                      {'textOffset': -1, 'wordLength': 4}],
          'remaining': [[9, 10], [14]]},
         {'id': 'xue-er-02-s03-dog',
          'rawSHA256': '3a256bbde8152033a7600a864483292e349bf7b19e565ee7e5052dee8c97d281',
          'total': 3.528,
          'wb': [[0.082, 0.235, '不'],
                 [0.317, 0.188, '耗'],
                 [0.505, 0.658, '">好犯上'],
                 [1.164, 0.282, '而'],
                 [1.447, 0.141, '耗'],
                 [1.588, 0.376, '">好作乱'],
                 [1.964, 0.0, '者'],
                 [2.501, 0.47, '未之'],
                 [2.971, 0.235, '有'],
                 [3.207, 0.0, '也']],
          'details': [{'textOffset': 263, 'wordLength': 1},
                      {'textOffset': -1, 'wordLength': 1},
                      {'textOffset': -1, 'wordLength': 5},
                      {'textOffset': 288, 'wordLength': 1},
                      {'textOffset': -1, 'wordLength': 1},
                      {'textOffset': -1, 'wordLength': 5},
                      {'textOffset': 313, 'wordLength': 1},
                      {'textOffset': 336, 'wordLength': 2},
                      {'textOffset': 338, 'wordLength': 1},
                      {'textOffset': 339, 'wordLength': 1}],
          'remaining': [[2, 3], [6, 7]]},
         {'id': 'xue-er-02-s05-dog',
          'rawSHA256': '6580847c4ee5c4b120567c3738ea9ffb41682056dd969dfcf316b111805acdb7',
          'total': 2.904,
          'wb': [[0.082, 0.423, '孝'],
                 [0.505, 0.188, '替'],
                 [0.694, 0.188, '">弟也'],
                 [0.882, 0.0, '者'],
                 [1.389, 0.282, '其'],
                 [1.671, 0.235, '为'],
                 [1.907, 0.188, '仁'],
                 [2.095, 0.188, '之'],
                 [2.283, 0.188, '本'],
                 [2.471, 0.0, '于']],
          'details': [{'textOffset': 263, 'wordLength': 1},
                      {'textOffset': -1, 'wordLength': 1},
                      {'textOffset': -1, 'wordLength': 4},
                      {'textOffset': 287, 'wordLength': 1},
                      {'textOffset': 310, 'wordLength': 1},
                      {'textOffset': 311, 'wordLength': 1},
                      {'textOffset': 312, 'wordLength': 1},
                      {'textOffset': 313, 'wordLength': 1},
                      {'textOffset': 314, 'wordLength': 1},
                      {'textOffset': -1, 'wordLength': 1}],
          'remaining': [[2]]},
         {'id': 'xue-er-03-s02-dog',
          'rawSHA256': '538d71c7821e50eecba3944f62ec426b9b1f305eb35e15cc028062c3caf7d634',
          'total': 2.688,
          'wb': [[0.082, 1.364, '巧言令色'], [1.617, 0.423, '显'], [2.04, 0.235, '">鲜矣'], [2.276, 0.329, '仁']],
          'details': [{'textOffset': 263, 'wordLength': 4},
                      {'textOffset': -1, 'wordLength': 1},
                      {'textOffset': -1, 'wordLength': 4},
                      {'textOffset': 312, 'wordLength': 1}],
          'remaining': [[6]]}]
        for record in fixtures:
            with self.subTest(id=record["id"]):
                entry = self.tool.entries[record["id"]]
                original, corrections = copy.deepcopy(record), []
                times = batch.character_times(entry["plainText"], record["wb"], entry["aliasesBySourcePosition"],
                                              record["total"], ssml=entry["ssml"], details=record["details"], corrections=corrections)
                self.assertEqual(record, original)
                self.assertEqual(sum(v is not None for v in times), entry["hanzi"])
                self.assertEqual([c["remainingSourceIndices"] for c in corrections], record["remaining"])
                for correction in corrections:
                    offset, span, word = record["wb"][correction["boundaryIndex"]]
                    remaining = correction["remainingSourceIndices"]
                    self.assertEqual(correction["sdkPosition"]["textOffset"], -1)
                    self.assertEqual(correction["originalBoundaryText"], word)
                    self.assertEqual(correction["usedBoundaryDurationSeconds"], span)
                    self.assertEqual([times[i] for i in remaining],
                                     [round(offset + span * j / len(remaining), 6) for j in range(len(remaining))])

    def test_unknown_sdk_location_does_not_replace_word_validation(self):
        word = [[0.1, 0.4, "子曰"]]
        self.assertEqual(batch.character_times("子曰。", word, [], 1,
                                              details=[{"textOffset": -1, "wordLength": 2}]), [0.1, 0.3, None])
        for details in ([{"textOffset": -2, "wordLength": 2}], [{"textOffset": -1, "wordLength": -1}],
                        [{"textOffset": True, "wordLength": 2}]):
            with self.assertRaisesRegex(batch.BatchError, "invalid-sdk-boundary-position"):
                batch.character_times("子曰。", word, [], 1, details=details)
        with self.assertRaisesRegex(batch.BatchError, "character-mismatch"):
            batch.character_times("子曰。", [[0.1, 0.4, "子云"]], [], 1,
                                  details=[{"textOffset": -1, "wordLength": 2}])

    def test_hd_two_character_fragment_rejects_gaps_extras_and_wrong_aliases(self):
        aliases = [{"index": 0, "original": "好", "alias": "耗"}]
        for text, fragment, prior, span in (("好，犯上", '\">好犯上', "耗", 0.4),
                                            ("好犯上者", '\">好犯上者', "耗", 0.4),
                                            ("好犯上", '\">好上犯', "耗", 0.4),
                                            ("好犯上", '\">好犯上', "好", 0.4),
                                            ("好犯上", '\">好犯上', "耗", 0)):
            with self.subTest(text=text, fragment=fragment, prior=prior, span=span):
                ssml = '<speak xmlns="http://www.w3.org/2001/10/synthesis"><sub alias="耗">好</sub>' + text[1:] + '</speak>'
                with self.assertRaises(batch.BatchError):
                    batch.character_times(text, [[0.1, 0.2, prior], [0.3, span, fragment]], aliases, 2, ssml=ssml)

    def test_real_b_zero_duration_words_keep_shared_observed_starts(self):
        fixtures = [{'id': 'xue-er-04-s05-dog',
          'rawSHA256': '07e0a7015543020e85d63a1ac4ee12391d70c024483fe93a7afe4e43e554e693',
          'total': 1.176,
          'wb': [[0.082, 0.282, '船'], [0.364, 0.188, '">传不'], [0.552, 0.0, '习乎']],
          'details': [{'textOffset': -1, 'wordLength': 1},
                      {'textOffset': -1, 'wordLength': 4},
                      {'textOffset': 286, 'wordLength': 2}],
          'sourceIndexes': [2, 3]},
         {'id': 'xue-er-07-s03-dog',
          'rawSHA256': '0ba36694c37715a2b33ca5be33774ec2561568cdf61ea3a5dbb36638f60f946d',
          'total': 2.064,
          'wb': [[0.082, 0.282, '事'],
                 [0.364, 0.0, '父母'],
                 [1.087, 0.282, '能'],
                 [1.369, 0.188, '竭'],
                 [1.557, 0.188, '其'],
                 [1.746, 0.282, '力']],
          'details': [{'textOffset': 263, 'wordLength': 1},
                      {'textOffset': 264, 'wordLength': 2},
                      {'textOffset': 288, 'wordLength': 1},
                      {'textOffset': 289, 'wordLength': 1},
                      {'textOffset': 290, 'wordLength': 1},
                      {'textOffset': 291, 'wordLength': 1}],
          'sourceIndexes': [1, 2]}]
        for record in fixtures:
            with self.subTest(id=record["id"]):
                entry = self.tool.entries[record["id"]]
                original, groups = copy.deepcopy(record), []
                times = batch.character_times(entry["plainText"], record["wb"], entry["aliasesBySourcePosition"],
                                              record["total"], ssml=entry["ssml"], details=record["details"], word_groups=groups)
                self.assertEqual(record, original)
                self.assertEqual(len(groups), 1)
                group = groups[0]
                self.assertEqual(group["granularity"], "word")
                self.assertEqual(group["sourceIndexes"], record["sourceIndexes"])
                event = record["wb"][group["boundaryIndex"]]
                self.assertEqual(group["sourceDurationSeconds"], event[1])
                self.assertEqual(event[1], 0)
                self.assertEqual(group["offsetSeconds"], event[0])
                self.assertEqual(group["originalBoundaryText"], event[2])
                self.assertEqual(group["sdkPosition"], record["details"][group["boundaryIndex"]])
                self.assertEqual([times[i] for i in record["sourceIndexes"]], [event[0]] * 2)
                self.assertEqual(sum(v is not None for v in times), entry["hanzi"])

    def test_word_anchors_still_reject_missing_extra_negative_or_unobserved_times(self):
        for events in ([], [[0.1, 0, "父"]], [[0.1, 0, "父母母"]], [[-0.1, 0, "父母"]],
                       [[float("nan"), 0, "父母"]], [[2, 0, "父母"]], [[0.1, -0.1, "父母"]]):
            with self.subTest(events=events), self.assertRaises(batch.BatchError):
                batch.character_times("父母", events, [], 1, word_groups=[])
        with self.assertRaisesRegex(batch.BatchError, "multi-character-word-has-no-duration"):
            batch.character_times("父母", [[0.1, 0, "父母"]], [], 1)

    def test_processed_word_granularity_is_preserved_and_cannot_be_removed(self):
        def renderer(entry):
            return self.tones[entry["role"]], [[0.1, 0, "子曰"]], [{"textOffset": 10, "wordLength": 2}]
        self.tool.execute("batch-a", [self.entry], renderer)
        self.tool.process("batch-a", [self.entry])
        path = (self.root / self.entry["processedOutput"]).with_suffix(".timing.json")
        timing = batch.read_json(path)
        self.assertEqual(timing["t"], [0.1, 0.1, None, None])
        self.assertEqual(timing["wordGroups"][0]["sourceIndexes"], [0, 1])
        self.assertEqual(timing["wordGroups"][0]["sourceDurationSeconds"], 0)
        for change in ("remove", "invent-end-time"):
            altered = copy.deepcopy(timing)
            if change == "remove":
                del altered["wordGroups"]
            else:
                altered["wordGroups"][0]["sourceDurationSeconds"] = 0.5
            path.write_bytes(batch.json_bytes(altered))
            with self.assertRaisesRegex(batch.BatchError, "processed-boundary-mapping-changed"):
                self.tool.index("batch-a", write=False)
        path.write_bytes(batch.json_bytes(timing))
        self.tool.index("batch-a", write=False)

    def test_empty_candidate_reports_missing_titles_without_fabricated_refs(self):
        before = self.inventory()
        candidate = self.tool.index("batch-a", write=False)
        self.assertFalse(candidate["publicationReady"])
        self.assertEqual(candidate["titles"], {})
        self.assertEqual(candidate["segments"], {})
        self.assertEqual(len([s for s in candidate["missing"] if "-title-" in s]), 15)
        self.assertEqual(self.inventory(), before)

    def test_offline_process_unison_cross_batch_reuse_and_all_fifteen_titles(self):
        all_a = self.tool.select("batch-a", all_entries=True)
        title_b = [e for e in self.tool.manifests["batch-b"]["entries"] if e["segment"] is None]
        self.tool.execute("batch-a", all_a, self.renderer)
        self.tool.execute("batch-b", title_b, self.renderer)
        selected_a = [e for e in all_a if e["segment"] == "xue-er-01-s01" or e["segment"] is None]
        result_a = self.tool.process("batch-a", selected_a)
        self.assertIn("xue-er-01-s01-children", result_a["processed"])
        self.tool.process("batch-b", title_b)
        candidate = batch.read_json(self.root / "assets/audio/xue-er/batch-b/media-candidate.json")
        self.assertEqual(set(candidate["titles"]), {f"xue-er-{n:02}" for n in range(2, 17)})
        self.assertEqual(candidate["segments"]["xue-er-03-s01"], candidate["segments"]["xue-er-01-s01"])
        self.assertEqual(candidate["segments"]["xue-er-05-s01"], candidate["segments"]["xue-er-01-s01"])
        self.assertEqual(set(candidate["segments"]["xue-er-01-s01"]), {"elephant", "bunny", "cat", "dog", "children"})
        self.assertFalse(candidate["publicationReady"])
        self.assertEqual(len(candidate["pendingListening"]), 20)
        self.assertTrue(all("listening" not in ref for ref in candidate["titles"].values()))
        children = candidate["segments"]["xue-er-01-s01"]["children"]
        timing = batch.read_json(self.root / children["timingFile"])
        self.assertEqual(timing["processing"]["childrenAlignment"]["delaysMs"], [0, 70, 140])
        self.assertGreater(timing["processing"]["childrenAlignment"]["tempo"][1], 1)
        self.assertLess(timing["processing"]["childrenAlignment"]["tempo"][2], 1)
        self.assertEqual(len(timing["sources"]), 3)
        stream = json.loads(batch.run_tool(["ffprobe", "-v", "error", "-select_streams", "a:0", "-show_entries",
                                           "stream=sample_rate,channels,bit_rate", "-of", "json", str(self.root / children["file"])]))["streams"][0]
        self.assertEqual((stream["sample_rate"], stream["channels"], stream["bit_rate"]), ("24000", 1, "64000"))
        before = self.inventory()
        self.tool.process("batch-a", selected_a)
        # Candidate view may gain B references; immutable clip/timing/request bytes must not change.
        after = self.inventory()
        self.assertEqual({k: v for k, v in before.items() if not k.endswith("media-candidate.json")},
                         {k: v for k, v in after.items() if not k.endswith("media-candidate.json")})
        self.assertEqual(self.legacy.read_bytes(), b"sentinel: retained-v5-must-not-change")
        path = self.root / candidate["titles"]["xue-er-02"]["timingFile"]
        altered = batch.read_json(path)
        altered["t"][0] += 0.01
        path.write_bytes(batch.json_bytes(altered))
        with self.assertRaisesRegex(batch.BatchError, "processed-boundary-mapping-changed"):
            self.tool.index("batch-b", write=False)


if __name__ == "__main__":
    unittest.main(verbosity=2)
