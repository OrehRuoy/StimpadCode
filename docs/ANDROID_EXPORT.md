# Android Export — StimPad

Package: `com.stimpad.soundboard`

## export_presets.cfg
Preset **Android** is configured in-repo. Before Play upload:
1. Create/upload signing keystore; set `package/signed=true` and keystore env in CI or local export
2. Add `android/app/google-services.json` (gitignored) for Firebase Analytics
3. Set AdMob App ID via AdmobPlugin export config (`android_export.cfg` + `PROD_APP_ID_ANDROID` in `ads_service.gd`)
4. Production ad units: fill `PROD_BANNER_ANDROID`, `PROD_INTERSTITIAL_ANDROID`, `PROD_REWARDED_ANDROID` (iOS already wired; Android still empty)

## IAP
Create managed product `com.stimpad.soundboard.plus` ($4.99) in Play Console.
Wire Godot Play Billing plugin in `IAPService._request_purchase_native` (see CircuitSortCode / godot-iap docs in PLUGIN_SETUP.md).

## Release order
Ship iOS first. Android internal testing after iOS TestFlight is stable.

## Tablet
`screen/support_large` and `support_xlarge` enabled; home grid expands to 3–4 columns at wider widths.
