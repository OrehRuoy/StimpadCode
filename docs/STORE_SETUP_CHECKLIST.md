# Store Setup Checklist — StimPad (iOS first)

Bundle: `com.stimpad.soundboard`  
IAP: `com.stimpad.soundboard.plus` ($4.99)  
Contact: Brock Hall — hallanhype@gmail.com  
Privacy: https://orehruoy.github.io/StimPad/privacy-policy.html

Execute in order. Android prep can run in parallel after step 4.

## Phase 1 — Apple (release path)
- [ ] **1.1** Apple Developer → Identifiers → App ID `com.stimpad.soundboard` (In-App Purchase capability)
- [ ] **1.2** Certificates → Distribution cert (reuse team cert if available)
- [ ] **1.3** Profiles → App Store profile for `com.stimpad.soundboard` → base64 → GitHub secret
- [ ] **1.4** App Store Connect → Name **StimPad - Stimming Soundboard** (29/30), subtitle **Sensory Fidget Soothing Sounds** (30/30), English, category Lifestyle (or Entertainment)
- [ ] **1.5** ASC → In-App Purchases → Non-consumable `com.stimpad.soundboard.plus` @ $4.99
- [ ] **1.6** ASC → App Privacy — **not done in-repo; must complete before submit.** Declare AdMob + Unity Ads + Firebase Analytics + IAP. At minimum for ads: Device ID, Advertising Data, Product Interaction, (often) Coarse Location / Diagnostics used by ad SDKs; mark Third-Party Advertising + Tracking where applicable. Mirror [Google AdMob iOS data disclosure](https://developers.google.com/admob/ios/privacy/data-disclosure).
- [ ] **1.7** ASC → Age rating questionnaire (general audience, not Made for Kids)
- [ ] **1.8** ASC → Support URL + Privacy Policy URL
- [ ] **1.9** Screenshots: iPhone 6.7" + iPad 13" (tablet supported)
- [ ] **1.10** Export compliance + content rights for bundled audio
- [ ] **1.11** ATT / tracking strings if AdMob personalized ads
- [ ] **1.12** GitHub Actions preflight green → TestFlight upload
- [ ] **1.13** TestFlight internal test → App Review submit

## Phase 2 — Firebase + AdMob
- [x] **2.1** Firebase project → iOS app `com.stimpad.soundboard` → `GoogleService-Info.plist` (local + CI secret)
- [ ] **2.2** Firebase → Enable Analytics + link GA4 (confirm in console; plist may still show `IS_ANALYTICS_ENABLED` false)
- [ ] **2.3** AdMob → Add iOS app → link Firebase
- [x] **2.2b** GodotFirebaseiOS plugin wired (`scripts/setup_ios_firebase.sh` + CI)
- [x] **2.4** AdMob ad units: banner, interstitial, rewarded (IDs in `ads_service.gd`)
- [x] **2.5** AdMob App ID in `ios_export.cfg` + `ads_service.gd`
- [x] **2.6** Production unit IDs wired; debug builds still use Google demo units
- [ ] **2.7** Unity Ads mediation: Unity dashboard Game ID + placements → AdMob Mediation groups

## Phase 3 — Privacy site (StimPad repo)
- [ ] **3.1** Publish `privacy-policy.html` on OrehRuoy/StimPad GitHub Pages
- [ ] **3.2** Verify URL loads over HTTPS
- [ ] **3.3** Link from app Settings + store listings

## Phase 4 — Android (prepare, ship after iOS)
- [ ] **4.1** Play Console → Create app `com.stimpad.soundboard`
- [ ] **4.2** Upload signing key / Play App Signing
- [ ] **4.3** Firebase → Add Android app → `google-services.json`
- [ ] **4.4** AdMob → Android app + banner / interstitial / rewarded units → fill `PROD_*_ANDROID` in `ads_service.gd`
- [ ] **4.5** Play → Monetize → In-app product `com.stimpad.soundboard.plus` $4.99
- [ ] **4.6** Content rating + Data safety (Ads, Analytics, no account)
- [ ] **4.7** Store listing + screenshots (phone + tablet)
- [ ] **4.8** Internal testing track → closed test → production

## Phase 5 — Pre-submission QA
- [ ] Free tier: 8 sounds play, ads show (banner), no ad during playback
- [ ] Plus purchase unlocks all sounds + removes ads (sandbox)
- [ ] Restore purchases works on second device / reinstall
- [ ] Favorites persist locally
- [ ] Visual FX toggle works
- [ ] Loop sounds respect 30s/1m/5m timer
- [ ] Tablet layout (3–4 column grid)

## Review notes template
> StimPad is a sensory soundboard for general audiences. Free tier includes 14 sounds with ads. One-time IAP "StimPad Plus" unlocks full library and removes ads. No account required. Test Plus with sandbox Apple ID / license tester.
