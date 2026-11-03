# Credits / 素材来源 (v6)

Licensing: code is MIT; illustrations and voices are all rights reserved; animal sounds are CC0 — see LICENSE.md in this folder.

## Illustrations
All character art is original, generated for this project from the prompts in `docs/prompts/` (GitHub Copilot CLI image generation), then cleaned and layered by `scripts/image/`. No photos of real people or children are used.

## Voices
All speech is synthetic (Azure Speech neural / HD voices), see `docs/characters-and-voices.md`.

## 动物叫声 / Animal sounds

All four sounds are real recordings released as **CC0 1.0 (public domain dedication)**. Attribution is not legally required; it is listed here anyway.
Processing (in `scripts/sfx/make.py`; sources in `assets/source/sfx/`): trim, high-pass, light denoise (bunny only), fade in/out, every animal sound set ~5 dB below the voice clips (active RMS ≈ -21 dBFS vs voice -15.5), peak-limited without auto-level, 24 kHz mono mp3.

| 用途 | File | Title | Author | Source URL | License | Segment used |
|---|---|---|---|---|---|---|
| 小兔 bunny | squeak.mp3 | Rabbit oinks and squeaks | kessir | https://commons.wikimedia.org/wiki/File:Rabbit_oinks_and_squeaks.wav | CC0 1.0 | 20.33–21.33 s (soft "honk" squeaks); the repo keeps only a 2 s excerpt (19.83–21.83 s, FLAC) to stay small |
| 小猫 cat | meow.mp3 | Cute Kitten Meow | Breviceps | https://freesound.org/s/448084/ | CC0 1.0 | whole clip (0–0.62 s) |
| 小狗 dog | woof.mp3 | Puppy Bark | AntumDeluge | https://freesound.org/s/583142/ | CC0 1.0 | 0.05–1.35 s (three puppy yips) |
| 大象 elephant | trumpet.mp3 | Elephant Trumpets Growls | D.jones | https://freesound.org/s/527845/ | CC0 1.0 | 0.04–2.00 s (full trumpet + natural tail, 0.85 s fade-out; not stretched) |

Freesound clips were taken from the public "HQ preview" mp3 (no account needed); the license on each sound page was checked on 2026-11-03.
`python3 scripts/sfx/make.py --preview` writes `build/sfx-all.mp3` (trumpet, squeak, meow, woof back to back, 0.6 s gaps) for listening.

v5 used a different elephant ("Elephant voice - trumpeting", Info-farmer, https://commons.wikimedia.org/wiki/File:Elephant_voice_-_trumpeting.ogg, CC0 1.0); v5 files are not part of this repo.
