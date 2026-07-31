# StimPad Sound Licenses

Launch catalog: **49 sounds** (8 free, 41 Plus).

License: [Mixkit License](https://mixkit.co/license/) — free for commercial use; attribution appreciated, not required.

Generated noise tracks (white/pink/brown) are **CC0** (created in-repo).

Full download manifest: `data/mixkit_manifest.json`  
Re-download script: `node tools/download_mixkit_sounds.js`

## Free tier (8)

| ID | Mixkit title | Mixkit ID |
|----|--------------|-----------|
| police_siren | Police siren | 1643 |
| fire_whistle | Manual siren fire alert | 2018 |
| school_bell | School bell ring | 933 |
| vacuum | Air zoom vacuum | 2608 |
| white_noise | Generated CC0 | — |
| pen_click | Pen clicking twice | 1114 |
| rain | Rain long loop | 2394 |
| fan_hum | Electric fan blowing | 1704 |

## Plus tier (41)

See `data/mixkit_manifest.json` for every file URL. All Plus sounds sourced from Mixkit CDN except pink/brown noise (generated CC0).

## File format

- Mixkit clips: **MP3** at `assets/audio/{id}.mp3`
- Generated noise: **WAV** at `assets/audio/{id}.wav`

Godot 4 plays both natively.

## Before store submit

1. Spot-check a few clips in-app (some Mixkit title→ID pairings are approximate)
2. Replace any misfit sound by editing `tools/download_mixkit_sounds.js` CURATED map and re-running the script
3. Keep `data/mixkit_manifest.json` updated in git for audit trail
