# StimPad Android port: Cursor prompts (paste in order)

Run these in the **StimpadCode** repo (Godot 4.6.3). Each prompt stands on its own.

**Order:**
1. Run Prompt 0 (read-only). It reports whether to merge `feat/stimpad-retention-oct2026`; the live App Store 1.0.5 was built from it.
2. Brock does the merge himself.
3. Then run Prompts 1–5 on `main`.

Done Oct 19: main was fast-forwarded to the live 1.0.5 (138e212), store workflows are locked to main (196ca29), and the only branch left is main. Run Prompts 1–5 on main.

**Decided:** package `com.stimpad.soundboard`; Plus = US $4.99 one-time product `com.stimpad.soundboard.plus` (same as iOS); audience 13+; no background audio; keep Unity mediation.

**Reference repos are private.** If Cursor can't read `OrehRuoy/CircuitSortCode` or `OrehRuoy/Whats4dinnerCode`, copy the listed files into `_ref/` (gitignored) before pasting the prompt and say so.

**Package name is final: `com.stimpad.soundboard`.** It is the Play Console app ID. Never change it in any prompt.

**AdMob Android IDs (real, created by Brock):** app `ca-app-pub-5356882403986713~7546788183`, banner `ca-app-pub-5356882403986713/6529044973`, interstitial `ca-app-pub-5356882403986713/9366961309`, rewarded `ca-app-pub-5356882403986713/8333081239`. The AdMob Android app is not linked to a store yet. Brock links it in AdMob (App settings → Add store) after the Play launch. Until then AdMob shows it as unlinked and may limit fill; ads still serve to test devices. After linking, app-ads.txt verification starts.

---

## Prompt 0: Read-only report on `feat/stimpad-retention-oct2026` vs `main` (decides D1)

```
READ-ONLY TASK. Do NOT merge, rebase, cherry-pick, commit, push, create/delete branches or tags, open PRs, stash, or edit/create/delete ANY file in the repo. Only run read commands (git fetch, git log, git diff, git show, git branch -a, git tag, git merge-tree, git ls-tree, grep/rg) and, if available, read-only `gh` commands (gh run list / gh run view / gh release list). If a step would need a write, skip it and say so. Report back in chat only.

Repo: OrehRuoy/StimpadCode (Godot 4.6.3 app "StimPad", iOS live on the App Store; we're about to port it to Android in the same codebase).
Question: should feat/stimpad-retention-oct2026 be merged into main before the Android work starts?

Steps:
1. Sync without changing my working tree:
   `git fetch origin --prune --tags`
   Note the current branch and `git status --short`. If I have uncommitted changes, do NOT switch branches. Do the whole review with `origin/...` refs (git show origin/<branch>:<path>, git diff origin/main...origin/feat/stimpad-retention-oct2026).
   Only if the tree is clean: `git switch --detach origin/feat/stimpad-retention-oct2026` to look around, then switch back to the original branch at the end and confirm `git status` matches the start.

2. What's on the branch vs main:
   - `git rev-list --left-right --count origin/main...origin/feat/stimpad-retention-oct2026` (behind/ahead)
   - `git merge-base origin/main origin/feat/stimpad-retention-oct2026` and whether it equals origin/main (= fast-forward possible)
   - `git log --reverse --format='%h %ad %s' --date=iso origin/main..origin/feat/stimpad-retention-oct2026` (every commit)
   - `git diff --stat origin/main...origin/feat/stimpad-retention-oct2026` (files changed, +/-)
   - Summarise by feature: "Play again" row, 8-second locked preview, rewarded ad → whole library for 20 min (Entitlements.grant_library_unlock, LIBRARY_UNLOCK_SEC, ENTITLEMENT_EPOCH), sleep timer one-shot behaviour, review after a 45 s listen + InappReview v5.2 plugin, analytics queue + live price / transaction id, banner refresh / safe-area changes (Responsive.px_to_viewport), version bump. Name the main files for each (scripts/autoload/*.gd, scripts/ui/*.gd, addons/InappReviewPlugin/, project.godot, export_presets.cfg, locale/).
   - Also list any other remote branches (`git branch -r`) and say if any (e.g. cursor/ios-version-1-0-4-2123) are stale/superseded.

3. Which code is live on the App Store:
   - project.godot `config/version` and export_presets.cfg iOS `application/short_version` / `application/version` + Android `version/code` / `version/name` on BOTH origin/main and the branch.
   - .github/workflows/ios-testflight.yml: how the build number is set (it seds application/version to $GITHUB_RUN_NUMBER) and which branch/ref it builds.
   - `git tag --list` and `gh release list` (say "none" if empty).
   - If gh works: `gh run list --workflow ios-testflight.yml --limit 20 --json number,headBranch,headSha,conclusion,createdAt`. Map run number → build number → branch → version.
   - Public App Store: https://itunes.apple.com/lookup?id=6796806236 (version, currentVersionReleaseDate, release notes). Compare with the branch/main versions and say which one the live build came from. Give times in America/New_York.
   - State plainly whether main is behind production.

4. Is it safe to merge:
   - Conflicts: `git merge-tree --write-tree origin/main origin/feat/stimpad-retention-oct2026` (read-only; writes only loose objects, no refs). Report conflicts or "none / fast-forward".
   - Unfinished work: `git diff origin/main...origin/feat/stimpad-retention-oct2026 | grep -nE '^\+.*(TODO|FIXME|HACK|XXX|print\(|push_warning\("DEBUG|DEV_|dev_menu)'`. Also look for debug flags left on (dev menu, test ad IDs in release paths, is_real overrides, forced Plus, shortened timers like LIBRARY_UNLOCK_SEC or PREVIEW_SECONDS changed for testing).
   - Check that every new autoload/plugin referenced in project.godot exists on the branch (paths + .uid files), that export_presets.cfg is still valid for iOS (team 9WRNQYQZTB, bundle com.stimpad.soundboard), and that addons/InappReviewPlugin is only enabled for iOS export.
   - Run `godot --headless --path . --check-only` or `--import` ONLY if Godot 4.6.3 is installed AND the tree is clean on the detached branch (it may write to .godot/, which is gitignored; confirm it's ignored first). Otherwise skip it and say so.
   - Check docs that drift from the code: README.md, docs/STORE_SETUP_CHECKLIST.md ("8 free" vs 14 free; timer presets), docs/PLUGIN_SETUP.md.
   - Compare the live App Store release notes with the code. Do they claim anything the branch doesn't do (e.g. "layer two loops at once" — check scripts/autoload/audio_controller.gd for more than one AudioStreamPlayer)?

5. Recommendation:
   - MERGE / DON'T MERGE / MERGE AFTER X, with the reason.
   - Exact commands for ME to run later (e.g. `git switch main && git merge --ff-only origin/feat/stimpad-retention-oct2026 && git push origin main`, plus an optional `git tag ios-1.0.5-build<N> <sha>`). Do NOT run them.
   - Risks, and anything I should verify in App Store Connect (the build number that's live).

Output: a short report with headings 1–5, a table of commits, and file paths for every claim. No file edits. Do not run any of the merge commands. End with: "No changes were made to the repository."
```

Expected result (from my own read-only check on Oct 19): branch 15 ahead / 0 behind, fast-forward, live 1.0.5 = branch. Recommendation: merge.

---

## Prompt 1: Platform abstraction, Android export, back button, safe areas, CI

```
You are working in the StimPad Godot 4.6.3 project (repo OrehRuoy/StimpadCode). It ships on iOS today. We are adding Android in the SAME project, with runtime OS detection. Mirror Brock's other dual-platform apps exactly. Do not invent new patterns.

References (read-only):
- OrehRuoy/Whats4dinnerCode: autoload/Platform.gd (registered as W4DPlatform; OS.get_name() == "Android"/"iOS"), autoload/AppRoot.gd (NOTIFICATION_WM_GO_BACK_REQUEST handling).
- OrehRuoy/CircuitSortCode: android/.build_version (4.6.3.stable), .gitignore (android/build/** with an allow-list), android/build/build.gradle, android/build/config.gradle, android/build/proguard-rules.pro, android/build/src/main/AndroidManifest.xml, android/build/src/main/java/com/godot/game/GodotApp.java, android/build/src/main/java/com/godot/game/DeviceLayoutBridge.java, export_presets.cfg preset "Android (release) .aab".
If you cannot open those repos, stop and ask me to put the files in _ref/.

Do this:

1. Platform helper
   - Create scripts/autoload/platform.gd as a copy of W4D Platform.gd: is_android(), is_ios(), is_mobile(), store_name() ("play"/"app_store"), supports_billing(), supports_ads(), supports_analytics(), supports_in_app_review(), billing_disclaimer_text(), review_prompt_hint().
   - Register it in project.godot [autoload] as Platform="*res://scripts/autoload/platform.gd", FIRST in the list (before LocaleService).
   - Add AppInfo.store_label() in scripts/app_info.gd that uses it.
   - Do NOT rewrite every existing OS.has_feature / OS.get_name call. Only use Platform in code you add or touch.

2. Android Gradle template (Circuit Sort layout)
   - Install the Godot 4.6.3 Android build template (Project → Install Android Build Template, or `godot --headless --install-android-build-template`).
   - Commit android/.build_version.
   - .gitignore: add these lines (copy Circuit Sort's allow-list):
       android/build/**
       !android/build/build.gradle
       !android/build/config.gradle
       !android/build/settings.gradle
       !android/build/gradle.properties
       !android/build/proguard-rules.pro
       !android/build/res/
       !android/build/res/**
       !android/build/src/
       !android/build/src/**
     Also add:
       android/*.keystore
       .godot/export_credentials.cfg
       android/build/google-services.json
     REPLACE the wrong entry `android/app/google-services.json` with `android/build/google-services.json`. This repo is PUBLIC, so google-services.json stays out of git.
   - config.gradle: compileSdk 36, targetSdk 36, minSdk 24, buildTools 36.1.0, ndkVersion 29.0.14206865 (Circuit Sort values).
   - build.gradle:
     - Copy Circuit Sort's google-services guard, but with release package "com.stimpad.soundboard".
     - Copy its release buildType (minifyEnabled true, shrinkResources true, proguard-rules.pro). Copy proguard-rules.pro.
     - Add exactly these dependencies (Circuit Sort versions):
         implementation "com.google.android.gms:play-services-ads:25.4.0"
         implementation "com.google.android.ump:user-messaging-platform:4.0.0"
         implementation "com.unity3d.ads:unity-ads:4.18.0"
         implementation "com.google.ads.mediation:unity:4.18.0.0"
         implementation platform("com.google.firebase:firebase-bom:34.4.0")
         implementation "com.google.firebase:firebase-analytics"
         implementation "com.google.android.play:review:2.0.2"
         implementation "com.android.billingclient:billing-ktx:8.3.0"
     - Do NOT add play-services-games-v2 or app-update.
   - android/build/src/main/AndroidManifest.xml (start from Circuit Sort's):
     - uses-permission com.android.vending.BILLING.
     - uses-permission com.google.android.gms.permission.AD_ID (Play Console declares that the app uses advertising ID; releases targeting Android 13+ are blocked without it).
     - meta-data com.google.android.gms.ads.APPLICATION_ID = "ca-app-pub-5356882403986713~7546788183" (StimPad Android AdMob app) with tools:replace="android:value".
     - meta-data com.google.android.gms.ads.DELAY_APP_MEASUREMENT_INIT=true.
     - Activity .GodotApp: screenOrientation="portrait", resizeableActivity="true".
     - REMOVE android:isGame / appCategory="game" (StimPad is not a game; use appCategory="audio" or omit).
     - No Play Games meta-data, no notification receivers, no POST_NOTIFICATIONS.
   - GodotApp.java: copy Circuit Sort's GodotApp minus every PlayGamesSignInBridge / InAppUpdateBridge call. Keep SplashScreen.installSplashScreen, EdgeToEdge.enable(this), static getInstance(), and updateWindowAppearance in onResume / onGodotMainLoopStarted.
   - Copy DeviceLayoutBridge.java unchanged (package com.godot.game).

3. Export presets (export_presets.cfg)
   Replace the current minimal "Android" preset with two presets shaped like Circuit Sort's.

   a) name="Android (Play Store .aab)", export_path="build/StimPad.aab":
      gradle_build/use_gradle_build=true
      gradle_build/export_format=1
      gradle_build/target_sdk="36"
      architectures/arm64-v8a=true
      architectures/armeabi-v7a=false
      version/code=1000500
      version/name="<same as application/config/version>"
      package/unique_name="com.stimpad.soundboard"
      package/name="StimPad"
      package/signed=true
      screen/immersive_mode=true
      screen/edge_to_edge=false        (EdgeToEdge comes from GodotApp.java)
      screen/support_small/normal/large/xlarge=true
      permissions/internet=true
      permissions/access_network_state=true
      permissions/vibrate=true          (HapticsService uses Input.vibrate_handheld; currently missing)
      permissions/post_notifications=false
      user_data_backup/allow=false
      launcher_icons/main_192x192, adaptive_foreground_432x432, adaptive_background_432x432, adaptive_monochrome_432x432 → res://assets/branding/android/*.png
      exclude_filter = the current filter + ",ios/*,addons/GodotFirebaseiOS/*"

   b) name="Android APK (device test)": same as (a) but export_format=0, export_path="build/StimPad.apk", runnable=true.

   - Generate the adaptive icons from assets/branding/icon_1024.png with a small node or python script in tools/ (sharp is already used under tools/):
     - foreground: logo inside the centre 66% of 432x432, transparent;
     - background: solid #1A2230;
     - monochrome: white silhouette on transparent.
   - Keep the iOS preset untouched.
   - Version scheme: versionCode = MAJOR*1000000 + MINOR*10000 + PATCH*100 + rebuild. Add tools/bump_android_version_code.py that reads application/config/version and sets version/code and version/name in BOTH Android presets. It takes an optional rebuild number arg (default 0).

4. Android back button (W4D AppRoot pattern)
   - project.godot: application/config/quit_on_go_back=false.
   - In scripts/ui/main.gd add _notification(what) for NOTIFICATION_WM_GO_BACK_REQUEST, in this order:
     1) If the enjoy prompt or a feature tip overlay is visible, close it. Use their existing dismiss paths (EnjoyPromptService / FeatureTipService); find the overlay nodes, don't guess names.
     2) If _current_screen is _player (call its close_preview() first if previewing), _paywall, _settings or _feedback → go home WITHOUT counting a safe exit for interstitials. Factor show_home() into show_home(count_safe_exit := true) and pass false here.
     3) If home → get_tree().quit().
   - Mark the input handled. Do nothing on iOS (the notification never fires there).

5. Safe areas / banner on Android
   - In scripts/autoload/ads_service.gd _initialize_ads(): set `_admob.banner_anchor_to_safe_area = Platform.is_android()`. Keep false on iOS.
     Copy Circuit Sort's comment: "Must stay true on Android. GodotApp always calls EdgeToEdge.enable(), so a BOTTOM banner with safe-area off sits under the nav/gesture bar: AdMob counts the request, never the impression."
   - Confirm scripts/ui/responsive.gd has px_to_viewport() from the retention branch (safe area is in screen pixels). If missing, port it.
   - On Android, when the banner is anchored to the safe area, main.gd _update_banner_inset() must ALSO reserve the bottom system inset under the banner.
     Compute it from DisplayServer.get_display_safe_area() vs DisplayServer.window_get_size() in viewport units.
     Use DeviceLayoutBridge.hasOnScreenNavButtons() via JavaClassWrapper.wrap("com.godot.game.DeviceLayoutBridge"), as Circuit Sort ad_handler.gd _has_on_screen_nav_buttons() does, to decide whether a 3-button bar needs extra gap.

6. Local build helper
   - tools/android_build.ps1 (Brock builds on Windows like Circuit Sort/W4D). It:
     - checks android/build/google-services.json exists;
     - checks the env vars GODOT_ANDROID_KEYSTORE_RELEASE_PATH / _USER / _PASSWORD are set;
     - runs `godot --headless --export-release "Android (Play Store .aab)" build/StimPad.aab`.
   - Document it in docs/ANDROID_EXPORT.md. Rewrite that doc to match reality: package, presets, the keystore location android/stimpad-upload.keystore (gitignored), the google-services path, the versionCode formula.

7. GitHub Actions: .github/workflows/android-play.yml (NEW; neither reference repo has one, so model it on our own .github/workflows/ios-testflight.yml)
   - Trigger: workflow_dispatch with inputs:
       upload_to_play (boolean, default false)
       track (choice: internal / alpha, default internal)   (alpha = closed testing)
       rebuild (string, default "0")
   - Release rule (README): store builds only come from main. Add a first step to every job that FAILS unless github.ref == refs/heads/main, and check out main explicitly, the same as the iOS workflows (commit 196ca29).
   - Job preflight (ubuntu-latest):
     - Validate secrets ANDROID_KEYSTORE_BASE64, ANDROID_KEYSTORE_PASSWORD, ANDROID_KEY_ALIAS, GOOGLE_SERVICES_JSON_BASE64; PLAY_SERVICE_ACCOUNT_JSON only when upload_to_play.
     - grep export_presets.cfg for name="Android (Play Store .aab)", package/unique_name="com.stimpad.soundboard", permissions/vibrate=true, gradle_build/export_format=1.
     - FAIL if scripts/autoload/ads_service.gd still has PROD_APP_ID_ANDROID := "" or the Google test app id in addons/AdmobPlugin/android_export.cfg [Release]. Make this a warning when upload_to_play is false.
     - Fail if any *.keystore, google-services.json or export_credentials.cfg is tracked.
   - Job build-android (ubuntu-latest, timeout 60, env GODOT_VERSION "4.6.3"):
     - actions/setup-java@v4 temurin 17.
     - android-actions/setup-android@v3, then `sdkmanager "platforms;android-36" "build-tools;36.1.0" "ndk;29.0.14206865"`.
     - Download Godot_v${GODOT_VERSION}-stable_linux.x86_64.zip and _export_templates.tpz from godotengine/godot-builds (same URLs as ios-testflight.yml). Put the templates in ~/.local/share/godot/export_templates/${GODOT_VERSION}.stable/.
     - Write ~/.config/godot/editor_settings-4.6.tres with export/android/android_sdk_path=$ANDROID_HOME and export/android/java_sdk_path=$JAVA_HOME.
     - Template install without clobbering our overrides:
       1. Move the committed android/build/{build.gradle,config.gradle,settings.gradle,gradle.properties,proguard-rules.pro,res,src} to $RUNNER_TEMP/overrides.
       2. rm -rf android/build.
       3. godot --headless --path . --install-android-build-template.
       4. Copy the overrides back.
     - Decode GOOGLE_SERVICES_JSON_BASE64 → android/build/google-services.json. Decode ANDROID_KEYSTORE_BASE64 → $RUNNER_TEMP/upload.keystore.
     - Export GODOT_ANDROID_KEYSTORE_RELEASE_PATH / _USER (alias) / _PASSWORD.
     - Run tools/bump_android_version_code.py with inputs.rebuild.
     - godot --headless --path . --import || true
     - godot --headless --path . --export-release "Android (Play Store .aab)" build/StimPad.aab
     - Verify: test -f build/StimPad.aab; unzip -l to check base/lib/arm64-v8a/libgodot_android.so exists and there is no armeabi-v7a.
     - Run bundletool build-apks --mode=universal, then zipalign -c -P 16 -v 4 on the universal APK, and print the result. 16 KB page check; warn only.
     - Upload artifact StimPad-aab (retention 7).
     - If inputs.upload_to_play: r0adkll/upload-google-play@v1 with serviceAccountJsonPlainText=${{ secrets.PLAY_SERVICE_ACCOUNT_JSON }}, packageName com.stimpad.soundboard, releaseFiles build/StimPad.aab, track ${{ inputs.track }}, status draft.
       Add a comment: the FIRST release of a new Play app must be uploaded by hand in Play Console; the API cannot create it. While the app is unpublished, releases must be status draft.
   - Update docs/GITHUB_SECRETS.md with the new secrets and PowerShell base64 commands, in the same style as the iOS section.

Constraints
- Do not change iOS behaviour. The iOS preset, ios-testflight.yml and ATT flow stay identical.
- No new permissions beyond those listed. No POST_NOTIFICATIONS. No foreground service.
- Never commit keystores, google-services.json or credentials.
- Keep the diff reviewable. Show me the diff before committing.

When done, give me this real-Android-phone test checklist and the exact commands to sideload:
- [ ] `adb install -r build/StimPad.apk` (APK preset) launches, splash → home grid, no crash for 2 min
- [ ] Logo/top bar clear of the status bar and punch-hole; bottom content clear of gesture bar AND of 3-button nav (Settings → Display → Navigation bar)
- [ ] Tap a free sound → plays; pitch slider, Head Floss (headphones: L↔R sweep), repeat, sleep timer chips all work
- [ ] Haptics buzz on tile tap when Settings → Haptics is on; nothing when off
- [ ] Back: Player→Home, Settings→Home, Paywall→Home, Feedback→Home, Home→app closes; no interstitial triggered by Back
- [ ] Rotate / split-screen / tablet (if available): layout stays portrait and grid reflows
- [ ] App icon: adaptive shape on launcher; themed icon (Android 13+) shows the monochrome mark
- [ ] AAB built locally with tools/android_build.ps1; manual upload to Play Console Internal testing accepted (no 16 KB / targetSdk / permission warnings)
- [ ] GitHub Action "android-play" green with upload_to_play=false; artifact downloads
```

---

## Prompt 2: Google Play Billing for StimPad Plus + restore

```
StimPad (Godot 4.6.3, repo OrehRuoy/StimpadCode) now exports to Android (Prompt 1 is done; Platform autoload exists). Wire Google Play Billing for the single non-consumable "StimPad Plus". Mirror Circuit Sort's ShopService exactly.

PRICE (decided): same as iOS. The app is free to download, and StimPad Plus is a US $4.99 non-consumable one-time product with the SAME product ID as iOS: com.stimpad.soundboard.plus. Brock creates it in Play Console (Monetize → Products → One-time products) and activates it. Never consume it; always acknowledge.

Reference (read-only): OrehRuoy/CircuitSortCode
- addons/GodotGooglePlayBilling/ (plugin.cfg version="3.2.0", BillingClient.gd, export_plugin.gd, bin/debug|release/*.aar; dependency com.android.billingclient:billing-ktx:8.3.0)
- autoload/shop_service.gd: _ready() Android branch, _on_billing_connected(), _run_billing_setup(), _handle_purchase(), _acknowledge_purchase_then_finish(), _extract_formatted_price(), _on_purchase_updated(), _monitor_purchase_timeout().
If you cannot read it, ask me to copy those into _ref/.

StimPad files you will change:
- scripts/autoload/iap_service.gd. Signals purchase_started/completed/failed, purchase_restored(product_ids), display_price_updated. PRODUCT_ID "com.stimpad.soundboard.plus". iOS uses ios/store_kit_client.gd. Android currently hits _request_purchase_native() ("IAP not linked") and _restore_purchases_native() (empty restore). Branch helpers: has_live_price(), get_price_value(), get_currency_code(), get_last_transaction_id(), _purchase_requested, _restore_requested.
- scripts/autoload/entitlements.gd: _on_purchase_completed / _on_purchase_restored → grant_plus(); logs "purchase" + "plus_unlocked".
- scripts/ui/paywall_screen.gd: _on_restore() has an iOS-only "Checking your purchases…" text; _price_copy().
- scripts/ui/settings_screen.gd: _on_restore().
- project.godot editor_plugins.

Do this:
1. Vendor addons/GodotGooglePlayBilling 3.2.0 from Circuit Sort unchanged. Enable it in project.godot editor_plugins. billing-ktx:8.3.0 is already in android/build/build.gradle from Prompt 1. Keep one copy only and confirm no duplicate-class error.

2. In iap_service.gd add an Android path. Use Platform.is_android() and keep all iOS code paths byte-identical.
   - _initialize_store(): on Android create BillingClient (class_name from BillingClient.gd), add_child, connect connected / connect_error / on_purchase_updated, then start_connection(). Defer the first connection until the main UI is up: call ensure_store_started() from Main after the boot overlay fades, like AdsService.notify_ui_ready(). Don't connect during the cold-start texture spike.
   - On connected, do what Circuit Sort's _run_billing_setup() does:
     - query_purchases(BillingClient.ProductType.INAPP) → for each purchase containing PRODUCT_ID:
       - if purchase_state != PURCHASED (PENDING): skip and emit nothing. Circuit Sort does not check this; we must.
       - if not is_acknowledged → acknowledge_purchase(token); on OK → purchase_restored.emit([PRODUCT_ID]).
       - if already acknowledged → purchase_restored.emit([PRODUCT_ID]).
       On Play an owned purchase is proof of ownership, so the branch's _restore_requested gate (made for StoreKit replays) must NOT block Android.
     - query_product_details([PRODUCT_ID], INAPP) → price from one_time_purchase_offer_details.formatted_price (port _extract_formatted_price). Set _display_price, _has_live_price = true, and emit display_price_updated.
     - Store price_amount_micros / 1e6 and price_currency_code so get_price_value() / get_currency_code() work on Android.
   - purchase_plus() on Android: if billing isn't ready → purchase_failed(tr("Google Play not ready yet")). Else _billing.purchase(PRODUCT_ID); if the response_code isn't OK → fail. Arm a 90 s timeout (port _monitor_purchase_timeout).
   - _on_purchase_updated(result):
     - USER_CANCELED → purchase_failed(tr("Purchase canceled")).
     - ITEM_ALREADY_OWNED → run the restore query.
     - OK → for each purchase with PURCHASED state: acknowledge if needed, THEN purchase_completed.emit(PRODUCT_ID). Save the orderId as the last transaction id.
     - PENDING → purchase_failed(tr("Payment pending — Plus unlocks when Google Play confirms it")) and keep listening.
   - restore_purchases() on Android: re-run query_purchases. If nothing is owned, emit purchase_restored([]) and let the paywall show tr("No purchase found for this Google account.").
     Make paywall_screen.gd _on_restore() show "Checking your purchases…" on Android too, with the store-specific not-found text.
   - get_last_transaction_id(), get_price_value(), get_currency_code(): return Android values when on Android.
   - Desktop/editor stub behaviour stays as it is.

3. Store-specific copy: wherever the paywall/settings say "App Store" or "Apple ID", use Platform.store_name() / Platform-based tr() strings. Add new strings to locale/messages.json (en + es + fr + pt_BR, following the existing entries).

4. Never grant Plus on connect_error or timeout. Never consume (this is not a consumable).

5. Docs: docs/PLUGIN_SETUP.md "IAP — StimPad Plus" → add the Android section: product id, plugin version, license testers, "products only load from a Play-installed build on a track".

Constraints: iOS unchanged; no server verification; keep the diff small. Show me the diff before committing.

Real Android phone test checklist (install from the Play INTERNAL testing track with a License-tester account; sideloaded APKs can't see products):
- [ ] Paywall shows the localized Play price (not the $4.99 fallback) within ~3 s of opening
- [ ] Buy → Google Play sheet → "Test card, always approves" → Plus unlocks: all 95 sounds open, banner disappears, no interstitials/rewarded offered
- [ ] Play Console → Order management shows the test order; after 5 min it is still not refunded (acknowledged)
- [ ] "Test card, always declines" → friendly failure, Plus stays off
- [ ] Cancel the sheet → "Purchase canceled", no stuck spinner
- [ ] "Slow test card" (pending) → pending message; Plus unlocks only after Play confirms
- [ ] Clear app data / reinstall → Plus comes back automatically on launch (silent query) AND via Settings → Restore
- [ ] Second device with the same Google account → Restore unlocks Plus
- [ ] Airplane mode → Buy shows "Google Play not ready yet", nothing crashes
- [ ] adb logcat shows no BillingClient errors at cold start; app start time not noticeably slower
```

---

## Prompt 3: AdMob Android + UMP consent (ConsentBridge) + in-app review

```
StimPad (Godot 4.6.3, OrehRuoy/StimpadCode), Android build working (Prompts 1–2 done). Make ads, consent and review production-ready on Android. Mirror Circuit Sort's Android implementation; leave iOS exactly as it is.

Reference (read-only): OrehRuoy/CircuitSortCode
- android/build/src/main/java/com/godot/game/ConsentBridge.java: gatherConsent() runs UMP on the Android MAIN thread. Its comment: "The AdMob Godot plugin calls requestConsentInfoUpdate from Godot's thread, and UMP then refuses it" so the EU form never opens.
  API: getGatherState() 0/1/2, getGatherError(), allowsAdRequests(), getConsentStatusName(), isPrivacyOptionsRequired(), hasAdsConsent(), showPrivacyOptionsForm(), getPrivacyFormState(), clearPrivacyFormState().
- autoload/ad_handler.gd: _consent_bridge(), _begin_android_gather(), _poll_android_gather(), _finish_android_gather(), _poll_android_privacy_form(), _present_required_consent_form() and the comment "UMP before MobileAds.initialize(). Initializing first lets the SDK and Unity prefetch in the EEA/UK; those requests match and do not show."
- android/build/src/main/java/com/godot/game/InAppReviewBridge.java (requestReview(), takeReviewFlowFinishedFlag()) and autoload/in_app_review.gd (fallback option).
- addons/AdmobPlugin/android_export.cfg ([Debug]/[Release] app_id, [Mediation] enabled_networks=PackedStringArray("unity")).
Ask me to copy them into _ref/ if you can't read them.

StimPad files:
- scripts/autoload/ads_service.gd:
  - PROD_*_ANDROID constants are empty today and Android falls back to GOOGLE_TEST_APP_ID.
  - _initialize_ads(), _begin_mobile_ads_initialization(), _start_ump_consent_flow(), _on_consent_info_updated(), privacy_choices_available(), open_privacy_choices_from_settings(), _apply_mediation_and_request_config().
  - iOS order today: ATT → initialize() → UMP → _serve_ads_now().
  - (Branch) rewarded = one ad per day unlocks every sound for 20 minutes (Entitlements.grant_library_unlock / can_start_library_unlock).
- addons/AdmobPlugin/android_export.cfg (currently the Google test app id).
- android/build/src/main/AndroidManifest.xml (APPLICATION_ID meta-data from Prompt 1).
- scripts/ui/settings_screen.gd: _refresh_ad_privacy_btn(), _on_ad_privacy().
- scripts/autoload/review_service.gd:
  - Branch: request_review(); iOS uses the Engine singleton "InappReviewPlugin".launch_review_flow().
  - Android: _request_android() → _inapp_review / "GodotInAppReview" singleton → else Play URL.
- addons/InappReviewPlugin/ (v5.2, ships bin/debug|release AARs, deps androidx.appcompat:appcompat:1.7.1 + com.google.android.play:review:2.0.2).

Do this:
1. IDs (real production IDs from Brock's AdMob account; use exactly these):
   PROD_APP_ID_ANDROID       := "ca-app-pub-5356882403986713~7546788183"
   PROD_BANNER_ANDROID       := "ca-app-pub-5356882403986713/6529044973"
   PROD_INTERSTITIAL_ANDROID := "ca-app-pub-5356882403986713/9366961309"
   PROD_REWARDED_ANDROID     := "ca-app-pub-5356882403986713/8333081239"
   - Put the same app id in addons/AdmobPlugin/android_export.cfg [Debug] and [Release] (replacing the Google test id ca-app-pub-3940256099942544~3347511713), and confirm AndroidManifest.xml APPLICATION_ID already has it (Prompt 1).
   - The AdMob Android app is not linked to a store yet. Brock links it in AdMob (App settings → Add store) after the Play launch. Until then AdMob shows it as unlinked and may limit fill; ads still serve to test devices. After linking, app-ads.txt verification starts. Don't add code for this; just put a one-line comment next to the constants.
   - Keep `_admob.is_real = not OS.is_debug_build()`.
   - If PROD_APP_ID_ANDROID is empty or the Google test id in a release build, push_error and do not request ads. The CI guard from Prompt 1 also fails.
   - Keep android_debug_application_id = PROD app id (Google wants the real app id even with demo units, like the iOS lines).

2. Consent order on Android (UMP BEFORE initialize):
   - Copy ConsentBridge.java into android/build/src/main/java/com/godot/game/. It needs GodotApp.getInstance() from Prompt 1.
   - In _initialize_ads():
     - if Platform.is_android(): after the existing 1.2 s settle, call _begin_android_consent_gather() instead of _begin_mobile_ads_initialization().
     - iOS path untouched.
   - _begin_android_consent_gather():
     - wrap "com.godot.game.ConsentBridge" via JavaClassWrapper (cache it, check JavaClassWrapper.get_exception());
     - call gatherConsent(); set_process(true); poll getGatherState() each frame until 2 (port _poll_android_gather);
     - 12 s fail-safe timer.
   - When done:
     - if allowsAdRequests(): _apply_mediation_and_request_config() with gdpr_ok = hasAdsConsent(), then _begin_mobile_ads_initialization(). After initialization_completed, go straight to _serve_ads_now(). Do NOT call _admob.update_consent_info() on Android.
     - if not allowsAdRequests(): do not initialize, do not request. Keep the banner slot collapsed (banner_reserved_height() = 0), hide Watch Ad, and log ads_blocked_by_consent.
     - on timeout or bridge missing: same as "not allowed" for EEA safety. Log the reason. (Circuit Sort: never request ads while consent is UNKNOWN/REQUIRED.)
   - privacy_choices_available() on Android → bridge.isPrivacyOptionsRequired().
   - open_privacy_choices_from_settings() on Android → bridge.showPrivacyOptionsForm(), then poll getPrivacyFormState()==2 → clearPrivacyFormState() → re-apply request config. If consent now allows ads and the SDK isn't initialized, initialize and serve.
   - Make the polling share one _process with any existing processing in AdsService; don't break the banner keep-alive timers.

3. Banner:
   - Confirm `banner_anchor_to_safe_area = Platform.is_android()` from Prompt 1.
   - After interstitial/rewarded dismiss on Android, re-show via keep_banner_visible() (already wired).
   - Leave max_ad_content_rating = T.
   - The target audience is 13+ (decided), so there are no child-directed tags.

4. Unity mediation (decided: KEEP)
   - Keep MediationNetwork.Flag.UNITY and the [Mediation] block in addons/AdmobPlugin/android_export.cfg.
   - addons/AdmobPlugin/model/MediationNetwork.gd injects unity-ads 4.16.2 / mediation unity 4.16.3.0. build.gradle pins 4.18.0 / 4.18.0.0 (Circuit Sort). Confirm Gradle resolves 4.18 with no duplicate-class error (`./gradlew :app:dependencies` in android/build, or read the export log).
   - No Unity Game ID or placement IDs go in code; they live in the AdMob mediation groups that Brock creates.
   - Add a comment above enabled_networks saying so, and a short docs/PLUGIN_SETUP.md note: Unity fills only after AdMob → Mediation groups (Android + iOS) have the Unity Ads source with Game ID + placement IDs.

5. In-app review on Android:
   - Enable addons/InappReviewPlugin for Android export. It's an EditorExportPlugin with AndroidExportPlugin, so it activates once the plugin is enabled. Confirm the AAR is in the AAB.
   - Drop the duplicate com.google.android.play:review line from build.gradle only if Gradle reports a conflict. Same version 2.0.2, so normally harmless.
   - review_service.gd _request_android(): if Engine.has_singleton("InappReviewPlugin"): Engine.get_singleton("InappReviewPlugin").launch_review_flow(), log review_request_attempted {method:"inapp_plugin", os:"android"}, return true. Else keep the existing fallbacks, then the Play URL.
   - Fallback only if the plugin can't be made to work: port Circuit Sort InAppReviewBridge.java and call InAppReviewBridge.requestReview() via JavaClassWrapper.
   - Never tie the in-app review to the Settings "Rate StimPad" button; that keeps opening the Play listing URL.

6. app-ads.txt: add docs/APP_ADS_TXT.md telling Brock to serve `google.com, pub-5356882403986713, DIRECT, f08c47fec0942fa0` at the root of his Play "developer website" domain.

Constraints: iOS untouched (ATT → init → UMP); no new permissions; small diff. Show me the diff before committing.

Real Android phone test checklist (install from the Internal testing track; add the phone as an AdMob test device first):
- [ ] US/non-EEA: no consent form; banner appears at the bottom, fully above the gesture bar / 3-button nav, with no gap or overlap with the now-playing bar
- [ ] EEA test (UMP debug geography EEA via test device hash, or VPN + fresh install): consent form shows BEFORE any ad request (logcat: no "Ad request" lines before consent)
- [ ] EEA "Consent" → ads load; EEA "Do not consent" / "Manage options → reject" → no ad requests, banner slot collapsed, app fully usable
- [ ] Settings → "Manage Ad Consent" appears only in EEA; opens the form; changing the choice takes effect without a restart
- [ ] Interstitial: at most every 3rd Home/Settings exit, ≥90 s apart, never while a sound plays, never from the Back button
- [ ] Paywall → Watch Ad → rewarded plays → all sounds unlock for 20 min with countdown; second attempt same day → "Come back tomorrow or get Plus"
- [ ] Quit the ad early → no unlock, clear message
- [ ] Buy Plus → banner gone immediately, no more ads that session and after restart
- [ ] Enjoying StimPad? → Yes → Google Play review sheet (may not show if quota hit; must not open the browser); Settings → Rate StimPad opens the Play listing
- [ ] AdMob console: Android banner impressions > 0 within a day; no "invalid traffic" warnings
```

---

## Prompt 4: Firebase Analytics (Android), haptics tuning, audio focus/background behaviour

```
StimPad (Godot 4.6.3, OrehRuoy/StimpadCode), Android build with billing, ads and consent done (Prompts 1–3). Finish platform services: Firebase Analytics on Android, Android-tuned haptics, and predictable audio when the app loses focus. After this prompt, Brock cuts the first closed-test build (C1), so keep it tight.

Reference (read-only): OrehRuoy/CircuitSortCode
- android/build/src/main/java/com/godot/game/FirebaseAnalyticsBridge.java:
  - logEventJson(payload) takes ONE JSON string {"event":…,"params":{…}}, because Godot's JavaClassWrapper drops a second string arg.
  - setUserPropertyJson(payload); shouldTrackAnalytics() returns false for *.debug app ids and emulators.
  - ANALYTICS_EXCLUDED_ANDROID_IDS blocklist.
- autoload/analytics.gd: _BRIDGE_CLASS_NAME "com.godot.game.FirebaseAnalyticsBridge", _ensure_bridge(), _encode_event_payload(), _encode_params_json(), _GA4_STRING_DIMENSIONS quoting, _sanitize_name().
- android/build/build.gradle: firebase-bom 34.4.0 + firebase-analytics, and the google-services guard (done in Prompt 1).
Ask me to copy them into _ref/ if you can't read them.

StimPad files:
- scripts/autoload/analytics_service.gd:
  - log_event, log_screen, log_sound_play (sound_play + select_content with sound_id, sound_name, category, tier, mode, content_type, item_id), log_sound_stop (duration_sec).
  - _initialize_analytics() / _resolve_native(): today only /root/FirebaseIOS. The branch adds queue-until-ready.
- scripts/autoload/haptics_service.gd: TAP_MS 18, PLAY_MS 28, Input.vibrate_handheld(duration_ms).
- scripts/autoload/audio_controller.gd: _notification handles APPLICATION_RESUMED / FOCUS_IN → _check_stop_deadline(); play_sound / stop / play_preview / end_preview.
- project.godot [audio]: iOS session_category/mix_with_others comment ("Godot 4.6 still stops the audio driver when the app backgrounds").

Do this:
1. Firebase Analytics on Android
   - Copy FirebaseAnalyticsBridge.java into android/build/src/main/java/com/godot/game/ unchanged, except the TAG and an empty ANALYTICS_EXCLUDED_ANDROID_IDS with a comment telling Brock how to add his phone (`adb shell settings get secure android_id`).
   - analytics_service.gd:
     - On Platform.is_android(): _resolve_native() wraps "com.godot.game.FirebaseAnalyticsBridge" via JavaClassWrapper (check get_exception()).
     - _log_event_native() on Android sends the single JSON payload, built exactly like Circuit Sort's _encode_event_payload / _encode_params_json. Quote string dimensions: sound_id, sound_name, category, tier, mode, content_type, item_id, screen_name, product_id, source, method, os.
     - Keep the iOS FirebaseIOS path byte-identical.
     - Android has no 10 s deferred init like iOS. Initialize after the boot overlay fades (same moment AdsService.notify_ui_ready() fires) and keep the branch's queue so early plays still send.
   - Add AnalyticsService.set_user_property(name, value) (Android → setUserPropertyJson; iOS → FirebaseIOS analytics if it exposes set_user_property, else no-op). Set "platform" = Platform.store_name() and "app_build" = AppInfo.build_number() once at init.
   - No AD_ID / consent changes here. Firebase Analytics runs under the same UMP consent Circuit Sort ships with.

2. Haptics
   - haptics_service.gd: keep the API (tap(), play()). On Android use TAP_MS 25 and PLAY_MS 35, and call Input.vibrate_handheld(ms, amplitude) with amplitude 0.5 for tap and 0.8 for play (Godot 4.6 signature; check it). iOS values unchanged.
   - Confirm permissions/vibrate=true is in both Android presets (Prompt 1).

3. Audio when focus is lost (PLAN D4 = option A: no background playback on Android)
   - Stock Godot 4.6 pauses the Android audio driver on focus-out (AudioDriverOpenSL::set_pause). Do NOT add a foreground service or new permissions.
   - In audio_controller.gd, on NOTIFICATION_APPLICATION_FOCUS_OUT / PAUSED record _paused_by_os = is_playing().
     On FOCUS_IN / RESUMED: run _check_stop_deadline() first. If the sleep timer expired while away, stop() and emit playback_finished (existing behaviour). Otherwise the driver resumes on its own; make sure the now-playing bar and player button show the right state.
     Log analytics "playback_interrupted" {sound_id, reason:"focus_out"} once per interruption.
   - Optional but recommended: AudioNoisyBridge.java (com.godot.game).
     - Register a BroadcastReceiver for AudioManager.ACTION_AUDIO_BECOMING_NOISY in GodotApp.onResume, unregister in onPause.
     - Set a volatile flag; expose takeNoisyFlag().
     - audio_controller polls it ~4×/s on Android only while playing → stop().
     - This stops a loop from switching to the speaker when headphones are unplugged.
   - Do not request audio focus (StimPad mixes with other audio like iOS mix_with_others=true). Add a comment saying so.

4. Docs: docs/PLUGIN_SETUP.md
   - Firebase: add an Android section (google-services.json at android/build/, CI secret GOOGLE_SERVICES_JSON_BASE64, DebugView via `adb shell setprop debug.firebase.analytics.app com.stimpad.soundboard`).
   - Add "Background audio: not supported on Android or iOS with stock Godot 4.6".

Constraints: iOS behaviour unchanged; no new permissions; no new SDKs. Show me the diff before committing.

Real Android phone test checklist:
- [ ] `adb shell setprop debug.firebase.analytics.app com.stimpad.soundboard`, then open the app → Firebase DebugView shows screen_view(home), then sound_play with sound_id + sound_name + category + tier + mode, select_content, sound_stop with duration_sec
- [ ] GA4 user property platform=play is set
- [ ] Buy/restore Plus (license tester) → purchase (with real value + currency) and plus_unlocked appear
- [ ] Debug APK built with the .debug package (if added) sends NOTHING (logcat "Analytics disabled (debug application id)")
- [ ] Haptics noticeable but not harsh on tile tap and Play; off when the toggle is off; check a Samsung + a Pixel if possible
- [ ] Play a loop, press power → audio stops; unlock within the timer → state is correct (playing resumes or the UI shows stopped; no "ghost playing" UI)
- [ ] Set 15-min sleep timer, lock the phone for 16 min, unlock → session ended, now-playing bar gone
- [ ] Headphones in, play a loop, unplug/disconnect BT → sound stops (if the noisy bridge was added)
- [ ] Spotify playing + StimPad sound → both audible (mixing), and nothing crashes on an incoming call / alarm
- [ ] Cold start to home < 3 s on a mid-range phone; no ANR in Play Console pre-launch report
```

---

## Prompt 5: QA pass, store prep, docs (no SDK changes)

```
StimPad (Godot 4.6.3, OrehRuoy/StimpadCode). The Android port is functionally complete (Prompts 1–4). This prompt is release hygiene for the Play closed test (12+ testers × 14 days). Make NO new SDK, permission or architecture changes. Fixes only.

Do this:
1. Docs
   - Fix the docs that drift from the code:
     - docs/STORE_SETUP_CHECKLIST.md says "Free tier: 8 sounds" (code: 14 of 95) and "30s/1m/5m timer" (code: 15/30/60 min);
     - docs/ANDROID_EXPORT.md says support_large/xlarge are enabled (now true; confirm);
     - README.md says "iOS-first, Android-ready" → describe both.
   - Add an "Android" section to docs/STORE_SETUP_CHECKLIST.md mirroring Phase 4 there, with real items checked.
   - Add docs/PLAY_STORE.md modeled on Whats4dinnerCode/docs/PLAY_STORE.md: presets, keystore, versionCode formula (MAJOR*1000000+MINOR*10000+PATCH*100+rebuild), "uncheck Export with debug" for production ads, internal → closed → production, the first-upload-by-hand rule.
2. Store copy (store/play/, gitignored from export like store/* already is):
   - listing_en-US.md (do NOT copy the iOS "layer two loops" claim; the app can't layer): title "StimPad - Stimming Soundboard" (≤30), short description (≤80), full description (≤4000). No medical/therapy claims, no "lock-screen/background playback" claim, no claims about children unless Brock chose a kids audience.
   - data_safety.md: the table from PLAN.md §3.14 (AdMob, Unity if kept, Firebase, Web3Forms feedback; encrypted in transit; no account; data not sold).
   - content_rating.md (IARC answers), target_audience.md (13+, decided; not Families), release_notes_c1.txt (≤500 chars).
3. Privacy policy: update privacy-site/privacy-policy.html to name Google Play, Google Play Billing, AdMob/UMP on Android, Firebase Analytics on Android, the advertising ID, and the feedback form. Keep the iOS content.
4. Store graphics checklist in store/play/ASSETS.md:
   - 512×512 icon;
   - 1024×500 feature graphic;
   - 4–8 phone screenshots 1080×1920 (home grid, player with Head Floss, sleep timer, paywall);
   - 7" + 10" tablet screenshots;
   - adaptive-icon preview.
   Add tools/play_screenshot_frames.js only if trivial (reuse the sharp patterns in tools/); otherwise list the manual steps.
5. Repo hygiene: delete the duplicate addons/AdmobPlugin/bin/bin/ (keep addons/AdmobPlugin/bin/debug|release). Confirm .gitignore covers *.keystore, export_credentials.cfg and android/build/google-services.json, and that `git ls-files` shows none of them.
6. Copy PLAN's QA checklist into docs/ANDROID_QA.md (it's in the planning folder as QA-CHECKLIST.md; I'll paste it if you don't have it).
7. Bump to the C1 version with tools/bump_android_version_code.py (rebuild 0) and show the resulting version/code.

Show me the diff before committing.

Real Android phone test checklist (final pre-closed-test gate):
- [ ] Run every section of docs/ANDROID_QA.md on at least: one Pixel (gesture nav), one Samsung (3-button nav), one tablet or foldable
- [ ] Play Console pre-launch report: 0 crashes, 0 ANRs, no accessibility "touch target" errors on the main grid
- [ ] App bundle explorer: 16 KB page support = yes; arm64-v8a only; download size noted in docs/PLAY_STORE.md
- [ ] Policy status page: no warnings for Data safety, Ads declaration, Target audience, Health declaration, Permissions
- [ ] Closed testing track has the C1 release + tester list; Tess has the opt-in URL
```
