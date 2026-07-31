# iOS CI — StimPad

Adapted from OrehRuoy/Whats4dinnerCode. macOS minutes cost 10× — use Ubuntu preflight first.

## Workflows
- `.github/workflows/ios-testflight.yml` — preflight (always) + export/upload (when `run_macos_export=true`)
- `.github/workflows/ios-upload-existing-ipa.yml` — re-upload artifact without rebuild

## Required GitHub secrets
| Secret | Purpose |
|--------|---------|
| `APPLE_CERTIFICATE_BASE64` | Distribution .p12 |
| `APPLE_CERTIFICATE_PASSWORD` | P12 password |
| `APPLE_PROVISIONING_PROFILE_BASE64` | Profile for `com.stimpad.soundboard` |
| `APPLE_ID_USERNAME` | Apple ID email |
| `APPLE_ID_PASSWORD` | App-specific password |
| `GOOGLE_SERVICE_INFO_PLIST_BASE64` | Firebase iOS config (optional until Firebase wired) |

## export_presets.cfg
- Bundle: `com.stimpad.soundboard`
- Team ID: set your Apple team ID (same as other OrehRuoy apps: `9WRNQYQZTB` if shared)
- Replace `PASTE_PROFILE_UUID_HERE` with provisioning profile UUID
- Icon: `assets/branding/icon_1024.png` (must be opaque 1024×1024)
- `plugins/AdmobPlugin=true`

## Pitfalls (from IOS_PUBLISHING_PLAYBOOK)
- Pin `runs-on: macos-26` for iOS 26 SDK
- Godot/templates in `$RUNNER_TEMP`, not project folder
- `.gdip` comments use `;` not `#`
- Never use `plugins/exported=PackedStringArray(...)`
- If export succeeded but upload failed → use upload-existing-ipa workflow

## First TestFlight run
1. Complete App Store Connect app record + provisioning profile
2. Add secrets to StimPadCode repo
3. Run workflow with `run_macos_export=false` → fix preflight
4. Run with `run_macos_export=true`
