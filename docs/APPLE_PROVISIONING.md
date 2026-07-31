# Apple Provisioning Profile UUID — StimPad

**Not in App Store Connect.** You create the profile in the **Apple Developer** portal, then paste its UUID into `export_presets.cfg`.

## Where to go

1. **Apple Developer** → [developer.apple.com/account](https://developer.apple.com/account)
2. **Certificates, Identifiers & Profiles** → **Profiles**
3. Click **+** → **App Store Connect** (or **App Store** distribution)
4. Select App ID: `com.stimpad.soundboard`
5. Select your **Apple Distribution** certificate (same cert you use for other OrehRuoy apps)
6. Name it e.g. `StimPad App Store`
7. **Download** the `.mobileprovision` file

## Get the UUID

**Option A — from the file (easiest on Windows):**
1. Open the downloaded `.mobileprovision` in **Notepad**
2. Search for `<key>UUID</key>`
3. The string on the next line is your UUID, e.g. `a1b2c3d4-e5f6-7890-abcd-ef1234567890`

**Option B — from Developer portal:**
- Profiles list shows the UUID in the profile detail page

## Put it in the project

Edit `export_presets.cfg`:

```
application/provisioning_profile_uuid_release="YOUR-UUID-HERE"
```

Replace `PASTE_PROFILE_UUID_HERE`.

## Also create in Developer portal (one-time)

| Step | Portal | What |
|------|--------|------|
| App ID | Identifiers → **+** | Bundle `com.stimpad.soundboard`, enable **In-App Purchase** |
| Distribution cert | Certificates | Reuse existing **Apple Distribution** if you have one |
| Profile | Profiles | App Store profile for StimPad bundle ID |

## App Store Connect (separate)

App Store Connect is for the **store listing**, screenshots, IAP product, TestFlight — **not** for generating the provisioning profile.

After the profile exists:
1. App Store Connect → **Apps** → **+** → New App → pick `com.stimpad.soundboard`
2. Create IAP `com.stimpad.soundboard.plus` ($4.99)

## CI secret

Base64-encode the `.mobileprovision` file and add as GitHub secret `APPLE_PROVISIONING_PROFILE_BASE64` (see `docs/GITHUB_SECRETS.md`).
