# StimPad: Audio Sensory Fidget

Godot 4.6.3 soundboard for neurodivergent users. It ships on iPhone, iPad, and Android.

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
See [docs/PLUGIN_SETUP.md](docs/PLUGIN_SETUP.md) for AdMob, Firebase Analytics, IAP, and the iOS local-notification plugin.

## Analytics events
New return-visit events (params in braces). String params `sound_id`, `sound_name`, `source`, and `trigger` are sent as GA4 strings.

- `daily_sound_shown` {sound_id, days_since_first_open} — once per local day, when today's free Plus tile is first on screen
- `daily_sound_play` {sound_id, days_since_first_open} — a full play of today's free sound
- `session_restored` {sound_id, hours_since_last} — last playback settings restored on open
- `resume_tap` {sound_id, hours_since_last} — Play again starts that saved sound
- `reminder_prompt_shown` {trigger: listen_45s | timer_finished}
- `reminder_opt_in` {hour}
- `reminder_declined`
- `reminder_permission_denied`
- `reminder_open` {hour}
- `reminder_disabled`
- `app_open` also sends `source` (`reminder` or `direct`)
- `sound_play` still sends `sound_id` and `sound_name` as strings

User property `reminder_on` is `1` or `0`.

## iOS CI
See [docs/IOS_CI.md](docs/IOS_CI.md). Workflows: `.github/workflows/ios-testflight.yml`

## Release rule
Every feature branch is merged into `main` before it ships. TestFlight, App Store, and Play builds run only from `main`.

## Privacy policy
https://orehruoy.github.io/StimPad/privacy-policy.html

## Contact
Brock Hall — hallanhype@gmail.com (OrehRuoy)
