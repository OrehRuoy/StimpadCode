# Android QA

Install from the internal testing track. Add the phone as an AdMob test device first. Use a license-tester Google account for purchases.

## Layout

- [ ] US or non-EEA: no consent form. The banner sits fully above the gesture bar or 3-button nav, and it does not cover the now-playing bar.
- [ ] Android back closes the enjoy prompt, then a feature tip, then player, paywall, settings, or feedback back to home without an interstitial. Home then quits.

## Consent and ads

- [ ] EEA test (UMP debug geography, or a VPN and a fresh install): the consent form appears before any ad request. Logcat shows no ad request before the choice.
- [ ] EEA Consent loads ads. Do not consent, or Manage options → reject, makes no ad request, collapses the banner, and leaves the app usable.
- [ ] Settings → Manage Ad Consent appears only where required, opens the form, and applies a new choice without a restart.
- [ ] An interstitial shows at most every 3rd Home or Settings exit, at least 90 seconds apart, never while a sound plays, and never from Back.
- [ ] Paywall → Watch Ad plays a rewarded ad and unlocks every sound for 20 minutes with a countdown. A second attempt the same day says to come back tomorrow or get Plus.
- [ ] Quitting the ad early does not unlock anything.
- [ ] Buying Plus removes the banner immediately, and ads stay gone after a restart.

## Billing

- [ ] The paywall shows the localized Play price within about 3 seconds.
- [ ] Test card approve unlocks all 95 sounds and removes ads. Five minutes later the order is still owned.
- [ ] Decline leaves the library locked. Cancel shows "Purchase canceled".
- [ ] A pending test card shows the pending line and unlocks only after Play confirms it.
- [ ] Clear data, reinstall, or a second device on the same Google account restores Plus on launch and from Settings → Restore.
- [ ] Airplane mode shows "Google Play not ready yet".
- [ ] Logcat has no BillingClient errors at cold start.

## Review

- [ ] Enjoying StimPad? → Yes opens the Play review sheet and does not open the browser. The sheet may not appear if the quota is used.
- [ ] Settings → Rate StimPad opens the Play listing.

## Analytics, haptics, audio

- [ ] `adb shell setprop debug.firebase.analytics.app com.stimpad.soundboard`, then open the app. DebugView shows `screen_view` for home, `sound_play` with sound id, name, category, tier, and mode, `select_content`, and `sound_stop` with `duration_sec`.
- [ ] User property `platform` is `play`. A Plus purchase or restore shows `purchase` (value and currency) and `plus_unlocked`.
- [ ] A package id ending in `.debug` sends no analytics.
- [ ] Tile tap and Play haptics are noticeable and not harsh. They stay off when the toggle is off.
- [ ] Play a loop and press power. Audio stops. Unlock inside the timer and the now-playing bar matches the sound.
- [ ] Set a 15-minute sleep timer, lock for 16 minutes, unlock. The session has ended and the bar is gone.
- [ ] Unplug headphones or disconnect Bluetooth during a loop. The sound stops.
- [ ] Spotify (or another app) and a StimPad sound are both audible. A call or alarm does not crash the app.
- [ ] Cold start to home stays under 3 seconds on a mid-range phone.

## Closed-test gate

- [ ] Run this list on a Pixel (gesture nav), a Samsung (3-button nav), and a tablet or foldable.
- [ ] Play Console pre-launch report: 0 crashes, 0 ANRs, and no touch-target errors on the home grid.
- [ ] App bundle explorer: 16 KB page support, arm64-v8a only. Write the download size in `docs/PLAY_STORE.md`.
- [ ] Policy status: no warnings for Data safety, Ads, Target audience, Health, or Permissions.
- [ ] Closed testing has the C1 release and the tester list. Tess has the opt-in URL.
