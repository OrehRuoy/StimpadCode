# Plugin Setup — StimPad

Bundle ID: `com.stimpad.soundboard`

## AdMob (banner + interstitial + rewarded)
Use **AdmobPlugin Multi v6.0** (same as OrehRuoy/Whats4dinnerCode):
1. Download [AdmobPlugin-Multi-v6.0.zip](https://github.com/godot-sdk-integrations/godot-admob/releases/tag/v6.0)
2. Extract to project root (`addons/AdmobPlugin`, `ios/plugins/`, `android/plugins/`)
3. Enable in Project → Project Settings → Plugins
4. Run `scripts/setup_ios_admob_frameworks.sh` before iOS export (CI does this)
5. Production unit IDs live in `scripts/autoload/ads_service.gd` (`PROD_*`). Debug device builds still use Google demo units; release uses production (`is_real = not OS.is_debug_build()`).

**Consent init order (iOS + Android):** ATT (iOS) → UMP consent form if required → `MobileAds.initialize()` → load ads. No ads are requested before ATT + UMP finish. Implemented in `scripts/autoload/ads_service.gd`. ATT + app IDs for export: `addons/AdmobPlugin/ios_export.cfg` and `android_export.cfg`. Settings → **Manage Ad Consent** re-opens the UMP privacy options form when Google requires an entry point for the user’s region.

**AdMob Privacy & messaging (console):** create GDPR (and IDFA / US state messages if applicable) under AdMob → Privacy & messaging so UMP forms actually appear in-region.

**iOS AdMob (configured):**
- App ID: `ca-app-pub-5356882403986713~1231581339`
- Banner / interstitial / rewarded unit IDs in `ads_service.gd`
- Mediation: Unity Ads (`enabled_networks` includes `unity` in `ios_export.cfg` — CocoaPods pulls `GoogleMobileAdsMediationUnity` on export)

**Android AdMob:** not configured yet — keep Google demo IDs until the Android app + units exist in AdMob.

**Unity Ads mediation (AdMob-controlled):** enable Unity as an ad source in AdMob Mediation, create matching placements in the Unity Ads dashboard, then map them in AdMob mediation groups. Do not add a separate Unity Ads plugin — AdmobPlugin mediation handles the SDK.

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
3. In GA4: **Reports → Engagement → Events** → `sound_play` → break down by `sound_id` / `sound_name`. Or Explorations → free-form.
4. Use **DebugView** while testing (events can take hours to appear in standard reports).

## IAP — StimPad Plus ($4.99)
Product ID: `com.stimpad.soundboard.plus` (non-consumable)

**iOS:** GodotApplePlugins StoreKit 2 (`GodotApplePluginsRuntime` + `GodotApplePluginsStoreKit`), release pin `build-3781b9c19eaf69b2387eacecf4b6f88fc8d07e65`. Wired in `scripts/autoload/iap_service.gd` via `scripts/autoload/ios/store_kit_client.gd`. iOS CI installs the plugins automatically; local Mac exports must copy the same folders into `addons/`. **min iOS 17.0** required.

**Android:** Google Play Billing via compatible Godot 4 IAP addon behind `IAPService` (not wired yet).

Create matching products in App Store Connect and Google Play Console before testing purchases.

## Editor testing
Without plugins, desktop/editor builds use stub implementations:
- IAP simulates purchase after delay
- Ads show banner placeholder UI only
- Analytics prints to console
