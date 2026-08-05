# iOS CI — StimPad

Adapted from OrehRuoy/Whats4dinnerCode. macOS minutes cost 10× — use Ubuntu preflight first.

## Playbooks (read these when exporting / fixing CI)

Local Desktop copies (do not edit from StimPad work — reference only):

| Project | Path |
|---------|------|
| **Whats4Dinner** | `Desktop/Whats4Dinner/docs/IOS_PUBLISHING_PLAYBOOK.md` (+ `IOS_CI_NO_MAC.md`) |
| **Circuit Sort** | `Desktop/Circuit Sort/docs/IOS_PUBLISHING_PLAYBOOK.md` |
| **Spectrum Sync iOS** | `Desktop/Spectrum Sync iOS/docs/iOS/IOS_PUBLISHING_PLAYBOOK.md` |

Use them for: shared Distribution `.p12` reuse, profile-per-app, OpenSSL 3DES p12 gotcha, altool upload, signing failures, and GitHub Actions macOS pitfalls. StimPad CI secrets/signing follow the same pattern.

## Workflows
- `.github/workflows/ios-testflight.yml` — preflight (always) + export/upload (when `run_macos_export=true`)
- `.github/workflows/ios-upload-existing-ipa.yml` — re-upload artifact without rebuild

## Required GitHub secrets
| Secret | Purpose |
|--------|---------|
| `APPLE_CERTIFICATE_BASE64` | Distribution .p12 (shared team cert) |
| `APPLE_CERTIFICATE_PASSWORD` | P12 password (see Circuit Sort `store/apple/signing/p12_password.txt`) |
| `APPLE_PROVISIONING_PROFILE_BASE64` | Profile for `com.stimpad.soundboard` |
| `APPLE_ID_USERNAME` | Apple ID email |
| `APPLE_ID_PASSWORD` | App-specific password |
| `GOOGLE_SERVICE_INFO_PLIST_BASE64` | Firebase iOS `GoogleService-Info.plist` |

## export_presets.cfg
- Bundle: `com.stimpad.soundboard`
- Team ID: set your Apple team ID (same as other OrehRuoy apps: `9WRNQYQZTB` if shared)
- Release profile UUID already set from `StimPad.mobileprovision`
- Icon: `assets/branding/icon_1024.png` (must be opaque 1024×1024)
- `plugins/AdmobPlugin=true`
- CI also installs GodotApplePlugins (StoreKit) + GodotFirebaseiOS

## Pitfalls (from IOS_PUBLISHING_PLAYBOOK)
- Pin `runs-on: macos-26` for iOS 26 SDK
- Godot/templates in `$RUNNER_TEMP`, not project folder
- `.gdip` comments use `;` not `#`
- Never use `plugins/exported=PackedStringArray(...)`
- If export succeeded but upload failed → use upload-existing-ipa workflow
- p12 must use legacy OpenSSL 3DES or macOS `security import` fails (“MAC verification failed”)

## First TestFlight run
1. Complete App Store Connect app record + provisioning profile
2. Secrets on StimPadCode (should already be set)
3. Run workflow with `run_macos_export=false` → fix preflight
4. Run with `run_macos_export=true`
5. On submit: ASC export compliance (exempt HTTPS) + content rights (third-party audio — yes, licensed)
