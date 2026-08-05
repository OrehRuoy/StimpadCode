# GitHub Secrets — StimPadCode

Repo: https://github.com/OrehRuoy/StimpadCode

## Are secrets hidden on a public repo?

**Yes.** Repository secrets are **never visible** to visitors, in the code, or in workflow logs (values are masked). A public repo only exposes source code — not secrets.

Only people with **admin/write access** to the repo can add or view secret names (not values after saving).

## Secrets required for iOS TestFlight CI

| Secret | What it is |
|--------|------------|
| `APPLE_CERTIFICATE_BASE64` | Base64 of your `.p12` Distribution certificate |
| `APPLE_CERTIFICATE_PASSWORD` | Password for the `.p12` |
| `APPLE_PROVISIONING_PROFILE_BASE64` | Base64 of StimPad `.mobileprovision` |
| `APPLE_ID_USERNAME` | Apple ID email |
| `APPLE_ID_PASSWORD` | App-specific password (appleid.apple.com → Sign-In and Security) |
| `GOOGLE_SERVICE_INFO_PLIST_BASE64` | Base64 of `GoogleService-Info.plist` (Firebase Analytics) |

## How to add (GitHub website)

1. Repo → **Settings** → **Secrets and variables** → **Actions**
2. **New repository secret** for each row above
3. Paste the value → **Add secret**

## How to add (gh CLI on your PC)

You must generate the base64 values locally first (PowerShell):

```powershell
# Certificate
[Convert]::ToBase64String([IO.File]::ReadAllBytes("C:\path\to\dist.p12")) | Set-Clipboard
# Then: gh secret set APPLE_CERTIFICATE_BASE64 --repo OrehRuoy/StimpadCode

# Provisioning profile
[Convert]::ToBase64String([IO.File]::ReadAllBytes("C:\path\to\StimPad.mobileprovision")) | Set-Clipboard
# Then: gh secret set APPLE_PROVISIONING_PROFILE_BASE64 --repo OrehRuoy/StimpadCode

gh secret set APPLE_CERTIFICATE_PASSWORD --repo OrehRuoy/StimpadCode
gh secret set APPLE_ID_USERNAME --repo OrehRuoy/StimpadCode
gh secret set APPLE_ID_PASSWORD --repo OrehRuoy/StimpadCode

# Firebase Analytics plist (from project root or ios/)
[Convert]::ToBase64String([IO.File]::ReadAllBytes("C:\Users\Ultima\Desktop\StimPad\GoogleService-Info.plist")) | Set-Clipboard
gh secret set GOOGLE_SERVICE_INFO_PLIST_BASE64 --repo OrehRuoy/StimpadCode
```

## Can the agent add them for me?

**Not without you providing the actual certificate and profile files.** Those live on your Mac/PC and must never be committed to git. Once you have the `.p12` and `.mobileprovision` files, you (or I with the files present locally) can run the commands above.

If you already use the same Distribution cert for Whats4Dinner / other OrehRuoy apps, you can **reuse** `APPLE_CERTIFICATE_BASE64` and `APPLE_CERTIFICATE_PASSWORD` — only the **provisioning profile** must be new for `com.stimpad.soundboard`.

## Verify secrets exist (names only)

```powershell
gh secret list --repo OrehRuoy/StimpadCode
```

## Never commit

These files stay **gitignored**:
- `*.p12`, `*.mobileprovision`
- `GoogleService-Info.plist`, `ios/GoogleService-Info.plist`, `addons/GodotFirebaseiOS/GoogleService-Info.plist`
- `addons/GodotFirebaseiOS/` (installed by `scripts/setup_ios_firebase.sh` / CI)
- `android/app/google-services.json`
