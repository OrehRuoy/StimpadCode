# StimPad: Audio Sensory Fidget

Godot 4.6.3 mobile soundboard for neurodivergent users. iOS-first, Android-ready.

## Bundle ID
`com.stimpad.soundboard`

## IAP
- Product: `com.stimpad.soundboard.plus` ($4.99 non-consumable)
- Unlocks all sounds + removes ads

## Local development
1. Open this folder in Godot 4.6.3
2. Run main scene `scenes/main.tscn`
3. Desktop/editor simulates IAP; use Paywall to test Plus unlock

## Content generation
```bash
node tools/generate_content.js
```
Regenerates placeholder WAV + PNG assets from `data/sounds.json`. Replace with licensed Mixkit/Pixabay sources before store release (see `docs/SOUND_LICENSES.md`).

## Plugins (mobile export)
See [docs/PLUGIN_SETUP.md](docs/PLUGIN_SETUP.md) for AdMob, Firebase Analytics, and IAP plugin installation.

## iOS CI
See [docs/IOS_CI.md](docs/IOS_CI.md). Workflows: `.github/workflows/ios-testflight.yml`

## Privacy policy
https://orehruoy.github.io/StimPad/privacy-policy.html

## Contact
Brock Hall — hallanhype@gmail.com (OrehRuoy)
