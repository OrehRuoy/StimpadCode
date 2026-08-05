# StimPad Sound Licenses

Launch catalog: **84 sounds** (14 free, 70 Plus).

## Sources

- Most stim clips are **bundled locally** under `assets/audio/` (app works offline for playback).
- Primary libraries: [Freesound](https://freesound.org/) **CC0** field recordings and [BigSoundBank](https://bigsoundbank.com/) **CC0**.
- Some clips: [Mixkit License](https://mixkit.co/license/) — free for commercial use; attribution appreciated, not required.
- Full per-sound attribution lives in `data/sounds.json` / `data/mixkit_manifest.json` (this file is the in-repo credits source; no in-app Sound Credits screen).
- Generated noise (white/pink/brown) and a few synth tones: **CC0** (created in-repo).
- Retro “console boot” entries are **original synthesized tones** or generic Mixkit UI/arcade SFX — **not** Nintendo, Sega, Sony, or Microsoft startup jingles. Art uses generic devices without brand logos.

Manifest: `data/mixkit_manifest.json`  
Household re-download helper: `node tools/fix_household_sfx.js`

## Free tier (14)

| ID | Name |
|----|------|
| police_siren | Police Wail Siren |
| fire_whistle | Manual Fire Whistle |
| school_bell | School Hall Bell |
| vacuum | Upright Vacuum |
| white_noise | White Noise Hiss |
| pen_click | Ballpoint Pen Click |
| rain | Steady Rain Loop |
| fan_hum | Desk Fan |
| ocean_waves | Ocean Waves Loop |
| clock_tick | Wall Clock Tick-Tock |
| campfire | Campfire Crackles |
| camera_shutter | Camera Shutter Click |
| cat_meow | Sweet Cat Meow |
| coin_drop | Arcade Coin Drop |

## Plus tier

See `data/sounds.json` and `data/mixkit_manifest.json` for full list (Animals, Nature, Tools, Retro, Vehicles, etc.).

## File format

- Mixkit clips: `assets/audio/{id}.mp3`
- Generated WAV: `assets/audio/{id}.wav`
- Art: `assets/art/sounds/{id}.png`
