# Plugin Setup — StimPad

Bundle ID: `com.stimpad.soundboard`

## AdMob (banner + interstitial)
Use **AdmobPlugin Multi v6.0** (same as OrehRuoy/Whats4dinnerCode):
1. Download [AdmobPlugin-Multi-v6.0.zip](https://github.com/godot-sdk-integrations/godot-admob/releases/tag/v6.0)
2. Extract to project root (`addons/AdmobPlugin`, `ios/plugins/`, `android/plugins/`)
3. Enable in Project → Project Settings → Plugins
4. Run `scripts/setup_ios_admob_frameworks.sh` before iOS export (CI does this)
5. Set ad unit IDs in `scripts/autoload/ads_service.gd` (production) — test IDs ship by default

**iOS init order:** ATT → `MobileAds.initialize()` → UMP (await frames between steps)

**Ad units (create in AdMob, link Firebase):**
- `stimpad_ios_banner`
- `stimpad_ios_interstitial`
- `stimpad_android_banner`
- `stimpad_android_interstitial`

Enable in `export_presets.cfg`: `plugins/AdmobPlugin=true` (checkbox key, not `plugins/exported=`)

## Firebase Analytics (no Crashlytics)
Pattern from OrehRuoy/CircuitSortCode:
- iOS: [GodotFirebaseiOS 0.5.6](https://github.com/SomniGameStudios/godot-firebase-ios)
- Android: `google-services.json` + Firebase Android plugin
- Place `ios/GoogleService-Info.plist` locally (gitignored) or inject via CI secret `GOOGLE_SERVICE_INFO_PLIST_BASE64`
- Wire events in `scripts/autoload/analytics_service.gd`

## IAP — StimPad Plus ($4.99)
Product ID: `com.stimpad.soundboard.plus` (non-consumable)

**iOS:** GodotApplePlugins StoreKit (CircuitSort release `build-3781b9c19eaf69b2387eacecf4b6f88fc8d07e65`)
**Android:** Google Play Billing via compatible Godot 4 IAP addon behind `IAPService`

Create matching products in App Store Connect and Google Play Console before testing purchases.

## Editor testing
Without plugins, desktop/editor builds use stub implementations:
- IAP simulates purchase after delay
- Ads show banner placeholder UI only
- Analytics prints to console
