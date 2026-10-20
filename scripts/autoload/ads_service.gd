extends Node

signal banner_visibility_changed(visible: bool)
signal house_banner_changed
signal privacy_choices_availability_changed(available: bool)
signal rewarded_unlock_completed
signal rewarded_unlock_failed(reason: String)

## iOS production (AdMob app + units).
const PROD_APP_ID_IOS := "ca-app-pub-5356882403986713~1231581339"
const PROD_BANNER_IOS := "ca-app-pub-5356882403986713/8726927974"
const PROD_INTERSTITIAL_IOS := "ca-app-pub-5356882403986713/9050627536"
const PROD_REWARDED_IOS := "ca-app-pub-5356882403986713/3474601293"
## Android production ids. The AdMob Android app is not linked to a store yet;
## Brock links it after the Play launch, and fill may be limited until then.
const PROD_APP_ID_ANDROID := "ca-app-pub-5356882403986713~7546788183"
const PROD_BANNER_ANDROID := "ca-app-pub-5356882403986713/6529044973"
const PROD_INTERSTITIAL_ANDROID := "ca-app-pub-5356882403986713/9366961309"
const PROD_REWARDED_ANDROID := "ca-app-pub-5356882403986713/8333081239"

const GOOGLE_TEST_APP_ID := "ca-app-pub-3940256099942544~3347511713"
const ATT_TEXT := (
	"StimPad uses this to show more relevant ads on the free tier. "
	+ "You can change this anytime in Settings."
)

## Cold-start ads on after splash/home ready (W4D/Circuit Sort: ATT → initialize → UMP).
## Still gated behind notify_ui_ready() so we never init during the texture spike.
const ENABLE_COLD_START_ADS := true

var _ads_enabled: bool = true
## True only after ATT (iOS) + UMP consent + Mobile Ads init — ads must not load before this.
var _sdk_ready: bool = false
var _admob_ready: bool = false
var _mobile_ads_init_started: bool = false
var _admob_init_cb_fired: bool = false
var _ump_started: bool = false
var _android_gather_active: bool = false
var _android_privacy_form_open: bool = false
var _android_consent_finished: bool = false
var _ads_blocked_by_consent: bool = false
var _consent_bridge_cached: Variant = null
var _consent_bridge_lookup_failed: bool = false
var _playback_active: bool = false
var _admob: Admob
var _interstitial_ready: bool = false
var _rewarded_ready: bool = false
var _admob_setup_started: bool = false

var _att_resolved: bool = false
var _att_pending: bool = false
var _consent_form_pending: bool = false
var _privacy_settings_request: bool = false
## Single native banner for the whole free-tier session (AdMob auto-refreshes ~30–60s).
var _banner_load_requested: bool = false
var _banner_load_in_flight: bool = false
var _banner_retry_count: int = 0
var _rewarded_load_in_flight: bool = false
var _rewarded_retry_count: int = 0
var _interstitial_load_in_flight: bool = false
var _interstitial_retry_count: int = 0
## True after AdMob reports a banner impression (ad actually on screen).
var _banner_impression_recorded: bool = false
var _banner_measured_height: float = 0.0

const BANNER_RETRY_MAX := 4
const REWARDED_RETRY_MAX := 3
const INTERSTITIAL_RETRY_MAX := 3
## Google: do not immediately re-request after no-fill (code 3). One late retry
## lets fill appear if AdMob verifies the app mid-session.
const NO_FILL_RETRY_SEC := 120.0
const AD_ERROR_INTERNAL := 0
const AD_ERROR_INVALID_REQUEST := 1
const AD_ERROR_NETWORK := 2
const AD_ERROR_NO_FILL := 3

## Interstitials: not every navigation — every Nth safe exit, with a cooldown.
const INTERSTITIAL_EVERY_N_EXITS := 3
const INTERSTITIAL_MIN_INTERVAL_SEC := 90.0
## One banner stays on every screen. A new creative is requested this often.
## AdMob's own refresh, if it fires, resets this wait so two requests are not stacked.
const BANNER_REFRESH_SEC := 45.0
## A few points so the last control does not sit on the ad's top edge.
const BANNER_UI_GAP := 4.0

var _safe_exit_count: int = 0
var _last_interstitial_unix: float = -99999.0
var _banner_mounted: bool = false
var _banner_refresh_armed: bool = false
var _banner_refresh_gen: int = 0
var _banner_ad_id: String = ""
var _last_banner_creative_unix: float = -99999.0
var _house_ad: Dictionary = {}
var _house_logged: bool = false
var _pending_reward_active: bool = false
var _fullscreen_ad_since_unix: float = 0.0
var _reward_earned_pending: bool = false
## Main UI (home grid) finished first paint — set via notify_ui_ready().
var _ui_ready: bool = false


func _ready() -> void:
	AudioController.playback_started.connect(_on_playback_started)
	AudioController.playback_stopped.connect(_on_playback_stopped)
	AudioController.playback_finished.connect(_on_playback_stopped)
	## Do not start AdMob until Main dismisses the boot overlay (home content ready).
	## Starting during cold load / texture spike crashes TestFlight devices.
	## _process only polls the Android consent bridge.
	set_process(false)


func _notification(what: int) -> void:
	if what == NOTIFICATION_APPLICATION_RESUMED:
		keep_banner_visible()


func notify_ui_ready() -> void:
	if _ui_ready:
		return
	_ui_ready = true
	if not ENABLE_COLD_START_ADS:
		print("[AdsService] Cold-start ads disabled — skipping AdMob init (crash isolation)")
		return
	call_deferred("_initialize_ads")


func set_ads_enabled(enabled: bool) -> void:
	_ads_enabled = enabled
	if not enabled:
		_banner_load_requested = false
		_banner_load_in_flight = false
		_banner_measured_height = 0.0
		hide_banner()
	else:
		ensure_banner_mounted()
	banner_visibility_changed.emit(should_show_banner())


func _banner_slot_open() -> bool:
	## The bottom slot stays reserved for non-Plus players even before AdMob
	## is ready, so the bar is a house ad instead of an empty gray strip.
	return _ads_enabled and not Entitlements.has_plus() and not _ads_blocked_by_consent


func should_show_banner() -> bool:
	return (
		_banner_slot_open()
		and _has_mobile_ads()
		and _sdk_ready
	)


func is_native_banner_showing() -> bool:
	return _banner_mounted and _banner_impression_recorded


func should_show_house_banner() -> bool:
	return _banner_slot_open() and not _banner_mounted


func current_house_ad() -> Dictionary:
	if _house_ad.is_empty():
		_rotate_house_ad(false)
	return _house_ad


func open_current_house_ad() -> void:
	var ad := current_house_ad()
	var url := str(ad.get("url", ""))
	if url.is_empty():
		return
	print("[AdsService] house ad open id=%s" % str(ad.get("id", "")))
	OS.shell_open(url)


func _rotate_house_ad(avoid_current: bool) -> void:
	var pool := HouseAds.for_platform()
	if pool.is_empty():
		_house_ad = {}
		return
	var choices: Array[Dictionary] = []
	var current_id := str(_house_ad.get("id", ""))
	for ad in pool:
		if avoid_current and str(ad.get("id", "")) == current_id:
			continue
		choices.append(ad)
	if choices.is_empty():
		choices = pool
	_house_ad = choices[randi() % choices.size()]


func _show_house_banner(rotate: bool) -> void:
	if not should_show_house_banner():
		return
	if rotate or _house_ad.is_empty():
		_rotate_house_ad(rotate)
	if not _house_logged:
		_house_logged = true
		print("[AdsService] house ad showing id=%s platform=%s" % [
			str(_house_ad.get("id", "")),
			"ios" if OS.has_feature("ios") else "android",
		])
	house_banner_changed.emit()


func _banner_width_dp() -> int:
	## AdMob wants the width in points. Prefer the Godot viewport, which is
	## already in points with this project's stretch settings. Dividing a
	## point width by the screen scale asks AdMob for a banner that is too
	## narrow and looks cut off.
	var view_w := float(get_viewport().get_visible_rect().size.x)
	var scale := DisplayServer.screen_get_scale()
	var win_w := float(DisplayServer.window_get_size().x)
	var points := view_w
	if scale > 1.01 and win_w > view_w * 1.25:
		points = win_w / scale
	if view_w >= 320.0 and points > view_w * 1.25:
		points = view_w
	return maxi(320, int(round(points)))


func _choose_banner_height(measured: float, scale: float, win_h: float, view: Vector2) -> float:
	## Anchored adaptive banners are about 50pt on a phone and 90pt on a tablet.
	## The plugin may report that height in viewport units or in screen pixels.
	## Pick the reading that looks like a banner. Dividing a point height, or
	## clamping a pixel height, is what left the ad covering the sound screen.
	var tablet := Responsive.is_tablet(view)
	var fallback := 90.0 if tablet else 50.0
	var max_h := minf(view.y * 0.22, 160.0 if tablet else 110.0)
	if max_h < 50.0:
		max_h = 50.0
	if measured < 32.0:
		return fallback
	var options: Array[float] = [measured]
	if scale > 1.01:
		options.append(measured / scale)
	if win_h > view.y * 1.2 and win_h > 1.0:
		options.append(measured * view.y / win_h)
	var best := fallback
	var best_dist := 100000.0
	var found := false
	for option in options:
		if option < 32.0 or option > max_h:
			continue
		var dist := absf(option - fallback)
		if not found or dist < best_dist:
			found = true
			best = option
			best_dist = dist
	return best if found else fallback


func _banner_height_viewport() -> float:
	var view := get_viewport().get_visible_rect().size
	var scale := DisplayServer.screen_get_scale()
	var win_h := float(DisplayServer.window_get_size().y)
	var readings: Array[float] = []
	if _banner_measured_height >= 32.0:
		readings.append(_banner_measured_height)
	if _admob != null and _admob.is_banner_ad_loaded():
		var dim := _admob.get_banner_dimension(_banner_ad_id)
		if dim.y >= 32.0:
			readings.append(dim.y)
		var px := _admob.get_banner_dimension_in_pixels(_banner_ad_id)
		if px.y >= 32.0:
			readings.append(px.y)
	if readings.is_empty():
		return _choose_banner_height(0.0, scale, win_h, view)
	## Use the tallest sane reading so a pixel value cannot shrink the slot
	## under the creative that is actually on screen.
	var best := 0.0
	for reading in readings:
		best = maxf(best, _choose_banner_height(reading, scale, win_h, view))
	return best


func banner_reserved_height() -> float:
	if not _banner_slot_open():
		return 0.0
	## Keep the slot from the moment a banner should be on screen, so controls
	## are already above it when the creative appears.
	return _banner_height_viewport() + BANNER_UI_GAP


func can_show_interstitial() -> bool:
	if not (
		_ads_enabled
		and not Entitlements.has_plus()
		and not Entitlements.is_library_unlocked()
		and not _playback_active
		and not _ads_blocked_by_consent
		and _has_mobile_ads()
		and _sdk_ready
		and _interstitial_ready
	):
		return false
	var now := Time.get_unix_time_from_system()
	if now - _last_interstitial_unix < INTERSTITIAL_MIN_INTERVAL_SEC:
		return false
	return true


func can_offer_rewarded() -> bool:
	if Entitlements.has_plus():
		return false
	if not _ads_enabled or _ads_blocked_by_consent:
		return false
	## Desktop/editor: simulate rewarded unlock for testing.
	if not OS.has_feature("mobile"):
		return true
	## Show Watch Ad even before SDK init (_admob may still be null).
	return (
		Engine.has_singleton("AdmobPlugin")
		or ResourceLoader.exists("res://addons/AdmobPlugin/Admob.gd")
	)


func ensure_initialized_for_rewarded() -> void:
	## Safe path: only start AdMob once home UI is up and user hit a locked sound.
	if _sdk_ready or _admob_setup_started:
		return
	if not _ui_ready:
		_ui_ready = true
	call_deferred("_initialize_ads")


func ensure_banner_mounted() -> void:
	## One native banner for the whole free-tier session (Home / Player / Settings / Paywall).
	## Navigation must never loadAd — only show the existing view.
	if not should_show_banner():
		if _banner_mounted:
			hide_banner()
		return
	if _admob != null and _admob.is_banner_ad_loaded():
		_show_current_banner()
		return
	_show_banner_native()


func keep_banner_visible() -> void:
	## Re-show the same banner after screen changes, app resume, or a full-screen ad.
	## Does not request a new ad.
	if not should_show_banner():
		return
	if _admob != null and _admob.is_banner_ad_loaded():
		_show_current_banner()
		return
	ensure_banner_mounted()


func show_banner_if_allowed() -> void:
	ensure_banner_mounted()


func hide_banner() -> void:
	_banner_mounted = false
	_banner_impression_recorded = false
	_banner_refresh_armed = false
	_banner_refresh_gen += 1
	_banner_ad_id = ""
	## Hide only — do not destroy/reload so Plus toggle / temporary hide can remount the same ad.
	if _admob and _admob.is_banner_ad_loaded():
		_admob.hide_banner_ad()
	banner_visibility_changed.emit(false)
	house_banner_changed.emit()


func try_show_interstitial_on_safe_exit() -> void:
	_safe_exit_count += 1
	if _safe_exit_count % INTERSTITIAL_EVERY_N_EXITS != 0:
		return
	if not can_show_interstitial():
		return
	if _admob == null or not _admob.is_interstitial_ad_loaded():
		_interstitial_ready = false
		_preload_interstitial()
		return
	_interstitial_ready = false
	_fullscreen_ad_since_unix = Time.get_unix_time_from_system()
	_admob.show_interstitial_ad()


func _emit_rewarded_failed(code: String, message: String) -> void:
	AnalyticsService.log_event("rewarded_failed", {"reason": code})
	rewarded_unlock_failed.emit(message)


func try_show_rewarded_for_library() -> void:
	if Entitlements.has_plus() or Entitlements.is_library_unlocked():
		rewarded_unlock_completed.emit()
		return
	if not Entitlements.can_start_library_unlock():
		_emit_rewarded_failed("daily_used", tr("Come back tomorrow or get Plus"))
		return
	if not OS.has_feature("mobile"):
		## Editor / desktop: grant immediately so paywall flow is testable.
		Entitlements.grant_library_unlock()
		rewarded_unlock_completed.emit()
		return
	if _playback_active:
		_emit_rewarded_failed("playback_active", tr("Stop playback first."))
		return
	if not _sdk_ready:
		ensure_initialized_for_rewarded()
		_pending_reward_active = true
		_reward_earned_pending = false
		var waited := 0.0
		while not _sdk_ready and waited < 12.0:
			await get_tree().create_timer(0.4).timeout
			waited += 0.4
		if not _sdk_ready or _admob == null:
			_emit_rewarded_failed("not_ready", tr("Ads aren't ready yet — try again in a moment."))
			return
		if not _pending_reward_active:
			return
	if _admob == null:
		_emit_rewarded_failed("not_ready", tr("Ads aren't ready yet — try again in a moment."))
		return
	_pending_reward_active = true
	_reward_earned_pending = false
	_apply_request_config_before_ad_load()
	if _rewarded_ready:
		_fullscreen_ad_since_unix = Time.get_unix_time_from_system()
		print("[AdsService] rewarded show")
		_admob.show_rewarded_ad()
		_rewarded_ready = false
		return
	if not _rewarded_load_in_flight:
		_preload_rewarded()
	var loaded := await _wait_until_rewarded_settled(8.0)
	if not _pending_reward_active:
		return
	if loaded and _admob and _rewarded_ready:
		_fullscreen_ad_since_unix = Time.get_unix_time_from_system()
		print("[AdsService] rewarded show")
		_admob.show_rewarded_ad()
		_rewarded_ready = false
	elif _rewarded_load_in_flight:
		_emit_rewarded_failed("loading", tr("Ad is still loading — try again in a moment."))
	else:
		_emit_rewarded_failed("no_ad", tr("No ad available right now — try again in a bit."))


func privacy_choices_available() -> bool:
	## UMP privacy-options entry point (EEA / some US states). Hidden when not required.
	if Platform.is_android():
		var bridge: Variant = _consent_bridge()
		if bridge == null:
			return false
		var required: bool = bool(bridge.isPrivacyOptionsRequired())
		if JavaClassWrapper.get_exception() != null:
			return false
		return required
	if not _has_mobile_ads() or not _sdk_ready:
		return false
	return _admob.is_consent_form_available()


func open_privacy_choices_from_settings() -> void:
	## Settings → Manage Ad Consent. Re-opens UMP privacy options when required.
	if Platform.is_android():
		_open_android_privacy_options()
		return
	if not OS.has_feature("mobile") or _admob == null:
		return
	_privacy_settings_request = true
	if _admob.is_consent_form_available():
		_consent_form_pending = true
		_admob.load_consent_form()
		return
	_admob.update_consent_info()


func _process(_delta: float) -> void:
	var keep_running := false
	if _android_gather_active:
		keep_running = true
		_poll_android_gather()
	if _android_privacy_form_open:
		keep_running = true
		_poll_android_privacy_form()
	if not keep_running:
		set_process(false)


func _android_release_ids_blocked() -> bool:
	if not Platform.is_android() or OS.is_debug_build():
		return false
	if PROD_APP_ID_ANDROID.is_empty() or PROD_APP_ID_ANDROID == GOOGLE_TEST_APP_ID:
		push_error("AdMob: Android release build is missing a production app id — ads will not load")
		return true
	return false


func _begin_android_consent_gather() -> void:
	if _android_gather_active or _sdk_ready:
		return
	var bridge: Variant = _consent_bridge()
	if bridge == null:
		_block_ads_for_consent("ConsentBridge missing")
		return
	_android_gather_active = true
	set_process(true)
	get_tree().create_timer(12.0).timeout.connect(_on_android_gather_timeout, CONNECT_ONE_SHOT)
	bridge.gatherConsent()
	if JavaClassWrapper.get_exception() != null:
		_android_gather_active = false
		_block_ads_for_consent("gatherConsent failed to start")


func _on_android_gather_timeout() -> void:
	if not _android_gather_active or _sdk_ready:
		return
	var bridge: Variant = _consent_bridge()
	var state := -1
	if bridge != null:
		state = int(bridge.getGatherState())
		if JavaClassWrapper.get_exception() != null:
			state = -1
	if state == 2:
		_finish_android_gather()
		return
	## Still running: the form may be on screen. Do not request, and do not abandon it.
	if state == 1:
		get_tree().create_timer(12.0).timeout.connect(_on_android_gather_timeout, CONNECT_ONE_SHOT)
		return
	_android_gather_active = false
	_block_ads_for_consent("consent gather timed out")


func _poll_android_gather() -> void:
	if not _android_gather_active:
		return
	var bridge: Variant = _consent_bridge()
	if bridge == null:
		_android_gather_active = false
		_block_ads_for_consent("ConsentBridge missing")
		return
	var state := int(bridge.getGatherState())
	if JavaClassWrapper.get_exception() != null or state != 2:
		return
	_finish_android_gather()


func _finish_android_gather() -> void:
	if not _android_gather_active:
		return
	_android_gather_active = false
	_android_consent_finished = true
	var bridge: Variant = _consent_bridge()
	var err := ""
	if bridge != null:
		err = str(bridge.getGatherError())
		if JavaClassWrapper.get_exception() != null:
			err = "ConsentBridge read failed"
	var status := ""
	if bridge != null:
		status = str(bridge.getConsentStatusName())
	print("[AdsService] UMP gather finished status=%s error=%s" % [status, err])
	if _android_may_request_ads():
		_ads_blocked_by_consent = false
		print("[AdsService] UMP allows ad requests")
		_apply_mediation_and_request_config(_android_has_ads_consent())
		_begin_mobile_ads_initialization()
		return
	## A denial after the form is a real block. A failed info update is not:
	## iOS already fail-opens, and non-EEA users must still get ads.
	if status == "OBTAINED" or status == "REQUIRED":
		var reason := err if not err.is_empty() else "consent does not allow ad requests"
		_block_ads_for_consent(reason)
		return
	push_warning("AdMob UMP: Android consent failed (%s) — fail-open NPA" % err)
	_ads_blocked_by_consent = false
	_apply_mediation_and_request_config(false)
	_begin_mobile_ads_initialization()


func _android_may_request_ads() -> bool:
	var bridge: Variant = _consent_bridge()
	if bridge == null:
		return false
	var allows: bool = bool(bridge.allowsAdRequests())
	if JavaClassWrapper.get_exception() != null or not allows:
		return false
	var status := str(bridge.getConsentStatusName())
	if JavaClassWrapper.get_exception() != null:
		return false
	if status == "NOT_REQUIRED":
		return true
	if status != "OBTAINED":
		return false
	return _android_has_ads_consent()


func _android_has_ads_consent() -> bool:
	var bridge: Variant = _consent_bridge()
	if bridge == null:
		return false
	var granted: bool = bool(bridge.hasAdsConsent())
	if JavaClassWrapper.get_exception() != null:
		return false
	return granted


func _open_android_privacy_options() -> void:
	var bridge: Variant = _consent_bridge()
	if bridge == null:
		return
	_android_privacy_form_open = true
	set_process(true)
	bridge.showPrivacyOptionsForm()
	if JavaClassWrapper.get_exception() != null:
		_android_privacy_form_open = false


func _poll_android_privacy_form() -> void:
	var bridge: Variant = _consent_bridge()
	if bridge == null:
		_android_privacy_form_open = false
		return
	var state := int(bridge.getPrivacyFormState())
	if JavaClassWrapper.get_exception() != null or state != 2:
		return
	bridge.clearPrivacyFormState()
	if JavaClassWrapper.get_exception() != null:
		_android_privacy_form_open = false
		return
	_android_privacy_form_open = false
	_android_consent_finished = true
	if not _android_may_request_ads():
		_block_ads_for_consent("privacy options denied")
		return
	_ads_blocked_by_consent = false
	_apply_mediation_and_request_config(_android_has_ads_consent())
	if not _mobile_ads_init_started:
		_begin_mobile_ads_initialization()
		return
	if _sdk_ready:
		ensure_banner_mounted()
		_preload_interstitial()
		_preload_rewarded()
	_emit_privacy_choices_availability()


func _block_ads_for_consent(reason: String) -> void:
	_ads_blocked_by_consent = true
	push_warning("AdMob: ads blocked by consent (%s)" % reason)
	AnalyticsService.log_event("ads_blocked_by_consent", {"reason": reason})
	if _banner_mounted:
		hide_banner()
	_emit_privacy_choices_availability()


func _consent_bridge() -> Variant:
	if not Platform.is_android():
		return null
	if _consent_bridge_lookup_failed:
		return null
	if _consent_bridge_cached != null:
		return _consent_bridge_cached
	if not ClassDB.class_exists("JavaClassWrapper"):
		_consent_bridge_lookup_failed = true
		push_warning("UMP ConsentBridge unavailable — JavaClassWrapper missing")
		return null
	var bridge: Variant = JavaClassWrapper.wrap("com.godot.game.ConsentBridge")
	if JavaClassWrapper.get_exception() != null or bridge == null:
		_consent_bridge_lookup_failed = true
		push_warning("UMP ConsentBridge unavailable — rebuild the Android app so user-messaging-platform is packaged")
		return null
	_consent_bridge_cached = bridge
	return bridge


func _has_mobile_ads() -> bool:
	return OS.has_feature("mobile") and _admob != null and Engine.has_singleton("AdmobPlugin")


func _initialize_ads() -> void:
	if not OS.has_feature("mobile"):
		return
	if not ResourceLoader.exists("res://addons/AdmobPlugin/Admob.gd"):
		return
	if _admob_setup_started:
		return
	_admob_setup_started = true

	var admob_script: Script = load("res://addons/AdmobPlugin/Admob.gd")
	_admob = admob_script.new()
	_admob.name = "Admob"
	## Debug exports use Google's demo units. Release and TestFlight use production units.
	_admob.is_real = not OS.is_debug_build()
	_admob.auto_configure_on_initialize = false
	_admob.remove_banner_ads_after_scene = false
	_admob.remove_interstitial_ads_after_displayed = true
	_admob.banner_position = LoadAdRequest.AdPosition.BOTTOM
	## iOS: pin to the physical bottom so the ad covers the home-indicator strip.
	## Safe-area anchoring left a gray gap under the banner on iOS.
	## Must stay true on Android. GodotApp always calls EdgeToEdge.enable(), so a BOTTOM
	## banner with safe-area off sits under the nav/gesture bar: AdMob counts the request, never the impression.
	_admob.banner_anchor_to_safe_area = Platform.is_android()
	## Anchored adaptive fills much better than a fixed 320×50 on modern phones.
	_admob.banner_size = LoadAdRequest.RequestedAdSize.ADAPTIVE
	## Unity Ads mediation — same as Circuit Sort (pods via AdmobPlugin ios_export.cfg).
	_admob.enabled_networks = MediationNetwork.Flag.UNITY
	## Teen rating widens fill vs G without allowing mature ads (Circuit Sort note).
	_admob.max_ad_content_rating = AdmobConfig.ContentRating.T
	## iOS — real App ID in both slots (Google wants your App ID even with demo units).
	_admob.ios_debug_application_id = PROD_APP_ID_IOS
	_admob.ios_real_application_id = PROD_APP_ID_IOS
	_admob.ios_real_banner_id = PROD_BANNER_IOS
	_admob.ios_real_interstitial_id = PROD_INTERSTITIAL_IOS
	_admob.ios_real_rewarded_id = PROD_REWARDED_IOS
	_admob.ios_debug_banner_id = Admob.IOS_BANNER_DEMO_AD_UNIT_ID
	_admob.ios_debug_interstitial_id = Admob.IOS_INTERSTITIAL_DEMO_AD_UNIT_ID
	_admob.ios_debug_rewarded_id = Admob.IOS_REWARDED_DEMO_AD_UNIT_ID
	## Android — real App ID in both slots (Google wants it even when a debug build uses demo units).
	_admob.android_debug_application_id = PROD_APP_ID_ANDROID
	_admob.android_real_application_id = PROD_APP_ID_ANDROID
	_admob.android_real_banner_id = PROD_BANNER_ANDROID
	_admob.android_real_interstitial_id = PROD_INTERSTITIAL_ANDROID
	_admob.android_real_rewarded_id = PROD_REWARDED_ANDROID
	_admob.android_debug_banner_id = Admob.ANDROID_BANNER_DEMO_AD_UNIT_ID
	_admob.android_debug_interstitial_id = Admob.ANDROID_INTERSTITIAL_DEMO_AD_UNIT_ID
	_admob.android_debug_rewarded_id = Admob.ANDROID_REWARDED_DEMO_AD_UNIT_ID
	var test_mode := not _admob.is_real
	var banner_unit := PROD_BANNER_IOS if OS.has_feature("ios") else PROD_BANNER_ANDROID
	if test_mode:
		banner_unit = Admob.IOS_BANNER_DEMO_AD_UNIT_ID if OS.has_feature("ios") else Admob.ANDROID_BANNER_DEMO_AD_UNIT_ID
	print("[AdsService] init platform=%s test_mode=%s app_id=%s banner_unit=%s" % [
		"ios" if OS.has_feature("ios") else "android",
		str(test_mode),
		PROD_APP_ID_IOS if OS.has_feature("ios") else PROD_APP_ID_ANDROID,
		banner_unit,
	])
	if OS.get_name() == "iOS":
		_admob.att_enabled = true
		_admob.att_text = tr(ATT_TEXT)
	add_child(_admob)

	_admob.initialization_completed.connect(_on_admob_initialized)
	_admob.consent_info_updated.connect(_on_consent_info_updated)
	_admob.consent_info_update_failed.connect(_on_consent_info_update_failed)
	_admob.consent_form_loaded.connect(_on_consent_form_loaded)
	_admob.consent_form_failed_to_load.connect(_on_consent_form_failed_to_load)
	_admob.consent_form_dismissed.connect(_on_consent_form_dismissed)
	_admob.banner_ad_loaded.connect(_on_banner_loaded)
	_admob.banner_ad_failed_to_load.connect(_on_banner_failed_to_load)
	_admob.banner_ad_impression.connect(func(_a): _on_banner_impression())
	_admob.banner_ad_refreshed.connect(_on_banner_refreshed)
	_admob.banner_ad_size_measured.connect(_on_banner_size_measured)
	_admob.interstitial_ad_loaded.connect(func(_a, _r):
		_interstitial_ready = true
		_interstitial_load_in_flight = false
		_interstitial_retry_count = 0
		print("[AdsService] interstitial load success")
	)
	_admob.interstitial_ad_failed_to_load.connect(_on_interstitial_failed_to_load)
	_admob.interstitial_ad_showed_full_screen_content.connect(_on_interstitial_showed)
	_admob.interstitial_ad_failed_to_show_full_screen_content.connect(_on_interstitial_failed_to_show)
	_admob.interstitial_ad_dismissed_full_screen_content.connect(_on_interstitial_dismissed)
	_admob.rewarded_ad_loaded.connect(func(_a, _r):
		_rewarded_ready = true
		_rewarded_load_in_flight = false
		_rewarded_retry_count = 0
		print("[AdsService] rewarded load success")
	)
	_admob.rewarded_ad_failed_to_load.connect(_on_rewarded_failed_to_load)
	_admob.rewarded_ad_user_earned_reward.connect(_on_rewarded_earned)
	_admob.rewarded_ad_dismissed_full_screen_content.connect(_on_rewarded_dismissed)
	_admob.rewarded_ad_failed_to_show_full_screen_content.connect(_on_rewarded_failed_to_show)
	if OS.get_name() == "iOS":
		_admob.tracking_authorization_granted.connect(_on_att_resolved)
		_admob.tracking_authorization_denied.connect(_on_att_resolved)

	if not _admob.is_node_ready():
		await _admob.ready
	await get_tree().process_frame
	## Settle after splash fade before ATT (playbook: never fire ATT/init during boot spike).
	await get_tree().create_timer(1.2).timeout
	if _admob == null:
		return
	if not Engine.has_singleton("AdmobPlugin"):
		push_error("AdMob: AdmobPlugin singleton missing — enable plugins/AdmobPlugin in export preset")
		return

	## iOS: ATT → Mobile Ads initialize() → plugin UMP → load ads.
	## Android: ConsentBridge on the main thread, then initialize(). Never call
	## _admob.update_consent_info() on Android.
	if _android_release_ids_blocked():
		return
	if Platform.is_android():
		_begin_android_consent_gather()
		return
	if OS.get_name() == "iOS" and not _att_resolved:
		await _request_ios_tracking_authorization()
		return
	_begin_mobile_ads_initialization()


func _request_ios_tracking_authorization() -> void:
	if _admob == null or _att_resolved or _att_pending:
		return
	_att_pending = true
	await get_tree().process_frame
	await get_tree().create_timer(1.0).timeout
	if _admob == null or _att_resolved:
		return
	if _admob.has_method("request_tracking_authorization"):
		_admob.request_tracking_authorization()
	else:
		_on_att_resolved()
		return
	var att_fallback: SceneTreeTimer = get_tree().create_timer(8.0)
	att_fallback.timeout.connect(func() -> void:
		if _att_pending and not _att_resolved:
			push_warning("AdMob ATT: authorization timed out — continuing to UMP consent")
			_on_att_resolved()
	, CONNECT_ONE_SHOT)


func _on_att_resolved() -> void:
	if _att_resolved:
		return
	_att_resolved = true
	_att_pending = false
	## Apple 5.1.2: no tracking SDK init before ATT response.
	_begin_mobile_ads_initialization()


func _start_ump_consent_flow() -> void:
	## UMP only AFTER Mobile Ads initialize() (W4D / Circuit Sort order).
	if _admob == null or _sdk_ready:
		return
	if not _mobile_ads_init_started and not _admob_ready:
		return
	if _ump_started:
		return
	_ump_started = true
	_consent_form_pending = false
	_admob.update_consent_info()
	var consent_fallback: SceneTreeTimer = get_tree().create_timer(12.0)
	consent_fallback.timeout.connect(func() -> void:
		_on_consent_startup_timeout()
	, CONNECT_ONE_SHOT)


func _on_consent_startup_timeout() -> void:
	if _sdk_ready:
		return
	push_warning("AdMob UMP: consent startup timed out — fail-open NPA, then serve ads")
	_consent_form_pending = false
	_privacy_settings_request = false
	_fail_open_and_serve_ads()


func _on_consent_info_updated() -> void:
	if _admob == null:
		if not _sdk_ready:
			_fail_open_and_serve_ads()
		return
	## Settings re-open of privacy options.
	if _privacy_settings_request and _sdk_ready:
		if _admob.is_consent_form_available():
			_consent_form_pending = true
			_admob.load_consent_form()
		else:
			_privacy_settings_request = false
			_emit_privacy_choices_availability()
		return
	var consent := _admob.get_consent_status()
	var need_form := false
	if consent != null and consent.status == UserConsent.Status.REQUIRED and not _sdk_ready:
		need_form = true
	if need_form:
		_consent_form_pending = true
		_admob.load_consent_form()
		var form_fallback: SceneTreeTimer = get_tree().create_timer(8.0)
		form_fallback.timeout.connect(func() -> void:
			if _consent_form_pending and not _sdk_ready:
				push_warning("AdMob UMP: consent form timed out — fail-open NPA")
				_consent_form_pending = false
				_fail_open_and_serve_ads()
		, CONNECT_ONE_SHOT)
		return
	_emit_privacy_choices_availability()
	if not _sdk_ready:
		_finish_consent_then_serve_ads()


func _on_consent_info_update_failed(_err: FormError) -> void:
	push_warning("AdMob UMP: consent info update failed — fail-open NPA")
	if _privacy_settings_request:
		_privacy_settings_request = false
		_emit_privacy_choices_availability()
		return
	_fail_open_and_serve_ads()


func _on_consent_form_loaded() -> void:
	if _admob != null:
		_admob.show_consent_form()


func _on_consent_form_failed_to_load(_err: FormError) -> void:
	push_warning("AdMob UMP: consent form failed to load — fail-open NPA")
	_consent_form_pending = false
	if _privacy_settings_request:
		_privacy_settings_request = false
		_emit_privacy_choices_availability()
		return
	_fail_open_and_serve_ads()


func _on_consent_form_dismissed(_err: FormError) -> void:
	_consent_form_pending = false
	_emit_privacy_choices_availability()
	if _privacy_settings_request:
		_apply_mediation_and_request_config()
		_privacy_settings_request = false
		return
	_finish_consent_then_serve_ads()


func _consent_resolved() -> bool:
	if _admob == null:
		return false
	var consent := _admob.get_consent_status()
	if consent == null:
		return false
	return consent.status in [UserConsent.Status.OBTAINED, UserConsent.Status.NOT_REQUIRED]


func _apply_mediation_and_request_config(gdpr_override: Variant = null) -> void:
	if _admob == null:
		return
	var gdpr_ok := _consent_resolved()
	if gdpr_override is bool:
		gdpr_ok = gdpr_override
	var privacy := NetworkPrivacySettings.new()
	privacy.set_has_gdpr_consent(gdpr_ok)
	privacy.set_has_ccpa_sale_consent(gdpr_ok)
	## Forward consent flags to Unity / mediation adapters before the first ad request.
	if privacy.has_method("set_enabled_networks"):
		privacy.set_enabled_networks(MediationNetwork.get_all_enabled_tags(_admob.enabled_networks))
	_admob.set_mediation_privacy_settings(privacy)
	var cfg := _admob.create_request_configuration()
	if gdpr_ok:
		cfg.set_personalization_state(AdmobConfig.PersonalizationState.DEFAULT)
	else:
		cfg.set_personalization_state(AdmobConfig.PersonalizationState.DISABLED)
	_admob.set_request_configuration(cfg)


func _apply_request_config_before_ad_load() -> void:
	_apply_mediation_and_request_config()


func _fail_open_and_serve_ads() -> void:
	## Network / form failure: continue with non-personalized ads rather than blocking forever.
	if _sdk_ready:
		return
	if _admob != null:
		_admob.personalization_state = AdmobConfig.PersonalizationState.DISABLED
		_apply_mediation_and_request_config()
	_serve_ads_now()


func _finish_consent_then_serve_ads() -> void:
	if _sdk_ready:
		return
	if not _consent_resolved() and _admob != null:
		_admob.personalization_state = AdmobConfig.PersonalizationState.DISABLED
	_apply_mediation_and_request_config()
	_serve_ads_now()


func _begin_mobile_ads_initialization() -> void:
	## Only after ATT. UMP + ad loads happen after initialization_completed.
	if _admob == null or _mobile_ads_init_started:
		return
	_mobile_ads_init_started = true
	print("[AdsService] MobileAds.initialize")
	_admob.initialize()
	var init_fallback: SceneTreeTimer = get_tree().create_timer(20.0)
	init_fallback.timeout.connect(func() -> void:
		_on_mobile_ads_init_timeout()
	, CONNECT_ONE_SHOT)


func _on_mobile_ads_init_timeout() -> void:
	if _admob_init_cb_fired:
		return
	push_warning("AdMob: Mobile Ads SDK init timed out — continuing to UMP / ads if allowed")
	_admob_init_cb_fired = true
	_admob_ready = true
	print("[AdsService] MobileAds init timeout — continuing")
	_on_mobile_ads_ready_for_ump()


func _on_admob_initialized(_status) -> void:
	if _admob_init_cb_fired:
		return
	_admob_init_cb_fired = true
	_admob_ready = true
	print("[AdsService] MobileAds init complete")
	_on_mobile_ads_ready_for_ump()


func _on_mobile_ads_ready_for_ump() -> void:
	## Android already gathered consent before initialize(). Do not call plugin UMP.
	if Platform.is_android():
		if _android_consent_finished and _android_may_request_ads() and not _ads_blocked_by_consent:
			_serve_ads_now()
		return
	## iOS: SDK is up — now UMP, then load ads.
	_start_ump_consent_flow()


func _serve_ads_now() -> void:
	if _sdk_ready:
		return
	_sdk_ready = true
	print("[AdsService] serving ads")
	_emit_privacy_choices_availability()
	ensure_banner_mounted()
	_preload_interstitial()
	_preload_rewarded()


func _finish_mobile_ads_startup() -> void:
	## Legacy name kept for any callers — redirect to UMP-then-serve path.
	_on_mobile_ads_ready_for_ump()


func _emit_privacy_choices_availability() -> void:
	privacy_choices_availability_changed.emit(privacy_choices_available())


func _on_banner_loaded(ad_info: AdInfo, _response = null) -> void:
	_banner_load_in_flight = false
	_banner_retry_count = 0
	_banner_load_requested = true
	var new_id := ""
	if ad_info != null:
		new_id = ad_info.get_ad_id()
	## Native banners start hidden — show on the next frame so the plugin cache is populated.
	await get_tree().process_frame
	if _admob == null:
		return
	if not should_show_banner():
		banner_visibility_changed.emit(false)
		return
	var previous := _banner_ad_id
	if not new_id.is_empty():
		_admob.show_banner_ad(new_id)
		_banner_ad_id = new_id
	else:
		_admob.show_banner_ad()
	_banner_mounted = true
	_house_logged = false
	print("[AdsService] banner show id=%s" % _banner_ad_id)
	_last_banner_creative_unix = Time.get_unix_time_from_system()
	if not previous.is_empty() and previous != _banner_ad_id:
		_admob.remove_banner_ad(previous)
	_arm_banner_refresh()
	banner_visibility_changed.emit(true)
	house_banner_changed.emit()


func _on_banner_impression() -> void:
	_banner_impression_recorded = true
	_banner_mounted = true
	print("[AdsService] banner impression")
	_arm_banner_refresh()
	banner_visibility_changed.emit(true)


func _on_banner_size_measured(ad_info: AdInfo) -> void:
	if ad_info == null:
		return
	var h := float(ad_info.get_measured_height())
	if h >= 40.0:
		_banner_measured_height = h
		banner_visibility_changed.emit(_banner_mounted)


func _on_banner_refreshed(ad_info: AdInfo, _response = null) -> void:
	_last_banner_creative_unix = Time.get_unix_time_from_system()
	if ad_info != null and not ad_info.get_ad_id().is_empty():
		_banner_ad_id = ad_info.get_ad_id()
	if should_show_banner() and _admob:
		_show_current_banner()


func _on_banner_failed_to_load(_ad_info, error) -> void:
	_banner_load_requested = false
	_banner_load_in_flight = false
	var still_up := _banner_mounted and not _banner_ad_id.is_empty()
	if not still_up:
		_banner_mounted = false
	_log_ad_error("banner", error)
	_show_house_banner(true)
	var delay := _retry_delay(error, _banner_retry_count, BANNER_RETRY_MAX)
	if delay < 0.0:
		if still_up:
			_arm_banner_refresh()
		else:
			banner_visibility_changed.emit(false)
		return
	_banner_retry_count += 1
	get_tree().create_timer(delay).timeout.connect(func() -> void:
		if not should_show_banner() or _banner_load_in_flight:
			return
		if still_up:
			_on_banner_refresh_due()
		elif not _banner_mounted:
			ensure_banner_mounted()
	)


func _on_interstitial_failed_to_load(_ad_info, error) -> void:
	_interstitial_ready = false
	_interstitial_load_in_flight = false
	_log_ad_error("interstitial", error)
	var delay := _retry_delay(error, _interstitial_retry_count, INTERSTITIAL_RETRY_MAX)
	if delay < 0.0:
		return
	_interstitial_retry_count += 1
	get_tree().create_timer(delay).timeout.connect(func() -> void:
		if _ads_enabled and not Entitlements.has_plus() and not _interstitial_ready:
			_preload_interstitial()
	)


func is_fullscreen_ad_showing() -> bool:
	if _fullscreen_ad_since_unix <= 0.0:
		return false
	if Time.get_unix_time_from_system() - _fullscreen_ad_since_unix > 180.0:
		return false
	return true


func _on_interstitial_showed(_ad_info) -> void:
	_fullscreen_ad_since_unix = Time.get_unix_time_from_system()
	_last_interstitial_unix = Time.get_unix_time_from_system()
	print("[AdsService] interstitial show")
	_preload_interstitial()


func _on_interstitial_failed_to_show(_ad_info, error) -> void:
	_fullscreen_ad_since_unix = 0.0
	_interstitial_ready = false
	_log_ad_error("interstitial show", error)
	_preload_interstitial()


func _on_interstitial_dismissed(_ad_info) -> void:
	_fullscreen_ad_since_unix = 0.0
	_preload_interstitial()
	keep_banner_visible()


func _log_ad_error(kind: String, error) -> void:
	var code := _ad_error_code(error)
	var message := "unknown"
	if error != null and error.has_method("get_message"):
		message = str(error.get_message())
	push_warning("AdMob %s failed: code=%s message=%s" % [kind, str(code), message])


func _ad_error_code(error) -> int:
	if error != null and error.has_method("get_code"):
		return int(error.get_code())
	return -1


## Returns seconds to wait, or -1 to stop. No-fill retries once after 2 minutes.
func _retry_delay(error, retry_count: int, max_retries: int) -> float:
	var code := _ad_error_code(error)
	if code == AD_ERROR_INVALID_REQUEST:
		return -1.0
	if retry_count >= max_retries:
		return -1.0
	if code == AD_ERROR_NO_FILL:
		return NO_FILL_RETRY_SEC if retry_count == 0 else -1.0
	return 20.0 * float(retry_count + 1)


func _preload_interstitial() -> void:
	if not _admob or not _sdk_ready or not _ads_enabled or Entitlements.has_plus():
		return
	if _interstitial_ready or _interstitial_load_in_flight:
		return
	_interstitial_load_in_flight = true
	_apply_request_config_before_ad_load()
	_admob.load_interstitial_ad()


func _preload_rewarded() -> void:
	if not _admob or not _sdk_ready or not _ads_enabled or Entitlements.has_plus():
		return
	if _rewarded_ready or _rewarded_load_in_flight:
		return
	_rewarded_load_in_flight = true
	_apply_request_config_before_ad_load()
	_admob.load_rewarded_ad()


func _show_banner_native() -> void:
	if not _sdk_ready or _admob == null:
		banner_visibility_changed.emit(should_show_banner())
		return
	_apply_request_config_before_ad_load()
	if _admob.is_banner_ad_loaded():
		_show_current_banner()
		return
	## One in-flight load. Screen changes must not start another.
	if _banner_load_requested or _banner_load_in_flight:
		banner_visibility_changed.emit(_banner_mounted)
		return
	_banner_load_requested = true
	_banner_load_in_flight = true
	print("[AdsService] banner load")
	_show_house_banner(false)
	var req := _admob.create_banner_ad_request()
	var width_dp := _banner_width_dp()
	if width_dp >= 320:
		req.set_adaptive_width(width_dp)
	_admob.load_banner_ad(req)
	banner_visibility_changed.emit(false)


func _on_rewarded_earned(_ad_info, _reward) -> void:
	_reward_earned_pending = true


func _on_rewarded_dismissed(_ad_info) -> void:
	_fullscreen_ad_since_unix = 0.0
	var active := _pending_reward_active
	var earned := _reward_earned_pending
	_pending_reward_active = false
	_reward_earned_pending = false
	_preload_rewarded()
	keep_banner_visible()
	if not active:
		return
	if earned:
		Entitlements.grant_library_unlock()
		AnalyticsService.log_event("rewarded_earned", {"scope": "library", "minutes": 20})
		rewarded_unlock_completed.emit()
	else:
		_emit_rewarded_failed("closed_early", tr("Watch the full ad to unlock."))


func _on_rewarded_failed_to_load(_ad_info, error) -> void:
	_rewarded_ready = false
	_rewarded_load_in_flight = false
	_log_ad_error("rewarded", error)
	var delay := _retry_delay(error, _rewarded_retry_count, REWARDED_RETRY_MAX)
	if delay < 0.0:
		return
	_rewarded_retry_count += 1
	get_tree().create_timer(delay).timeout.connect(func() -> void:
		if Entitlements.has_plus() or not _ads_enabled:
			return
		if not _rewarded_ready:
			_preload_rewarded()
	)


func _on_rewarded_failed_to_show(_ad_info, error) -> void:
	_fullscreen_ad_since_unix = 0.0
	_pending_reward_active = false
	_reward_earned_pending = false
	_rewarded_ready = false
	_log_ad_error("rewarded show", error)
	_preload_rewarded()
	keep_banner_visible()
	_emit_rewarded_failed("show_failed", tr("Couldn't show the ad. Try again."))


func _on_playback_started(_sound_id: String) -> void:
	_playback_active = true


func _on_playback_stopped(_sound_id: String = "") -> void:
	_playback_active = false


func _wait_until_rewarded_settled(timeout_sec: float) -> bool:
	await get_tree().process_frame
	var waited := 0.0
	while waited < timeout_sec:
		if _rewarded_ready:
			return true
		if not _rewarded_load_in_flight and not _rewarded_ready:
			return false
		await get_tree().create_timer(0.25).timeout
		waited += 0.25
	return _rewarded_ready


func _show_current_banner() -> void:
	if _admob == null:
		return
	if not _banner_ad_id.is_empty():
		_admob.show_banner_ad(_banner_ad_id)
	else:
		_admob.show_banner_ad()
	_banner_mounted = true
	_arm_banner_refresh()
	banner_visibility_changed.emit(true)


func _arm_banner_refresh() -> void:
	if _banner_refresh_armed or not should_show_banner():
		return
	_banner_refresh_armed = true
	var gen := _banner_refresh_gen
	get_tree().create_timer(BANNER_REFRESH_SEC).timeout.connect(func() -> void:
		if gen != _banner_refresh_gen:
			return
		_on_banner_refresh_due()
	)


func _on_banner_refresh_due() -> void:
	_banner_refresh_armed = false
	if not should_show_banner() or _admob == null:
		return
	## Leave the current banner up. A fullscreen ad is covering it; try again later.
	if _fullscreen_ad_since_unix > 0.0 or _banner_load_in_flight:
		_arm_banner_refresh()
		return
	var elapsed := Time.get_unix_time_from_system() - _last_banner_creative_unix
	if elapsed < BANNER_REFRESH_SEC - 1.0:
		_show_current_banner()
		return
	if _admob.is_banner_ad_loaded():
		if not _banner_ad_id.is_empty():
			_admob.show_banner_ad(_banner_ad_id)
		else:
			_admob.show_banner_ad()
		_banner_mounted = true
	_banner_load_in_flight = true
	_apply_request_config_before_ad_load()
	var req := _admob.create_banner_ad_request()
	var width_dp := _banner_width_dp()
	if width_dp >= 320:
		req.set_adaptive_width(width_dp)
	_admob.load_banner_ad(req)
