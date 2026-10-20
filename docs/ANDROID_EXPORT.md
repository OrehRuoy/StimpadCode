# Android Export — StimPad

Package: `com.stimpad.soundboard` (Play Console app id. Do not change it.)

Godot 4.6.3. Android builds use the Gradle template in `android/build`. `android/.build_version` is `4.6.3.stable`.

## Presets

In `export_presets.cfg`:

- **Android (Play Store .aab)** — `build/StimPad.aab`, `gradle_build/export_format=1`, arm64-v8a only, target SDK 36. This is the Play upload.
- **Android APK (device test)** — `build/StimPad.apk`, `export_format=0`, `runnable=true`. Same package and version, for `adb install`.

Both presets sign the build (`package/signed=true`), request internet, network state, and vibrate, and turn post-notifications off. Both set `screen/support_large` and `screen/support_xlarge` to true, so 7-inch and 10-inch tablets are included.

## Version code

`version/name` is `1.0.5`, matching `application/config/version` in `project.godot`. Both Android presets use `version/code=5` for the next Play upload. Version code 4 was the previous build. Raise that integer by 1 for each later Play upload.

## Signing

Upload keystore: `%USERPROFILE%\keys\stimpad-upload.keystore` (outside the repo). Alias `stimpad`. The password is in `%USERPROFILE%\keys\stimpad-upload-info.txt`. `*.keystore`, `*.jks`, and `keys/` are gitignored.

Local release exports read the path, alias, and password from `.godot/export_credentials.cfg` (gitignored) for both Android presets. Export from the Godot editor. Android is not built in GitHub Actions.

## Firebase

`android/build/google-services.json` is gitignored. Copy the Firebase Android config there before a release export. A release export of `com.stimpad.soundboard` refuses to build when that file is missing or has no client for the package.

## Local export

Project → Export in Godot. Use **Android (Play Store .aab)** for Play and **Android APK (device test)** for `adb install`. Uncheck **Export with debug** on the build you upload.
