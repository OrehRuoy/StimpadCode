# Plugin Setup — StimPad

Bundle ID: `com.stimpad.soundboard`

## AdMob (banner + interstitial + rewarded)
Use **AdmobPlugin Multi v6.0** (same as OrehRuoy/Whats4dinnerCode):
1. Download [AdmobPlugin-Multi-v6.0.zip](https://github.com/godot-sdk-integrations/godot-admob/releases/tag/v6.0)
2. Extract to project root (`addons/AdmobPlugin`, `ios/plugins/`, `android/plugins/`)
3. Enable in Project → Project Settings → Plugins
4. Run `scripts/setup_ios_admob_frameworks.sh` before iOS export (CI does this)
5. Production unit IDs live in `scripts/autoload/ads_service.gd` (`PROD_*`). Debug device builds still use Google demo units; release uses production (`is_real = not OS.is_debug_build()`).

**Consent init order (iOS + Android):** ATT (iOS) → `MobileAds.initialize()` → UMP consent form if required → load ads. Never call UMP or request ads before `initialize()`. Implemented in `scripts/autoload/ads_service.gd`. ATT + app IDs for export: `addons/AdmobPlugin/ios_export.cfg` and `android_export.cfg`. Settings → **Manage Ad Consent** re-opens the UMP privacy options form when Google requires an entry point for the user’s region.

**Unity Ads mediation:** enabled via `MediationNetwork.Flag.UNITY` + `ios_export.cfg` `enabled_networks=PackedStringArray("unity")`. Export generates a Podfile and runs `pod install` on macOS CI (opens `.xcworkspace`). AdMob console still needs a Unity mediation group + Game ID linked for Unity demand to fill.

Enable in `export_presets.cfg`: `plugins/AdmobPlugin=true` (checkbox key, not `plugins/exported=`)

## Firebase Analytics (no Crashlytics)
**Do not** follow the Firebase console’s native SwiftUI / SPM / `FirebaseApp.configure()` steps — those are for Xcode apps. StimPad uses the Godot plugin, which embeds Firebase and initializes it.

iOS: [GodotFirebaseiOS 0.5.6](https://github.com/SomniGameStudios/godot-firebase-ios)
1. Run `scripts/setup_ios_firebase.sh` (CI does this). Needs `GodotApplePluginsRuntime` (same as StoreKit).
2. Place `GoogleService-Info.plist` in `addons/GodotFirebaseiOS/` (script also accepts `./GoogleService-Info.plist` or `ios/GoogleService-Info.plist`).
3. Enable **GodotFirebaseiOS** in Project → Plugins (already listed in `project.godot`).
4. CI secret: `GOOGLE_SERVICE_INFO_PLIST_BASE64` (base64 of the plist).

Android: `google-services.json` + Firebase Android plugin (later).

Events are wired in `scripts/autoload/analytics_service.gd` via the `FirebaseIOS` autoload.

### Viewing sound popularity in Google Analytics / Firebase
1. Firebase console → enable **Analytics** for the iOS app + link a **GA4** property (Project settings → Integrations → Google Analytics).
2. After a TestFlight / device build with the plugin + plist, plays emit:
   - `sound_play` — params: `sound_id`, `sound_name`, `category`, `tier`, `mode`
   - `select_content` — GA4 recommended; params: `content_type=sound`, `item_id` (= sound id)
   - `sound_stop` — params include `duration_sec`
   - `purchase` / `plus_unlocked` — StimPad Plus (for Google Ads conversions)
3. In GA4: **Reports → Engagement → Events** → `sound_play` → break down by `sound_id` / `sound_name`. Or Explorations → free-form.
4. Use **DebugView** while testing (events can take hours to appear in standard reports).

### Google Ads + Firebase (campaign optimization)
1. Link the Firebase / GA4 property to your **Google Ads** account (Firebase → Project settings → Integrations, or Ads → linked accounts).
2. In GA4, mark key events as conversions (at least `purchase`; optionally `sound_play`, `plus_unlocked`, `enjoy_yes`).
3. Import those conversions into Google Ads for in-app action bidding. No extra SDK is required beyond Firebase Analytics (already in the iOS CI build).

## IAP — StimPad Plus ($4.99)
Product ID: `com.stimpad.soundboard.plus` (non-consumable)

**iOS:** GodotApplePlugins StoreKit 2 (`GodotApplePluginsRuntime` + `GodotApplePluginsStoreKit`), release pin `build-3781b9c19eaf69b2387eacecf4b6f88fc8d07e65`. Wired in `scripts/autoload/iap_service.gd` via `scripts/autoload/ios/store_kit_client.gd`. iOS CI installs the plugins automatically; local Mac exports must copy the same folders into `addons/`. **min iOS 17.0** required.

**Android:** Google Play Billing via compatible Godot 4 IAP addon behind `IAPService` (not wired yet).

Create matching products in App Store Connect and Google Play Console before testing purchases.

## In-app review (Enjoy StimPad → Yes)
Wired end-to-end:
1. `EnjoyPromptService` shows “Are you enjoying StimPad?”
2. **Yes** → `ReviewService.request_review()` (`scripts/ui/enjoy_prompt.gd`)
3. **No** → feedback form

**iOS native path (CI builds):** GodotApplePlugins StoreKit is installed by `ios-testflight.yml`. `ReviewService` calls `StoreKitManager.request_review` / `requestReview` when present (same stack as IAP). Optional [cengiz-pz In-app Review](https://github.com/cengiz-pz/godot-ios-inapp-review-plugin) also auto-binds if you add it later.

**Fallbacks:** store write-review URL once `ReviewService.IOS_APP_STORE_ID` is set; Android uses Play URL / plugin when available.

Without a device plugin, editor/desktop builds print a stub (dev menu can force the enjoy prompt).

## Feedback (Web3Forms)
`FeedbackService` posts to `https://api.web3forms.com/submit` (access key in that script). Settings → Feedback and the enjoy-prompt **No** path open the same form (OS, version/build, message, optional email, optional sound requests).

## Editor testing
Without plugins, desktop/editor builds use stub implementations:
- IAP simulates purchase after delay
- Ads show banner placeholder UI only
- Analytics prints to console
- Dev menu on Home (debug builds only): Unpaid / Paid / Force enjoy prompt
- Review prints a stub; Feedback still POSTs to Web3Forms when online
