# Google Play — Android App Bundle

Play Console takes an Android App Bundle for StimPad. Package name: `com.stimpad.soundboard`. Do not change it.

## Presets

| Preset | Output | Use |
| --- | --- | --- |
| Android (Play Store .aab) | `build/StimPad.aab` | Upload to Google Play |
| Android APK (device test) | `build/StimPad.apk` | Sideload with `adb install` |

The Play preset uses `gradle_build/export_format=1`, arm64-v8a only, and target SDK 36. Both presets include large and extra-large screens.

## Version code

`version/name` is `1.0.5`. Both Android presets use `version/code=7` for the next Play upload. Version code 6 was the previous build. The next App Store short version is still 1.0.6.

## Signing

Upload keystore: `%USERPROFILE%\keys\stimpad-upload.keystore` (outside the repo). Alias `stimpad`.

- `GODOT_ANDROID_KEYSTORE_RELEASE_PATH`
- `GODOT_ANDROID_KEYSTORE_RELEASE_USER`
- `GODOT_ANDROID_KEYSTORE_RELEASE_PASSWORD`

Use the same upload key for every Play release. Back up the keystore and the info file. Losing them means requesting an upload-key reset from Google. Android builds are exported from Godot on this PC. GitHub Actions is for iOS only.

## Export

1. Install the Godot 4.6.3 Android export templates.
2. In Editor Settings → Export → Android, set the release keystore, alias, and password.
3. Project → Export → Android (Play Store .aab).
4. In the export dialog, uncheck **Export with debug**. A debug export uses demo ad behavior and must not be the build you upload for production ads.
5. Upload `build/StimPad.aab`.

`google-services.json` must sit at `android/build/google-services.json` before the export. It is gitignored.

## Tracks

1. Export the AAB from Godot and upload the first one by hand in Play Console.
2. Internal testing: license testers, AdMob test device, and the phone checklist in `docs/ANDROID_QA.md`.
3. Closed testing: at least 12 testers for 14 days before production.
4. Production only after that closed test and a clean pre-launch report.

Listing copy, Data safety, content rating, and the screenshot list are in `store/play/`.

## Download size

Fill this in from Play Console → App bundle explorer after the first upload:

- Download size: ____ MB
- arm64-v8a only: yes
- 16 KB page size: yes / no
