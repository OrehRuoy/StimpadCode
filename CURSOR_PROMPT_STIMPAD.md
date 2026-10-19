# Cursor prompt: StimPad iOS, retention and funnel changes (items 4, 1, 2, 7, 3, 5)

Paste everything below the line into Cursor, with the StimPad repo (`OrehRuoy/StimpadCode`) open as the workspace.

---

You are working in the StimPad repo (`OrehRuoy/StimpadCode`). It is a **Godot 4.6** project (CI exports with Godot 4.6.3). The iOS app ships through GitHub Actions ("iOS TestFlight", started by hand). Live on the App Store is **1.0.4**, built from `main` @ `b339ddd914`.

How the code is organised, so you can find things:
- Autoloads (`project.godot`): `LocaleService`, `SoundCatalog`, `AudioController`, `LocalPrefs`, `HeadFlossService`, `HapticsService`, `Entitlements`, `AdsService`, `IAPService`, `AnalyticsService`, `FeedbackService`, `ReviewService`, `EnjoyPromptService`, `FeatureTipService`. All live in `scripts/autoload/`.
- Screens are in `scripts/ui/` (`main.gd` is the navigator, group `main_nav`; `home_screen.gd`, `player_screen.gd`, `paywall_screen.gd`, `settings_screen.gd`, `enjoy_prompt.gd`, `ui_look.gd` for shared styling).
- Translations: **one file**, `locale/messages.json`. It is a flat object. The key is the English source string exactly as written in `tr("...")`. The value is an object with the five locales `de`, `es`, `fr`, `pt_BR`, `ja`. `scripts/autoload/locale_service.gd` loads it at startup and picks the language from the phone. Anything else falls back to English.
- StoreKit comes from the GodotApplePlugins addon that CI downloads (pinned to release `build-3781b9c19eaf69b2387eacecf4b6f88fc8d07e65`). It is wrapped by `scripts/autoload/iap_service.gd` and `scripts/autoload/ios/store_kit_client.gd`. Ads come from the committed `addons/AdmobPlugin`. Analytics come from GodotFirebaseiOS, which CI downloads.

Follow this prompt literally. If anything below does not match the code you find, stop and tell me. Do not improvise.

## BEFORE YOU START (read all of this first)

### Step 0: check the repo state (read-only), then decide
Run these and keep the output:
```
git status
git branch -a -vv
git stash list
git fetch origin                     # read-only; updates remote refs only
git log --oneline --decorate -8
git rev-parse HEAD origin/main
git log --oneline origin/main..HEAD
git log --oneline HEAD..origin/main
git diff --stat
git diff --cached --stat
git ls-files --others --exclude-standard
git show b339ddd914 --stat --oneline | head -5
grep -n 'config/version' project.godot
grep -n 'application/short_version\|version/name' export_presets.cfg
```

**STOP and report to me (write nothing) if ANY of these is true:**
- `git status` shows modified, staged or untracked files. Exception: obviously generated or ignored output (`.godot/`, `build/`, `*.import`). List those, they do not block.
- `origin/main` is not `b339ddd914fcdcf8fc5738419fc4957b2bb90d73`, or local `HEAD` has commits that are not on `origin/main`, or `origin/main` has commits after `b339ddd914`. The live 1.0.4 must be exactly what you are building from.
- `project.godot` does not say `config/version="1.0.4"`, or the iOS preset in `export_presets.cfg` does not say `application/short_version="1.0.4"`.
- There are stashes. Report what they touch.

Your report must say what you found and which commit you believe is the live 1.0.4. If nothing blocks, continue.

**Create the work branch from the live commit (not from a moving `main`):**
```
git switch -c feat/stimpad-retention-oct2026 b339ddd914
```

### Rules for the whole task
1. Never commit to `main`. Never push (not the branch, not tags). No force-push, no `reset --hard`, no `clean -fd`, no stash drops, no rebase of anything that already exists. Do not open a PR. Do not run or trigger CI.
2. **Do not touch:**
   - **version numbers**: `config/version` and `config/build` in `project.godot`, `application/short_version` and `application/version` and `version/name` and `version/code` in `export_presets.cfg`. 1.0.4 is live, so the next upload must be **1.0.5**. Brock bumps it himself, as its own commit.
   - **product ids**: `com.stimpad.soundboard.plus` (in `iap_service.gd`, `entitlements.gd`, `iap_native_bridge.gd`) and the store product mapping `_IOS_PRODUCT_IDS`.
   - **StoreKit logic**, beyond the two small read-only additions named in item 4 (a price getter and a transaction-id getter). No change to purchase, restore, entitlement refresh, `finish()`, or signal signatures.
   - **ad unit ids and ad setup**: every `PROD_*` constant, consent/ATT/UMP code, banner loading, interstitial loading. The only `ads_service.gd` edits allowed are the ones named in items 4, 5 and 7.
   - **signing and provisioning**: team id, profile uuid, code sign identity, bundle id.
   - **CI and scripts**: `.github/workflows/*`, `scripts/*.sh`, `tools/*`. Do not change the GodotApplePlugins pin.
   - **the audio session and lock-screen behaviour**: the `[audio]` section of `project.godot` (including its comment), `UIBackgroundModes`, `application/additional_plist_content`. Lock-screen audio is deliberately **not** part of this task (see "Item 8" at the end).
   - **scene files**: do not edit any `.tscn`. Build new UI in GDScript code (add the node, then `move_child`). That keeps diffs small and avoids Godot rewriting UIDs.
3. **Allowed edits outside `scripts/` and `locale/`:** only the ones listed in item 5b (`addons/InappReviewPlugin/`, `ios/plugins/InappReviewPlugin*`, one line in `export_presets.cfg`, one list entry in `project.godot`, one docs fix). Nothing else.
4. Keep every change minimal. Do not refactor, rename, reformat, or "clean up" code you were not asked to change. No new autoloads. No new dependencies other than the one in item 5b.
5. **Privacy:** analytics must never contain personal data. Allowed values are sound ids, counts, durations, booleans, tier names, and short reason codes. Never log feedback text, an email, a device id, an IP, or a user-typed string. Never put any of those in `print` either.
6. **Strings:** every user-facing string goes through `tr()` with the English text as the key. For each new string, add an entry to `locale/messages.json` with all five locales (`de`, `es`, `fr`, `pt_BR`, `ja`), written in the same plain, friendly tone as the neighbouring entries (look at how "Plus", `%s` and `%d` placeholders are handled there and copy that). Keep placeholders identical in every language. Use plain ASCII `>` in path-style copy; do not add emoji or arrow glyphs (the bundled font may not have them). After editing, validate the file: `python3 -c "import json;json.load(open('locale/messages.json'))"`. Remove a key only if your change made it unused and `rg -n --fixed-strings '<key>' scripts scenes` finds nothing.
7. **One commit per item**, in this order: **4, 1, 2, 7, 3, 5**. Item 5 is two commits (5a code, 5b plugin install). Plain messages, for example `StimPad: queue analytics until Firebase is ready (item 4)`. Before each commit, run the checks below and walk that item's acceptance list.
8. When everything is done, follow "STOP AND REPORT" at the end.

### What you can and cannot run
Brock builds without a Mac, only through GitHub Actions, and will push the branch himself. You do not build and you do not push. Do run what exists, and tell me what you could not run:
- `which godot godot4 Godot`. If a Godot 4.6.x binary exists, run `godot --headless --path . --editor --quit 2>&1 | tail -40` and fix any script parse errors you caused. If none exists, re-read every changed `.gd` file for typos, wrong node paths, missing `:=` types, signals connected but not declared, and `await` on something that never emits.
- JSON check on `locale/messages.json` after every item that touches it.
- `rg -n "grant_temp_unlock|try_show_rewarded_for_sound|_temp_unlocks"` after item 7 (must find nothing).
- Read `.github/workflows/ios-testflight.yml` ("Validate export preset and plugins") so you know what CI expects. Any `.gdip` you add must use `;` comments, not `#`.

### Files you are expected to change (and only these)
- `scripts/autoload/`: `analytics_service.gd`, `audio_controller.gd`, `entitlements.gd`, `iap_service.gd`, `ios/store_kit_client.gd`, `ads_service.gd`, `local_prefs.gd`, `review_service.gd`, `enjoy_prompt_service.gd`, `feature_tip_service.gd` (one tiny `is_showing()` only)
- `scripts/ui/`: `main.gd`, `home_screen.gd`, `player_screen.gd`, `paywall_screen.gd`, `enjoy_prompt.gd`
- `locale/messages.json`
- item 5b only: `addons/InappReviewPlugin/` (new), `ios/plugins/InappReviewPlugin.*` (new), `export_presets.cfg` (one line), `project.godot` (one list entry), `docs/PLUGIN_SETUP.md` (one section)

---

## Shared design decisions (already made, do not revisit)
These are used by several items, so they are stated once.

- **Local day key:** use the same `_today_key()` style as `entitlements.gd` today (`Time.get_date_dict_from_system()`, "YYYY-MM-DD", the phone's local calendar).
- **Wall clock:** `Time.get_unix_time_from_system()`. Persist deadlines as unix seconds in `LocalPrefs`.
- **Event helper:** all new events go through `AnalyticsService.log_event(name, params)`. Event and param names are lowercase snake_case, at most 40 characters. Param values are strings, ints, floats or bools only.
- **New `LocalPrefs` fields** (add each to `load_prefs()` with a safe default and to `save_prefs()`, following the existing pattern):
  - `preview_day: String = ""` and `previewed_ids: Array[String] = []` (item 2)
  - `library_unlock_until_unix: int = 0`, `library_unlock_started_unix: int = 0`, `library_unlock_last_day: String = ""` (item 7)

---

## Item 4 (first). Analytics: queue early events, real price, real transaction id, split ad taps, add funnel events

**Today (verified on `b339ddd914`):**
- `analytics_service.gd` `log_event()` returns without sending when `_initialized` is false. `_initialize_analytics()` only runs about 10 seconds after launch on iOS. So the first `screen_view` ("home" is scheduled 3 seconds after the splash in `main.gd` `_on_home_content_ready`) and any sound played in the first seconds are thrown away.
- A fail-open timer sets `_initialized = true` 8 seconds later even when `_native` is still null. After that, `_log_event_native()` returns silently on `_native == null`.
- `entitlements.gd` `_on_purchase_completed` logs `purchase` with `"currency": "USD"`, `"value": 4.99` and `"transaction_id": "plus_" + clock`.
- `paywall_screen.gd` `_on_watch_ad` logs `paywall_buy_tap` with `source: "ad"`.

**Goal:** no early events lost, no invented money values, ad taps are not buy taps, and the funnel events exist.

**Do not change when Firebase starts.** The 10 second delay exists because earlier builds crashed at launch. Queue only.

### 4a. Queue in `scripts/autoload/analytics_service.gd`
- Add `const MAX_QUEUED_EVENTS := 40` and `const QUEUE_GIVE_UP_SEC := 90.0`.
- `log_event` keeps its signature and its editor/desktop `print`. New behaviour:
  - If `not OS.has_feature("mobile")`: print only (as today), do not queue.
  - If `_initialized and _native != null`: send now (as today).
  - Otherwise, if the queue is still open: append `{"name", "params"}` (use the already-stringified params). If the queue already has 40 entries, drop the **oldest `screen_view`**; if there is none, drop the **incoming** event. Never block.
- Flush: when Firebase becomes ready (`_on_firebase_ready`, and also after the 8 second fail-open path once `_native` is non-null), send the queued events **in order**, at most 8 per frame (`await get_tree().process_frame` between batches) so launch does not spike. Then clear the queue.
- The fail-open path can leave `_native == null`. Add a retry: every 2 seconds, call `_resolve_native()`; when it returns non-null, set `_native` and flush. After `QUEUE_GIVE_UP_SEC` since `_ready`, if `_native` is still null: clear the queue and stop queueing (drop later events silently, as today).
- Keep `_log_event_native`, `_resolve_native`, `_stringify_params` as they are.
- Add `func log_app_open() -> void` that logs `app_open` with `app_open_count` (int, `LocalPrefs.app_open_count`), `has_plus` (bool), `days_since_first_open` (int, from `LocalPrefs.first_open_unix`, 0 if unknown). Call it **once** at the end of `main.gd` `_ready()`. (`LocalPrefs.note_app_open()` already runs from `EnjoyPromptService._ready()` before `main.gd` is ready, so the count is already updated.)

### 4b. Real price, currency and transaction id (read-only additions, no StoreKit behaviour change)
- `scripts/autoload/ios/store_kit_client.gd`:
  - Add `func get_price_value(internal_product_id: String) -> float`, copying the lookup pattern of `get_display_price` (it loops `_products_by_store_id`). The product object exposes the number as `price` (StoreKit `Product.price`, a Double). Use the same defensive style the file already uses (`product.has_method("get_price")`, then `"price" in product`). Return `0.0` if not found.
  - Add `func get_currency_code(internal_product_id: String) -> String`. The plugin pinned today does **not** expose a currency code property. Look for `currency_code` / `get_currency_code` on the product defensively and return it if it exists, otherwise return `""`. Do **not** guess a currency from the "$" or "€" symbol and do not parse `json_representation`.
  - Add `var _last_transaction_id: String = ""` and `func get_last_transaction_id() -> String`. In `_on_purchase_completed`, **before** `purchase_settled.emit(...)`, if `status == _STATUS_OK` and `_transaction != null`, set it from the transaction using the same defensive pattern (`has_method("get_transaction_id")`, then `"transaction_id" in _transaction`, then `str()` of it). Do not change anything else in that function.
- `scripts/autoload/iap_service.gd`: add thin getters that forward to `_ios_store` when it exists and `_ios_store_ready`: `get_price_value() -> float`, `get_currency_code() -> String`, `get_last_transaction_id() -> String`, plus `has_live_price() -> bool` (true only after StoreKit returned a price, i.e. `_on_ios_product_prices_updated` updated `_display_price`; track it with a bool). Leave `DISPLAY_PRICE := "$4.99"` as the on-screen fallback.
- `scripts/autoload/entitlements.gd` `_on_purchase_completed`: build the `purchase` event like this:
  - `item_id`, `item_name` as today.
  - `transaction_id`: `IAPService.get_last_transaction_id()`. If it is empty, **omit** the key (do not invent one).
  - If `IAPService.has_live_price()` and `get_price_value() > 0.0` **and** `get_currency_code()` is not empty: add `value` (the float) and `currency`.
  - Otherwise: **do not send `value` or `currency`** (GA4 ignores a value without a currency anyway). Send `price_display` (the localized string, only when live) instead. Never send `4.99` or `USD` unless StoreKit said so.
- `scripts/ui/paywall_screen.gd` `_on_purchase_done`: `plus_purchase_success` gets the same optional `price_display` (live only) and, when known, `value` and `currency`.

### 4c. Stop logging ad taps as buy taps
- `paywall_screen.gd` `_on_watch_ad`: **remove** the `paywall_buy_tap` call. Keep `paywall_watch_ad_tap`. `paywall_buy_tap` now fires only from `_on_buy` (`source: "iap"`). Keep the `price` param there only when `IAPService.has_live_price()`.

### 4d. New events (only the ones whose trigger exists today)
Add each at the spot named. Event names exactly as written.

| Event | Where | Params |
|---|---|---|
| `app_open` | `AnalyticsService.log_app_open()` from `main.gd` `_ready` | see 4a |
| `first_sound_play` | `audio_controller.gd` `play_sound`, **before** `LocalPrefs.note_recent_sound(...)`, only when `LocalPrefs.recent_sound_ids.is_empty()` | `sound_id`, `tier`, `mode` |
| `listen_30s` | `audio_controller.gd`, once per play start, when 30 seconds of real listening have passed (see below) | `sound_id`, `mode` |
| `timer_started` | `audio_controller.gd` `_arm_stop_timer`, when a deadline is actually armed (`_session_duration_sec > 0`) | `minutes` (int), `sound_id`, `mode` |
| `timer_finished` | `audio_controller.gd` `_on_session_timer_timeout`, only when `finished_id` is non-empty | `minutes` (int), `sound_id` |
| `favorite_add` | `player_screen.gd` `_on_favorite_toggle`, only when it is now a favorite | `sound_id`, `favorites_count` (int) |
| `paywall_view` | `main.gd` `show_paywall`, once per opening | `reason`, `sound_id` (empty string if none) |
| `rewarded_earned` | `ads_service.gd` `_on_rewarded_dismissed`, when `earned` is true | `scope` = `"sound"` for now (item 7 changes it to `"library"`) |
| `rewarded_failed` | `ads_service.gd`, every place that emits `rewarded_unlock_failed` | `reason` = a short code: `already_unlocked`, `playback_active`, `not_ready`, `loading`, `no_ad`, `closed_early`, `show_failed`, `daily_used` |

Details:
- **`listen_30s`:** do not use `Time.get_ticks_msec()` differences (that clock keeps running while the phone is locked). In `audio_controller.gd` add `var _listen_accum_sec := 0.0` and `var _listen_30_logged := false`. In `_process(delta)`: if `_player.playing`, add `minf(delta, 0.5)`. Reset both in `play_sound` and `stop`. When the total first reaches 30.0, log once. (`_process` does not run while the app is in the background, which is what we want.) Item 5 reuses this accumulator, so keep it a plain member.
- **`paywall_view` and `show_paywall`:** change the signature to `show_paywall(for_sound: Dictionary = {}, reason: String = "")`. If `reason` is empty, use `"locked_sound"` when `for_sound` is non-empty and `"plus_button"` otherwise. Existing callers need no change.
- **`rewarded_failed`:** add a small helper in `ads_service.gd`, `_emit_rewarded_failed(code: String, message: String)`, that logs the event and then emits the existing `rewarded_unlock_failed(message)`. Replace the direct `.emit(...)` calls with it. Messages stay exactly as they are today (they are already `tr()`-wrapped).
- `sound_play`, `select_content`, `sound_stop`, `screen_view` stay as they are.

### Acceptance (item 4)
- [ ] With `_initialized == false`, `log_event` stores up to 40 events and sends them in order after Firebase is ready. The cap drops the oldest `screen_view` first. Nothing is queued on desktop.
- [ ] The 10 second delay and the 8 second fail-open are unchanged. No other autoload start time changed.
- [ ] If `_native` is still null after 90 seconds, the queue is cleared and there is no error spam.
- [ ] `rg -n "4\.99|\"USD\"" scripts` finds only `DISPLAY_PRICE` in `iap_service.gd` (and nothing in `entitlements.gd`).
- [ ] `purchase` carries a real `transaction_id` or none; `value`/`currency` only when both are known.
- [ ] `paywall_buy_tap` appears only in `_on_buy`.
- [ ] Every event in the table is wired once. No event carries a user-typed string.
- [ ] `locale/messages.json` unchanged by this item (no new strings).
- [ ] Commit: `StimPad: queue analytics until ready, real price/transaction id, funnel events (item 4)`.

---

## Item 1. "Play again" row on Home

**Goal:** a single row on Home, one tap per sound, built from data already stored (`LocalPrefs.recent_sound_ids`, newest first, and `LocalPrefs.favorites`). No autoplay on launch. Hidden when empty. Styled like the existing scope chips.

**Files:** `scripts/ui/home_screen.gd` only (plus `locale/messages.json`). No `.tscn` edit.

**Where it goes:** Home's `$Margin/VBox` order today is TopBar, ScopeRow, CategorySelect, FeaturesBanner, DevMenu, EmptyState, Scroll. Build the row in code in `_ready()` and place it **right after `CategorySelect`** (`move_child(row, _category_select.get_index() + 1)`), so it sits above the tip banner and the grid.

**What the row contains** (decided):
1. A small caption label "Play again" (`tr("Play again")`, font size 13, colour `Color(0.7, 0.78, 0.86, 1)` like the existing tip label), as the first item of the row.
2. Chip 1 = the **last played** sound: `LocalPrefs.recent_sound_ids[0]` resolved with `SoundCatalog.get_sound_by_id`. Style it with `UiLook.style_chip(btn, true)` (the mint "selected" look) so it reads as the main one.
3. Then up to **3 favorites**, skipping the sound already used for chip 1, styled `UiLook.style_chip(btn, false)`. Order: favorites that appear in `recent_sound_ids` first (in recent order), then the remaining favorites, newest added first.
4. If the user has **no** favorites, fill up to **2 more** chips from older `recent_sound_ids` (skipping duplicates) so a new listener still sees a short row.
5. **Skip locked sounds** (`not SoundCatalog.is_sound_unlocked(sound)`): the row promises one-tap play. Free users with Plus favorites simply do not see those here (they are still under the Favorites chip).
6. If there are no eligible chips, hide the whole row (`visible = false`, no empty gap).

**Layout (this is the part that needs care):**
- Put the caption and chips in an `HBoxContainer` inside a `ScrollContainer` (`horizontal_scroll_mode = SCROLL_MODE_AUTO`, `vertical_scroll_mode = SCROLL_MODE_DISABLED`, `scroll_deadzone` like the grid's, scrollbar hidden the way `_hide_scroll_bar` does it). A fourth chip may sit partly off-screen; that is fine and hints that the row scrolls.
- Chip height and font follow the scope chips: `CHIP_H_PHONE` / `CHIP_H_TABLET` and `CHIP_FONT_PHONE` / `CHIP_FONT_TABLET`. **Exception for small phones:** if the viewport height is under 740 (iPhone SE / 8 class), use height 40 and font 14 for this row so the grid keeps room. Re-apply in `_apply_responsive_layout()`.
- **Long sound names:** each chip's text is `tr(sound name)`. Set `clip_text = true` and `text_overflow_behavior = TextServer.OVERRUN_TRIM_ELLIPSIS`, and give the chip a `custom_minimum_size.x` equal to the measured text width plus the chip's horizontal margins (32), clamped to **[96, 170]** on phone and **[110, 220]** on tablet. Measure with the theme font: `btn.get_theme_font("font").get_string_size(text, HORIZONTAL_ALIGNMENT_LEFT, -1, font_size).x`. The longest catalog name is 24 characters ("Restaurant Crowd Chatter"); translated names can be about as long. Nothing may overflow the screen or make the row taller.
- `tooltip_text = tr("Play %s") % name` on each chip.

**Behaviour:**
- Tap: `HapticsService.tap()`, log `play_again_tap` with `sound_id`, `slot` (`"last"`, `"favorite"` or `"recent"`) and `position` (int, 0-based), then call `get_tree().get_first_node_in_group("main_nav").call("show_player", sound)` exactly like `_on_tile_pressed`. The player already autoplays when it opens, and `main.gd show_player` already handles "this sound is already playing, just reopen". **Do not start audio from Home `_ready` or from any refresh.**
- Refresh the row when: Home becomes visible (`visibility_changed` and `visible`), `Entitlements.plus_changed`, `Entitlements.temp_unlocks_changed`, and once at the end of `_ready()`. Favorites and recents change while Home is hidden, so `visibility_changed` is the important one. Rebuilding the row is cheap (at most 4 buttons); free the old children with `queue_free()`.
- The row must not delay the splash: do **not** wait on it for `home_content_ready`. Build it after the existing `_rebuild_filters()` call and do not touch `_refresh_grid()` or the first-batch logic.

**New strings:** `Play again`, `Play %s`.

### Acceptance (item 1)
- [ ] Fresh install (no recents): no row, no gap, grid and splash behave exactly as before.
- [ ] After playing rain once: row shows "Play again" and a rain chip (mint). Force-quit, reopen: still there, and **nothing plays on launch**.
- [ ] Tapping the chip opens the player and plays that sound once (no double start). If that sound is already playing, it just reopens.
- [ ] With 3+ favorites: last played plus 3 favorites, no duplicates; the row scrolls sideways if it is wider than the screen.
- [ ] A locked Plus favorite is not shown for a free user.
- [ ] Long names are clipped with an ellipsis; nothing overflows. Row height does not change with the text.
- [ ] Under 740 viewport height the row uses the 40 px chips. Say in your report what you could and could not check; Brock confirms on a small phone that the grid still shows at least one full row of tiles under it.
- [ ] Plus and free users both see the row. Returning from the player refreshes it without reloading the grid.
- [ ] No `.tscn` changed. `git diff --stat` shows `home_screen.gd` and `locale/messages.json` only.
- [ ] Commit: `StimPad: Play again row on Home (item 1)`.

---

## Item 2. Locked-sound preview, and honest paywall numbers

**Today:** `main.gd` `show_player(sound)` sends a locked sound straight to `show_paywall(sound)`; nothing plays. `paywall_screen.gd` `_refresh()` says "Unlock 70+ stim sounds and remove ads." The catalog is 95 sounds: 14 free and 81 Plus.

**Decisions (made, explained to Brock in the notes):**
- Preview = about **8 seconds**, then the paywall for that sound.
- **Once per sound per local day**, remembered on disk in `LocalPrefs` (so force-quitting is not a loophole). The second time the same locked sound is tapped that day, go straight to the paywall like today.
- **No preview** when: the user has Plus; the sound is unlocked (including the item 7 window); **any sound is already playing** (do not interrupt someone's running session just because they tapped a locked tile; go straight to the paywall as today); the audio file is missing.
- Preview is **not** a real play: it must not call `LocalPrefs.note_recent_sound`, must not log `sound_play`, `select_content`, `first_sound_play` or `listen_30s`, must not start the sleep timer, and must not count toward the review prompt.
- **No change to the purchase flow, prices, or ads loading.**

### 2a. `scripts/autoload/local_prefs.gd`
Add the two fields from "Shared design decisions", plus:
- `func can_preview_today(sound_id: String) -> bool`: if `preview_day != _today_key()` reset `preview_day`, clear `previewed_ids`, return true; else return `not (sound_id in previewed_ids)`.
- `func mark_previewed_today(sound_id: String) -> void`: same day reset, then append and `save_prefs()`.
(Add a small `_today_key()` here; same format as `entitlements.gd`.)

### 2b. `scripts/autoload/audio_controller.gd`
- Add `signal preview_finished(sound_id: String, reason: String)` and `const PREVIEW_SECONDS := 8`.
- Add `var _previewing := false`, `var _preview_end_unix := 0`, and a second `Timer` node (`_preview_timer`, one-shot, created in `_ready` like `_session_timer`).
- `func is_previewing() -> bool` and `func get_preview_seconds_left() -> int` (0 when not previewing; from the wall-clock deadline).
- `func play_preview(sound: Dictionary) -> bool`:
  - return false if `is_playing()`, if `sound` is empty, or if the stream cannot be loaded (same `ResourceLoader.exists` / `load` / `duplicate()` handling as `play_sound`).
  - set `_current_sound = sound`, always call `_enable_stream_loop(stream)` (so a one-second click is heard for the full 8 seconds), `_clear_stop_timer()`, set `_previewing = true`, `_preview_end_unix = now + PREVIEW_SECONDS`, start `_preview_timer` with `PREVIEW_SECONDS`, `_player.play()`, apply `pitch_scale` like `play_sound`, emit `playback_started(id)`.
  - nothing else: no recents, no analytics, no accumulators.
- `func end_preview(reason: String) -> void` (`reason` is `"timeout"`, `"stop"` or `"cancel"`): do nothing if not previewing. Otherwise stop `_player` and `_preview_timer`, clear the flags and `_current_sound`, emit `playback_stopped(id)`, then emit `preview_finished(id, reason)`. **No code path may leave the player running** after this.
- `_preview_timer.timeout` calls `end_preview("timeout")`.
- `_check_stop_deadline()` (called from `_process` and from `NOTIFICATION_APPLICATION_RESUMED` / `FOCUS_IN`) must also end the preview with `"timeout"` when `_previewing and now >= _preview_end_unix`. This covers a locked phone where the Godot timer did not advance.
- `stop()`: if `_previewing`, call `end_preview("stop")` and return.
- `play_sound()`: if `_previewing`, call `end_preview("cancel")` first.
- `_on_player_finished()`: if `_previewing`, ignore it and `return`.
- `get_stop_seconds_left()` stays about the sleep timer only.

### 2c. `scripts/ui/main.gd`
- In `show_player(sound)`: where it currently does `show_paywall(sound); return` for a locked sound, call a new `_try_start_preview(sound)` first; if it returns false, fall back to `show_paywall(sound)` as today.
- `_try_start_preview(sound) -> bool`: require `not Entitlements.has_plus()`, `not SoundCatalog.is_sound_unlocked(sound)`, `not AudioController.is_playing()`, `LocalPrefs.can_preview_today(id)`. Then `LocalPrefs.mark_previewed_today(id)`, `_show_screen(_player)`, `_player.call("open_preview", sound)`, `AnalyticsService.log_screen("player")`, and `AudioController.play_preview(sound)`. If `play_preview` returns false, call `_player.call("close_preview")`, show the paywall instead and return true. Log `preview_started` with `sound_id`, `tier`. Connect `AudioController.preview_finished` to `_on_preview_finished` **once, in `_ready`**.
- `_on_preview_finished(sound_id, reason)`: log `preview_ended` with `sound_id`, `reason` and `duration_sec` (seconds actually listened, capped at 8). Call `_player.call("close_preview")`. If `reason` is `"timeout"` or `"stop"`: `show_paywall(SoundCatalog.get_sound_by_id(sound_id), "preview_ended")`. If `"cancel"`: do nothing (the user already navigated).
- `show_home()` and `show_settings()`: at the very top, `if AudioController.is_previewing(): AudioController.end_preview("cancel")`. That makes Back and every other exit stop the audio before the screen changes.
- `_notification(what)` on `main.gd`: on `NOTIFICATION_APPLICATION_PAUSED` or `NOTIFICATION_APPLICATION_FOCUS_OUT`, if previewing, `end_preview("cancel")` and `_show_screen(_home)` (do not call `show_home()`, so it does not count as an ad-eligible exit).

### 2d. `scripts/ui/player_screen.gd`
- `func open_preview(sound)`: set the title and art like `open_sound` does, but **do not** call `_autoplay_opened_sound`. Set `_preview_mode = true`. In preview mode: hide the favorite button, the repeat button, the timer chip row (`_timer_row`) and the pitch panel; add (once, in code) a small centred label under the title, `tr("Preview · %s") % "0:08"`, updated each frame from `AudioController.get_preview_seconds_left()` as `m:ss`, hidden outside preview. The play/stop button shows Stop (reuse `_set_play_stop_visual(true)`, `_apply_art_frame(true)`, `_start_breathe()`).
- `_on_play_stop()` in preview mode: `AudioController.stop()` (which ends the preview with `"stop"`). It must never call `play_sound` for a locked sound.
- `func close_preview()`: leave preview mode, restore the hidden controls (`_refresh_timer_chips()`, `_refresh_repeat_btn()`, `_refresh_rate_controls()`, favorite icon), hide the label, `_set_play_stop_visual(false)`, `_apply_art_frame(false)`, `_stop_breathe()`. Make it idempotent.
- `open_sound()` must also leave preview mode first (so a normal open never inherits hidden controls).
- The existing `_on_playback_stopped` already resets the visuals; make sure it and `close_preview` do not fight.

### 2e. `scripts/ui/paywall_screen.gd` copy
- In `_refresh()`, the final `else` branch (no focus sound and no rewarded offer) currently sets `_status.text = tr("Unlock 70+ stim sounds and remove ads.")`. Replace it with a dynamic line built from the catalog, not hard-coded numbers:
  ```
  var total := SoundCatalog.sounds.size()
  var free_count := SoundCatalog.get_free_sounds().size()
  _status.text = tr("Unlock all %d sounds (%d free, %d with Plus) and remove ads.") % [total, free_count, total - free_count]
  ```
  (95 / 14 / 81 today.) Do not invent a second loop or lock-screen playback anywhere in the copy.
- Remove the old "Unlock 70+ stim sounds and remove ads." key from `messages.json` once nothing uses it.

**New strings:** `Preview · %s`, `Unlock all %d sounds (%d free, %d with Plus) and remove ads.`

### Acceptance (item 2)
- [ ] Free user, nothing playing, taps a locked sound for the first time today: player opens, the sound plays for about 8 seconds (a one-shot repeats during those 8 seconds), a "Preview · m:ss" countdown shows, then the paywall opens for that sound. Audio is silent when the paywall appears.
- [ ] Stop during the preview: audio stops and the paywall opens. Back during the preview: audio stops and Home opens, **no** paywall. Backgrounding the app during the preview: preview ends, app returns to Home, nothing keeps playing.
- [ ] Tapping the same locked sound again the same day: paywall straight away, no preview. After force-quit and relaunch the same day: still no preview. Next calendar day: preview again.
- [ ] A different locked sound the same day still gets its own preview.
- [ ] If a free sound is playing, tapping a locked tile goes straight to the paywall and does not stop the playing sound.
- [ ] Plus users and users inside the item 7 window never preview (the sound just plays).
- [ ] The preview never appears in Recent, never feeds `sound_play` / `first_sound_play` / `listen_30s`, never starts the sleep timer, never counts toward the review prompt.
- [ ] No stuck audio on any path. Walk each one in code: timeout, Stop, Back, background, Settings, Now-playing bar, app resume after the deadline.
- [ ] `AdsService` still treats the preview as playback (interstitials suppressed while it runs): `_playback_active` follows `playback_started` / `playback_stopped`, which `play_preview` and `end_preview` emit.
- [ ] Paywall says "Unlock all 95 sounds (14 free, 81 with Plus) and remove ads." in the no-focus state. No other paywall text changed in this item.
- [ ] Commit: `StimPad: 8-second locked-sound preview, paywall says all 95 sounds (item 2)`.

---

## Item 7. One rewarded ad per day opens every sound for 20 minutes

**Today:** one rewarded ad unlocks **one sound until local midnight** (`entitlements.gd` `grant_temp_unlock`, `_temp_unlocks`; `ads_service.gd` `try_show_rewarded_for_sound`, `_on_rewarded_dismissed`; `paywall_screen.gd` only offers the ad when a specific locked sound opened the paywall). There is no daily cap.

**New rule:** **one** rewarded ad per local day unlocks **every** sound for **20 minutes**. Then it locks again and the paywall explains it with Buy and Restore. A second attempt the same day says "Come back tomorrow or get Plus".

**Decisions (made):**
- The window is a **wall-clock deadline in unix seconds**, saved in `LocalPrefs`, so it survives backgrounding, force-quit and relaunch. It is 20 minutes of real time (it does **not** stop at midnight).
- "Used today" is `LocalPrefs.library_unlock_last_day == today`. It is set when the reward is **granted**, not when an ad is requested, so a failed ad does not use up the day.
- **Plus owners** never see the ad option, and `grant_plus()` ends any active window.
- **Device clock changes:** if `now < library_unlock_started_unix - 5` (clock moved back before the start) or `until - now > 20 * 60 + 5` (deadline further away than a window can be), end the window at once with reason `"clock_changed"`. Moving the clock forward just ends it early. Do not try to defeat someone who changes the date to get another ad (they still watch an ad); do not build more than this. Say so in your report.
- **Banner:** leave the banner exactly as it is (it is the fragile part of ads). **Do suppress interstitials** while the window is active: add `and not Entitlements.is_library_unlocked()` to `ads_service.gd` `can_show_interstitial()`.
- **When the window ends while a locked sound is playing:** stop it and show the paywall with a friendly explanation (below). Only navigate to the paywall if the current screen is the Player, Home or Paywall; from Settings or Feedback just stop the audio (never yank someone out of a text box).
- Where the countdown shows: a one-line label on **Home** (above the Play again row) and under the title on the **Player**, both only while the window is active. Format `m:ss`.

### 7a. `scripts/autoload/entitlements.gd`
Replace the per-sound temp unlock with the library window. Keep the `temp_unlocks_changed` signal name (the Home grid already refreshes on it) and keep `is_temp_unlocked(sound_id)` as the function `SoundCatalog.is_sound_unlocked` calls, so `sound_catalog.gd` needs no change.
- `signal library_unlock_ended(reason: String)`
- `const LIBRARY_UNLOCK_SEC := 20 * 60`
- `func is_library_unlocked() -> bool`: not Plus and `LocalPrefs.library_unlock_until_unix > now`, after the clock sanity check above.
- `func library_unlock_seconds_left() -> int` (0 when inactive).
- `func can_start_library_unlock() -> bool`: not Plus, not active, `LocalPrefs.library_unlock_last_day != _today_key()`.
- `func library_used_today() -> bool`: `LocalPrefs.library_unlock_last_day == _today_key()`.
- `func grant_library_unlock() -> void`: no-op if Plus. Set `started = now`, `until = now + LIBRARY_UNLOCK_SEC`, `last_day = today`, `LocalPrefs.save_prefs()`, `set_process(true)`, emit `temp_unlocks_changed`. (The `rewarded_earned` event is logged in `ads_service.gd`, not here.)
- `is_temp_unlocked(sound_id)`: returns `not sound_id.is_empty() and is_library_unlocked()` (the id no longer matters).
- `func _end_library_unlock(reason: String)`: zero `until` and `started` (keep `last_day`), save, `set_process(false)`, emit `temp_unlocks_changed` and `library_unlock_ended(reason)`, log `library_unlock_ended` with `reason` (`"expired"`, `"clock_changed"`, `"plus_purchased"`).
- `_process(_delta)`: only runs while a window is active. If `now >= until`, or the clock sanity check fails, end it. Also check in `_notification` on `NOTIFICATION_APPLICATION_RESUMED` / `FOCUS_IN` (the engine does not run `_process` in the background).
- `_ready()`: after `load_state()`, if a saved window is already past its deadline, clear it **silently** (no event, no signal; the app was closed). If it is still valid, `set_process(true)` so the countdown and expiry work after a relaunch.
- `grant_plus()`: if a window was active, end it with `"plus_purchased"`. Remove `_temp_unlocks` (field, prune, load, save). `save_state()` writes only `has_plus`. Old files that still contain `temp_unlocks` are ignored.
- Remove `grant_temp_unlock`, `_prune_expired_temp_unlocks` and the dictionary. (Anyone holding a per-sound midnight unlock when they update loses it; that is fine.)

### 7b. `scripts/autoload/ads_service.gd`
- Replace `try_show_rewarded_for_sound(sound_id)` with `try_show_rewarded_for_library()`. Keep all the ad plumbing (SDK wait, `_apply_request_config_before_ad_load`, `_preload_rewarded`, `_wait_until_rewarded_settled`, the 8 second wait) exactly as it is. Change only the bookkeeping:
  - `_pending_reward_sound_id: String` becomes `_pending_reward_active: bool`. It is used as the "this request is still current" guard after each `await` and in `_on_rewarded_dismissed` (`if sound_id.is_empty(): return`); keep exactly that logic with the bool. Drop the `"No sound selected."` check and its string. Map the existing failure messages to `rewarded_failed` reason codes: "Ads aren't ready yet" = `not_ready`, "Ad is still loading" = `loading`, "No ad available" = `no_ad`, "Couldn't show the ad" = `show_failed`.
  - Pre-checks, in this order: Plus, or a window already active → emit `rewarded_unlock_completed` and return (nothing to do). `not Entitlements.can_start_library_unlock()` (used today) → `_emit_rewarded_failed("daily_used", tr("Come back tomorrow or get Plus"))`. Desktop/editor (`not OS.has_feature("mobile")`): `Entitlements.grant_library_unlock()`, emit completed. `_playback_active` → `_emit_rewarded_failed("playback_active", tr("Stop playback first."))`.
- `_on_rewarded_dismissed`: if `earned` → `Entitlements.grant_library_unlock()`, log `rewarded_earned` with `scope: "library"` and `minutes: 20`, emit `rewarded_unlock_completed`; else `_emit_rewarded_failed("closed_early", tr("Watch the full ad to unlock."))`.
- `signal rewarded_unlock_completed(sound_id: String)` loses its `sound_id` argument; update the one listener in `paywall_screen.gd`.
- `can_offer_rewarded()`: unchanged (it already returns false for Plus).
- `can_show_interstitial()`: add the window check described above.

### 7c. `scripts/ui/paywall_screen.gd`
- `open_for_sound(sound, reason := "")` / `_refresh()`: the ad is now offered whether or not a sound is in focus. Compute `offer_rewarded = AdsService.can_offer_rewarded() and Entitlements.can_start_library_unlock()`. Copy per state (all `tr()`):
  - **Plus owned:** unchanged ("You're all set"...). No watch button.
  - **Window active** (user came from the Plus button): subtitle `tr("Plus unlocked: %s left") % m:ss`, status `tr("Everything is open for now. Get Plus to keep it, with no ads.")`, watch hidden, Buy and Restore visible. Update the countdown text each second while the paywall is visible.
  - **Locked sound in focus, ad available:** subtitle `tr("\"%s\" is a Plus sound") % sound_name`, status `tr("Watch one ad and every sound is open for 20 minutes today. Or get Plus for good.")`, watch hint `tr("Plus free for 20 min")`.
  - **Ad already used today, not Plus:** watch hidden; status `tr("Come back tomorrow or get Plus")`.
  - **Reason `library_window_ended`:** status `tr("Your 20 minutes of Plus are up. Get Plus to keep every sound, or tap Restore if you already bought it.")`. Buy and Restore stay visible.
  - **No focus, ad available:** the existing "all sounds" subtitle, status from item 2's dynamic line, plus the watch button.
- `main.gd` `show_paywall(for_sound, reason)` already receives `reason` (item 4); have it forward `reason` to `_paywall.call("open_for_sound", for_sound, reason)`.
- `_on_watch_ad`: no `sound_id` needed. Log `paywall_watch_ad_tap` with `scope: "library"`, set status "Loading ad…", call `AdsService.try_show_rewarded_for_library()`.
- `_on_rewarded_done()`: if a focus sound is set, `_nav_call("show_player", [_focus_sound])` (it is unlocked now, so it plays); otherwise `_nav_call("show_home")`.
- **Restore feedback (UI only, no StoreKit change):** on iOS, tapping Restore with nothing to restore produces no signal at all today, so the paywall just sits there. In `_on_restore`: set `_status.text = tr("Checking your purchases…")`, and start a one-shot 6 second `SceneTreeTimer`. If Plus is still not owned when it fires **and** the paywall is still visible, set `_status.text = tr("No purchase found for this Apple ID.")`. Ignore the timer result if `Entitlements.has_plus()` became true. The existing `_on_restored` / `_on_purchase_done` texts stay.
- The layout uses `_set_watch_visible(...)`, which tightens spacing when the watch button shows. Do not change the layout code; just drive visibility.

### 7d. `scripts/ui/main.gd`, `home_screen.gd`, `player_screen.gd`
- `main.gd`: connect `Entitlements.library_unlock_ended` to `_on_library_unlock_ended(reason)`. Logic: take `AudioController.get_current_sound()`; if something is playing and `not SoundCatalog.is_sound_unlocked(sound)` (a Plus sound that just became locked), `AudioController.stop()`, and if `_current_screen` is the player, home or paywall, `show_paywall(sound, "library_window_ended")`. For reason `"plus_purchased"` do nothing (Plus unlocks everything).
- `home_screen.gd`: build one `Label` row in code (above the Play again row, i.e. right after `CategorySelect`), text `tr("Plus unlocked: %s left") % m:ss`, mint-tinted like the chip look, font 14, centred; visible only while `Entitlements.is_library_unlocked()`; refreshed in `_process` only when visible (compare text before assigning) and on `temp_unlocks_changed`. It must not trigger a grid rebuild by itself.
- `player_screen.gd`: the same label under the title, same rule.
- Remove from code and `messages.json` once unused (check each with `rg`): `%s unlocked until midnight. Buy Plus for everything, no ads.`, `Unlock until midnight`, `Watch an ad for today, or unlock everything with Plus.`, `No sound selected.`, and any `Unlock "%s" or go Plus` text you replace.

**New strings:** `Plus unlocked: %s left`, `Plus free for 20 min`, `Watch one ad and every sound is open for 20 minutes today. Or get Plus for good.`, `Come back tomorrow or get Plus`, `Your 20 minutes of Plus are up. Get Plus to keep every sound, or tap Restore if you already bought it.`, `Everything is open for now. Get Plus to keep it, with no ads.`, `"%s" is a Plus sound`, `Checking your purchases…`, `No purchase found for this Apple ID.`

**Events:** `rewarded_earned {scope: "library", minutes: 20}`, `rewarded_failed {reason}`, `paywall_watch_ad_tap {scope: "library"}`, `library_unlock_ended {reason}`, `paywall_view {reason: "library_window_ended"}` (from item 4).

### Acceptance (item 7)
- [ ] Free user, no ad used today: paywall shows the watch button with "Plus free for 20 min"; after the full ad, every locked sound plays normally for 20 minutes and the Home grid shows them unlocked; "Plus unlocked: m:ss left" counts down on Home and Player.
- [ ] Interstitials do not appear during the window; the banner is unchanged.
- [ ] Force-quit and relaunch with 12 minutes left: the window is still active with about 12 minutes left. Relaunch after it ended: locked, no crash, no stray paywall.
- [ ] Lock the phone for 10 minutes mid-window, unlock: the remaining time is correct (wall clock), not paused.
- [ ] Window ends while a locked sound is playing on the Player or Home: audio stops and the paywall opens with the "Your 20 minutes..." text and Buy + Restore. Ends while in Settings: audio stops, no navigation.
- [ ] Ad granted at 11:50 PM: still active at 12:05 AM (not cut at midnight); a new ad becomes possible only after it ended **and** the date changed.
- [ ] Second ad attempt the same day: no watch button, status "Come back tomorrow or get Plus". A failed or abandoned ad does not use up the day.
- [ ] Moving the phone clock back during a window ends it (`clock_changed`); moving it forward ends it early. No crash either way.
- [ ] Owning Plus: no watch button anywhere, `grant_plus()` ends a running window cleanly, locked tiles just play.
- [ ] Restore with nothing to restore shows "Checking your purchases…" and then "No purchase found for this Apple ID."; Restore that finds Plus unlocks as before.
- [ ] `rg -n "grant_temp_unlock|try_show_rewarded_for_sound|_temp_unlocks" scripts` finds nothing. `rg -n "midnight" scripts` finds nothing user-facing.
- [ ] Product ids, `PROD_*` ad units and StoreKit signals are untouched (`git diff` shows no change on those lines).
- [ ] Commit: `StimPad: one rewarded ad per day opens every sound for 20 minutes (item 7)`.

---

## Item 3. Sleep timer keeps any sound going

**Today (`audio_controller.gd`):** 15/30/60 only arms the stop timer when `_sound_holds_open()` is true (`mode == "loop"` or the global Repeat setting). A pen click with "15 min" selected plays once and stops. 53 of 95 sounds are one-shots.

**Goal:** with 15, 30 or 60 selected, **any** sound (loop or one-shot) keeps going until the deadline, **without** turning on the global Repeat setting. "Until I stop" (0) is unchanged: loops loop, one-shots play once.

**Design (made):** do **not** flip loop flags on the stream and do not touch `LocalPrefs.repeat_oneshots`. For a one-shot under a timer, when the player emits `finished`, replay it while the wall-clock deadline has not passed. That is deterministic, it also works when the timer is chosen mid-play, and choosing "Until I stop" later simply lets the current pass finish.

Changes, all in `scripts/autoload/audio_controller.gd`:
1. `play_sound()`: in the final `else` branch (not loop, not forced repeat) replace `_clear_stop_timer()` by: `if _session_duration_sec > 0: _arm_stop_timer() else: _clear_stop_timer()`. Leave the loop branch as it is.
2. `set_session_duration(seconds)`: replace `if is_playing() and _sound_holds_open(): _arm_stop_timer() else: _clear_stop_timer()` by `if is_playing() and seconds > 0 and not _previewing: _arm_stop_timer() else: _clear_stop_timer()`. (Keep the saving of the preference and the `session_duration_changed` signal as is.)
3. `_on_player_finished()`: call `_check_stop_deadline()` first, and if the player was stopped by it, return. Then in the "Fallback: keep replaying" branch use: `if mode == "loop" or LocalPrefs.repeat_oneshots or _stop_at_unix > 0: _player.play(); return`. (`_check_stop_deadline` already clears `_stop_at_unix` and stops when the deadline passed, so a past deadline never replays.)
4. `_sound_holds_open()` may become unused after step 2. Delete it only if nothing else calls it (`rg -n "_sound_holds_open"`).
5. `_arm_stop_timer()` logs `timer_started` once per arming (item 4 added it) and `_on_session_timer_timeout()` logs `timer_finished`. Check both still fire for a one-shot.
6. **Backgrounding:** nothing new to build. Verify by reading that: the engine stops the audio driver when the app resigns active (so sound is silent on lock; a known limit, not changed here); `NOTIFICATION_APPLICATION_FOCUS_IN` and `RESUMED` call `_check_stop_deadline()` before the driver restarts, so a deadline that passed while locked stops the sound without a blip; a deadline that has not passed lets the sound resume and the countdown continues from the wall clock. Do not add code for this; just confirm it in your report with the line numbers.

Do **not** change `repeat_oneshots`, the Repeat button, `_enable_stream_loop`, the chip UI in `player_screen.gd`, or the Now-playing countdown.

### Acceptance (item 3)
- [ ] Rain (loop), 15 min: countdown runs and the sound stops at 0 (as before).
- [ ] Pen click (one-shot), 15 min, global Repeat **off**: the click keeps replaying until the deadline, then stops; Settings > Repeat is still off afterward and `LocalPrefs.repeat_oneshots` was never written.
- [ ] Pen click, "Until I stop": plays once and stops, exactly as before.
- [ ] Choosing a time **while** a one-shot is already playing arms the deadline and the next replay happens; choosing "Until I stop" mid-way lets it end after the current pass.
- [ ] Choosing 30 min then tapping a different sound: the new sound is held for 30 min too (the timer is a saved preference, same as today). Stop clears it.
- [ ] After backgrounding past the deadline, the sound does not resume; before the deadline it resumes.
- [ ] A preview (item 2) never arms the sleep timer.
- [ ] Besides the analytics lines from item 4, only `audio_controller.gd` changed in this commit.
- [ ] Commit: `StimPad: sleep timer holds one-shot sounds until the deadline (item 3)`.

---

## Item 5. Review timing, and the real in-app review sheet

**Today:**
- `enjoy_prompt_service.gd`: asks from the 3rd app open (`MIN_APP_OPENS := 3`), after 2 sound opens this session (`MIN_SESSION_SOUND_OPENS`), when the user returns Home (`on_returned_home()`, 1.4 second settle). X snoozes 5 days, "No" snoozes 7 days and opens the feedback form, "Yes" calls `ReviewService.request_review()`. `show_home()` in `main.gd` may show an interstitial first and then calls `on_returned_home()`, so the prompt can land on top of an ad.
- `review_service.gd` `request_review()` on iOS looks for a plugin, and when none is found it **opens the App Store write-review page** through `OS.shell_open` (that leaves the app). There is no review plugin in the project. `docs/PLUGIN_SETUP.md` claims `StoreKitManager.request_review` exists in the pinned GodotApplePlugins build. **That is wrong**: the pinned build (`3781b9c19eaf...`, June 2026) is older than the commit that added that method (Aug 18, 2026). Do not rely on it.
- The existing plugin binding code in `review_service.gd` could never work with the real plugin below: it looks for a class or singleton named `InappReview` (the real singleton is `InappReviewPlugin`), and it `await`s `review_info_generated`, which the plugin emits synchronously, so the await would hang and leave `_busy = true` forever.

**Goal:** ask only after a **real listen** (45 seconds on one sound), from the **2nd app open or later** (never the first), back on Home, **no ad on screen**, using Apple's in-app review sheet, and **never** leave the app for Safari or the App Store from this flow. Keep the "Are you enjoying StimPad?" prompt, "No" going to the feedback form, X snoozing.

### 5a. Timing and the review request (commit 1)
**`audio_controller.gd`:** extend item 4's accumulator. Add `signal listened_enough(sound_id: String)` and `const LISTEN_ENOUGH_SEC := 45.0`; emit it **once per play start** when `_listen_accum_sec` first reaches it. (Previews never use the accumulator, so they can never trigger it.)

**`ads_service.gd`:** add `func is_fullscreen_ad_showing() -> bool`. Track `_fullscreen_ad_since_unix: float` (0 = none): set it at the exact spot where the code calls the plugin's show for an interstitial (inside `try_show_interstitial_on_safe_exit()`) and for a rewarded ad (inside `try_show_rewarded_for_library()`, after item 7; before item 7 that is `try_show_rewarded_for_sound()`); also set it in `_on_interstitial_showed`. Clear it in `_on_interstitial_dismissed`, `_on_interstitial_failed_to_show`, `_on_rewarded_dismissed`, `_on_rewarded_failed_to_show`. (There are no functions called `show_interstitial_ad` or `show_rewarded_ad`; the calls are `_admob.show_rewarded_ad()` and the interstitial equivalent in `try_show_interstitial_on_safe_exit()`.) Treat a value older than 180 seconds as "not showing" (a safety net if a dismiss callback never arrives). Only add these lines; do not change ad loading.

**`feature_tip_service.gd`:** add `func is_showing() -> bool: return _tip != null and is_instance_valid(_tip)`.

**`enjoy_prompt_service.gd`:**
- `const MIN_APP_OPENS := 2` (never on the first open; `LocalPrefs.app_open_count` is 1 on the first cold start). Update the comments.
- Replace the "2 sound opens" rule with the listen rule: connect `AudioController.listened_enough` in `_ready()` and set `_qualified_listen = true` (session-only variable). Remove `MIN_SESSION_SOUND_OPENS`, `_session_sound_opens`, and the checks that used them (`note_sound_opened()` may be removed along with its caller in `main.gd`; do not touch `FeatureTipService.note_sound_opened()`).
- `on_returned_home()` and `_on_settle_elapsed()`: require `_qualified_listen`. In `_on_settle_elapsed()` (after the 1.4 second settle) also skip if `AdsService.is_fullscreen_ad_showing()` or `FeatureTipService.is_showing()` or the paywall is the current screen. If any of those blocks it, do **not** burn the opportunity: leave `_qualified_listen` set so the next return to Home can retry.
- Keep: `enjoy_prompt_completed` permanent after "Yes", the X snooze (5 days), the "No" snooze (7 days) plus feedback.
- Keep the debug "Force enjoy prompt" menu working (`force_show_now()`).

**`review_service.gd`:**
- Make `request_review()` return a `bool` (`true` = the system sheet was requested) and **never hang and never open a URL on iOS**. Remove the `_busy` await pattern. New iOS order:
  1. If `Engine.has_singleton("InappReviewPlugin")`: `Engine.get_singleton("InappReviewPlugin").launch_review_flow()`; log `review_request_attempted` with `method: "inapp_plugin"`; return `true`. **Do not** call `generate_review_info()` and do not `await` any of its signals (this plugin emits them synchronously inside the call).
  2. Else if `ClassDB.class_exists("StoreKitManager")`, instantiate it and, if it `has_method("request_review")`, call it and return `true` with `method: "storekit_manager"`. (Today's pinned build does not have it; keep this as a harmless forward-compatible path.)
  3. Else: log `review_request_unavailable` and return `false`. **No `OS.shell_open` anywhere in this path.**
- Android and the editor stub keep their current behaviour (do not touch Android).
- `open_write_review()` (the Settings "Rate StimPad" row) stays **exactly as is**: an explicit tap on a button is the one place that opens the App Store page.
- Delete the broken iOS plugin-binding helpers (`_try_bind_plugin`, the iOS half of `_launch_inapp_review_plugin`, the `RequestReview` singleton guess); keep whatever Android still uses. Keep `_fallback_store_url()` for `open_write_review()` and Android.

**`enjoy_prompt.gd`:** change `_on_yes()` to this shape (use the real node names in that file; `_finish()` must stay idempotent):
```
LocalPrefs.mark_enjoy_prompt_completed()
AnalyticsService.log_event("enjoy_yes", {})
var ok: bool = await ReviewService.request_review()
if ok:
    _finish()
else:
    # No review sheet in this build: say thanks, never leave the app.
    _title.text = tr("Thank you!")
    _subtitle.text = tr("You can rate StimPad anytime in Settings > Rate StimPad.")
    _no_btn.visible = false
    _yes_btn.text = tr("OK")
    _yes_btn.pressed.disconnect(_on_yes)
    _yes_btn.pressed.connect(_finish)
```
"No" and the X button are unchanged.

**New strings:** `Thank you!`, `You can rate StimPad anytime in Settings > Rate StimPad.`, `OK` (it is not in `messages.json` today; add it).

**Events:** `review_request_attempted {method}`, `review_request_unavailable`, `enjoy_prompt_shown` (keep its existing params; replace `session_sound_opens` by `qualified_listen: true`). Stop logging `review_store_url_opened` from this flow.

**Acceptance (5a):**
- [ ] First app open: the prompt never appears, however long they listen.
- [ ] Second open or later, a sound played for at least 45 seconds, user taps Back to Home: prompt appears after about 1.4 seconds. A shorter listen: no prompt.
- [ ] If an interstitial or rewarded ad is on screen, a feature tip is showing, or the paywall is open: the prompt waits for the next return to Home.
- [ ] "Yes" with no plugin present: the card turns into "Thank you!" plus the Settings hint, with an OK button; nothing opens. `rg -n "shell_open" scripts` shows only `open_write_review`'s fallback, the Android path, and the privacy link. "No" still opens the feedback form. X still snoozes 5 days.
- [ ] `request_review()` can never hang (no `await` on a signal that may not come).
- [ ] Commit: `StimPad: ask for a review after a real 45-second listen, never open Safari (item 5a)`.

### 5b. Install the in-app review plugin (separate commit, so Brock can drop it on its own)
Chosen because it is a classic Godot iOS plugin (a `.gdip` plus an xcframework), exactly like `AdmobPlugin`, which is already committed in this repo. It does not touch GodotApplePlugins' SwiftGodot runtime that GodotFirebaseiOS also relies on, so it cannot disturb Firebase or StoreKit. The version is **v5.2** of `godot-mobile-plugins/godot-inapp-review` (tested with Godot 4.6; v5.3 is for 4.7, do not use it). It calls Apple's `AppStore.requestReview(in:)` / `SKStoreReviewController`.

Steps:
1. Download the Multi zip into a temp folder outside the repo and check it:
   ```
   curl -L -o /tmp/InappReviewPlugin-Multi-v5.2.zip https://github.com/godot-mobile-plugins/godot-inapp-review/releases/download/v5.2/InappReviewPlugin-Multi-v5.2.zip
   shasum -a 256 /tmp/InappReviewPlugin-Multi-v5.2.zip
   ```
   Expected SHA-256: `f1fdac06b6020e06ffd19d36155a452d7b715c12600b9eb52df54961eee9a6e1`. **If it differs, stop and tell me.** If you cannot download, stop and tell me (do not substitute another plugin).
2. Unzip to `/tmp`, then copy into the repo **exactly** these paths: `addons/InappReviewPlugin/` (contains `InappReview.gd`, `InappReviewPlugin.gd`, `plugin.cfg`, `icon.png`, `bin/`) and `ios/plugins/InappReviewPlugin.gdip`, `ios/plugins/InappReviewPlugin.debug.xcframework/`, `ios/plugins/InappReviewPlugin.release.xcframework/`. Do not modify any of these files. Check the `.gdip` uses `;` comments (it does; CI fails on `#`).
3. `export_presets.cfg`: in `[preset.1.options]` (the iOS preset) add one line **right after** `plugins/AdmobPlugin=true`: `plugins/InappReviewPlugin=true`. No other line in that file changes. Do not add it to the Android preset.
4. `project.godot`: in `[editor_plugins]`, append `"res://addons/InappReviewPlugin/plugin.cfg"` to the `enabled=PackedStringArray(...)` list. Nothing else in the file changes.
5. Do not edit `.github/workflows/*`. (The preflight greps still pass; the new plugin is not required by them.)
6. In `docs/PLUGIN_SETUP.md`, correct the "In-app review" section: say the pinned GodotApplePlugins build does not contain `request_review`, and that the app uses InappReview v5.2 (the `InappReviewPlugin` singleton). That is the only docs edit.

**Acceptance (5b):**
- [ ] The zip checksum matched. Only the paths in step 2, the two one-line config edits and the docs section changed.
- [ ] `ios/plugins/InappReviewPlugin.gdip` has no `#` lines.
- [ ] Commit: `StimPad: add InappReview v5.2 iOS plugin for the real review sheet (item 5b)`.
- [ ] If this commit ever fails to build in CI, Brock can `git revert` just this commit: 5a keeps working (it shows the thank-you card when the plugin is missing).

---

## Item 8 (lock-screen audio): NOT part of this task
Do **not** add `UIBackgroundModes`, change `general/ios/session_category` or `mix_with_others`, touch `additional_plist_content`, or edit the `[audio]` comment in `project.godot`. Godot 4.6 stops the iOS audio driver whenever the app resigns active, and there is no project setting to keep it running. Brock's notes explain this. Leave everything as it is.

---

## Final checks (before reporting)
- `git log --oneline b339ddd914..HEAD` shows the commits in the order **4, 1, 2, 7, 3, 5a, 5b**.
- `git diff b339ddd914..HEAD --stat` lists only the files in "Files you are expected to change".
- `git diff b339ddd914..HEAD -- project.godot export_presets.cfg` shows exactly: one list entry in `project.godot`, one added line in `export_presets.cfg`. No version, signing, product id, ad unit id or `[audio]` line changed.
- `git diff b339ddd914..HEAD -- '*.tscn'` is empty.
- `python3 -c "import json;json.load(open('locale/messages.json'))"` passes, and every new key has all five locales (a small script that lists keys missing any of `de es fr pt_BR ja` must print nothing).
- `rg -n "4\.99|\"USD\"" scripts` only finds `DISPLAY_PRICE`.
- `rg -n "shell_open" scripts` finds only `review_service.gd` (`open_write_review` / Android) and `settings_screen.gd` (privacy link).
- `rg -n "grant_temp_unlock|try_show_rewarded_for_sound|_temp_unlocks|_sound_holds_open" scripts` finds nothing, and `rg -n "MIN_SESSION_SOUND_OPENS" scripts/autoload/enjoy_prompt_service.gd` finds nothing (`feature_tip_service.gd` keeps its own constant of that name; leave it).
- Run whatever syntax checks exist (see "What you can and cannot run").

## STOP AND REPORT
Reply with:
1. **Step 0 result:** what `git status` / `git log` showed, the commit the branch starts from, and anything odd (stashes, untracked files).
2. **Diff summary:** per item, the files changed and one line on what changed, plus `git diff --stat b339ddd914..HEAD`.
3. **Every new or changed user-facing string**, quoted exactly, with its file, and confirmation that all five locales exist for each.
4. **Every new analytics event** with its params, and where it fires.
5. **Item 4 findings:** which property names the StoreKit product and transaction objects actually exposed (or that you could not tell off-device), and whether `purchase` will carry `value`/`currency` on a real purchase (expected: only when a currency code is available, otherwise `price_display` only).
6. **Anything in this prompt that did not match the code**, and what you did about it.
7. **Checks you ran** (Godot headless parse, JSON check, `rg` checks) and which you could not run, plus what Brock must test on a phone: Play again on a small phone, preview once per sound per day, the 20-minute window (countdown, relaunch, midnight, window ending mid-sound), sleep timer on a one-shot, review prompt only from the second open, and the InappReview plugin launching without a crash.
8. Confirmation that you did **not**: push, touch `main`, change version numbers, product ids, ad unit ids, signing, CI workflows, the `[audio]` settings, any `.tscn`, or the GodotApplePlugins pin.
