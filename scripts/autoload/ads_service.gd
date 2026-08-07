extends Node

signal banner_visibility_changed(visible: bool)
signal privacy_choices_availability_changed(available: bool)
signal rewarded_unlock_completed(sound_id: String)
signal rewarded_unlock_failed(reason: String)

## iOS production (AdMob app + units). Android left empty until AdMob Android app exists.
const PROD_APP_ID_IOS := "ca-app-pub-5356882403986713~1231581339"
const PROD_BANNER_IOS := "ca-app-pub-5356882403986713/8726927974"
const PROD_INTERSTITIAL_IOS := "ca-app-pub-5356882403986713/9050627536"
const PROD_REWARDED_IOS := "ca-app-pub-5356882403986713/3474601293"
const PROD_APP_ID_ANDROID := ""
const PROD_BANNER_ANDROID := ""
const PROD_INTERSTITIAL_ANDROID := ""
const PROD_REWARDED_ANDROID := ""

const GOOGLE_TEST_APP_ID := "ca-app-pub-3940256099942544~3347511713"
const ATT_TEXT := (
	"StimPad uses this to show more relevant ads on the free tier. "
	+ "You can change this anytime in Settings."
)

## When false, AdMob never initializes on cold start (isolates TestFlight crash after home).
## Re-enable after GADApplicationIdentifier is confirmed in the IPA Info.plist.
const ENABLE_COLD_START_ADS := false

var _ads_enabled: bool = true
## True only after ATT (iOS) + UMP consent + Mobile Ads init — ads must not load before this.
var _sdk_ready: bool = false
var _admob_ready: bool = false
var _mobile_ads_init_started: bool = false
var _admob_init_cb_fired: bool = false
var _ump_started: bool = false
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

## Interstitials: not every navigation — every Nth safe exit, with a cooldown.
const INTERSTITIAL_EVERY_N_EXITS := 3
const INTERSTITIAL_MIN_INTERVAL_SEC := 90.0

var _safe_exit_count: int = 0
var _last_interstitial_unix: float = -99999.0
var _banner_mounted: bool = false
var _pending_reward_sound_id: String = ""
var _reward_earned_pending: bool = false
## Main UI (home grid) finished first paint — set via notify_ui_ready().
var _ui_ready: bool = false


func _ready() -> void:
	AudioController.playback_started.connect(_on_playback_started)
	AudioController.playback_stopped.connect(_on_playback_stopped)
	AudioController.playback_finished.connect(_on_playback_stopped)
	## Do not start AdMob until Main dismisses the boot overlay (home content ready).
	## Starting during cold load / texture spike crashes TestFlight devices.


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
		_banner_mounted = false
		_banner_load_requested = false
		hide_banner()
	else:
		ensure_banner_mounted()
	banner_visibility_changed.emit(should_show_banner())


func should_show_banner() -> bool:
	return _ads_enabled and not Entitlements.has_plus() and _has_mobile_ads() and _sdk_ready


func can_show_interstitial() -> bool:
	if not (
		_ads_enabled
		and not Entitlements.has_plus()
		and not _playback_active
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
	if not _ads_enabled:
		return false
	## Desktop/editor: simulate rewarded unlock for testing.
	if not OS.has_feature("mobile"):
		return true
	return _has_mobile_ads() and _sdk_ready


func ensure_banner_mounted() -> void:
	## One banner for the app session across Home / Player / Settings / Paywall.
	## Do not reload on navigation — AdMob refreshes creative on its own (~45s).
	if not should_show_banner():
		if _banner_mounted:
			hide_banner()
		return
	if _banner_mounted and _admob != null and _admob.is_banner_ad_loaded():
		## Already showing — keep the same instance visible.
		if _admob.has_method("show_banner_ad"):
			_admob.show_banner_ad()
		banner_visibility_changed.emit(true)
		return
	_show_banner_native()


func show_banner_if_allowed() -> void:
	ensure_banner_mounted()


func hide_banner() -> void:
	_banner_mounted = false
	## Hide only — do not destroy/reload so Plus toggle / temporary hide can remount the same ad.
	if _admob:
		_admob.hide_banner_ad()
	banner_visibility_changed.emit(false)


func try_show_interstitial_on_safe_exit() -> void:
	_safe_exit_count += 1
	if _safe_exit_count % INTERSTITIAL_EVERY_N_EXITS != 0:
		return
	if not can_show_interstitial():
		return
	if _admob:
		_apply_request_config_before_ad_load()
		_admob.show_interstitial_ad()
		_interstitial_ready = false
		_last_interstitial_unix = Time.get_unix_time_from_system()
		_preload_interstitial()


func try_show_rewarded_for_sound(sound_id: String) -> void:
	if sound_id.is_empty():
		rewarded_unlock_failed.emit("No sound selected.")
		return
	if Entitlements.has_plus() or Entitlements.is_temp_unlocked(sound_id):
		rewarded_unlock_completed.emit(sound_id)
		return
	if not OS.has_feature("mobile") or _admob == null or not _sdk_ready:
		## Editor / desktop: grant immediately so paywall flow is testable.
		Entitlements.grant_temp_unlock(sound_id)
		rewarded_unlock_completed.emit(sound_id)
		return
	if _playback_active:
		rewarded_unlock_failed.emit("Stop playback first.")
		return
	_pending_reward_sound_id = sound_id
	_reward_earned_pending = false
	_apply_request_config_before_ad_load()
	if _rewarded_ready:
		_admob.show_rewarded_ad()
		_rewarded_ready = false
		return
	_admob.load_rewarded_ad()
	## Wait briefly for the preload; if it lands, show automatically.
	await get_tree().create_timer(2.5).timeout
	if _pending_reward_sound_id != sound_id:
		return
	if _rewarded_ready and _admob:
		_admob.show_rewarded_ad()
		_rewarded_ready = false
	else:
		rewarded_unlock_failed.emit("Ad is still loading — try again in a moment.")


func privacy_choices_available() -> bool:
	## UMP privacy-options entry point (EEA / some US states). Hidden when not required.
	if not _has_mobile_ads() or not _sdk_ready:
		return false
	return _admob.is_consent_form_available()


func open_privacy_choices_from_settings() -> void:
	## Settings → Manage Ad Consent. Re-opens UMP privacy options when required.
	if not OS.has_feature("mobile") or _admob == null:
		return
	_privacy_settings_request = true
	if _admob.is_consent_form_available():
		_consent_form_pending = true
		_admob.load_consent_form()
		return
	_admob.update_consent_info()


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
	## Debug device builds keep Google demo units; release / TestFlight use production.
	_admob.is_real = not OS.is_debug_build()
	_admob.auto_configure_on_initialize = false
	_admob.banner_position = LoadAdRequest.AdPosition.BOTTOM
	_admob.banner_anchor_to_safe_area = true
	## Unity Ads mediation: off for now — adapter pods must be verified in the IPA.
	## Enabling without the adapter linked can crash MobileAds.initialize() on device.
	_admob.enabled_networks = 0
	## iOS — real App ID in both slots (Google wants your App ID even with demo units).
	_admob.ios_debug_application_id = PROD_APP_ID_IOS
	_admob.ios_real_application_id = PROD_APP_ID_IOS
	_admob.ios_real_banner_id = PROD_BANNER_IOS
	_admob.ios_real_interstitial_id = PROD_INTERSTITIAL_IOS
	_admob.ios_real_rewarded_id = PROD_REWARDED_IOS
	## Android — Google demo only until AdMob Android app + units exist.
	_admob.android_debug_application_id = GOOGLE_TEST_APP_ID
	_admob.android_real_application_id = GOOGLE_TEST_APP_ID if PROD_APP_ID_ANDROID.is_empty() else PROD_APP_ID_ANDROID
	if not PROD_BANNER_ANDROID.is_empty():
		_admob.android_real_banner_id = PROD_BANNER_ANDROID
	if not PROD_INTERSTITIAL_ANDROID.is_empty():
		_admob.android_real_interstitial_id = PROD_INTERSTITIAL_ANDROID
	if not PROD_REWARDED_ANDROID.is_empty():
		_admob.android_real_rewarded_id = PROD_REWARDED_ANDROID
	if OS.get_name() == "iOS":
		_admob.att_enabled = true
		_admob.att_text = ATT_TEXT
	add_child(_admob)

	_admob.initialization_completed.connect(_on_admob_initialized)
	_admob.consent_info_updated.connect(_on_consent_info_updated)
	_admob.consent_info_update_failed.connect(_on_consent_info_update_failed)
	_admob.consent_form_loaded.connect(_on_consent_form_loaded)
	_admob.consent_form_failed_to_load.connect(_on_consent_form_failed_to_load)
	_admob.consent_form_dismissed.connect(_on_consent_form_dismissed)
	_admob.banner_ad_loaded.connect(func(_a, _r): _on_banner_loaded())
	_admob.banner_ad_failed_to_load.connect(func(_a, _e): _on_banner_failed_to_load())
	_admob.interstitial_ad_loaded.connect(func(_a, _r): _interstitial_ready = true)
	_admob.rewarded_ad_loaded.connect(func(_a, _r): _rewarded_ready = true)
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
	## Short settle after splash fade before ATT.
	await get_tree().create_timer(0.8).timeout
	if _admob == null:
		return
	if not Engine.has_singleton("AdmobPlugin"):
		push_error("AdMob: AdmobPlugin singleton missing — enable plugins/AdmobPlugin in export preset")
		return

	## Order (W4D / Circuit Sort): ATT → Mobile Ads initialize() → UMP → load ads.
	## Never call UMP or load ads before initialize().
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


func _apply_mediation_and_request_config() -> void:
	if _admob == null:
		return
	var gdpr_ok := _consent_resolved()
	var privacy := NetworkPrivacySettings.new()
	privacy.set_has_gdpr_consent(gdpr_ok)
	privacy.set_has_ccpa_sale_consent(gdpr_ok)
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
	_on_mobile_ads_ready_for_ump()


func _on_admob_initialized(_status) -> void:
	if _admob_init_cb_fired:
		return
	_admob_init_cb_fired = true
	_admob_ready = true
	_on_mobile_ads_ready_for_ump()


func _on_mobile_ads_ready_for_ump() -> void:
	## SDK is up — now UMP, then load ads.
	_start_ump_consent_flow()


func _serve_ads_now() -> void:
	if _sdk_ready:
		return
	_sdk_ready = true
	_emit_privacy_choices_availability()
	ensure_banner_mounted()
	_preload_interstitial()
	_preload_rewarded()


func _finish_mobile_ads_startup() -> void:
	## Legacy name kept for any callers — redirect to UMP-then-serve path.
	_on_mobile_ads_ready_for_ump()


func _emit_privacy_choices_availability() -> void:
	privacy_choices_availability_changed.emit(privacy_choices_available())


func _on_banner_loaded() -> void:
	if should_show_banner():
		_admob.show_banner_ad()
		_banner_mounted = true
		_banner_load_requested = true
	banner_visibility_changed.emit(true)


func _on_banner_failed_to_load() -> void:
	_banner_mounted = false
	_banner_load_requested = false
	## Soft retry so a cold start miss does not leave the free tier without a banner.
	get_tree().create_timer(12.0).timeout.connect(func() -> void:
		if should_show_banner() and not _banner_mounted:
			ensure_banner_mounted()
	)


func _preload_interstitial() -> void:
	if _admob and _sdk_ready and _ads_enabled and not Entitlements.has_plus():
		_apply_request_config_before_ad_load()
		_admob.load_interstitial_ad()


func _preload_rewarded() -> void:
	if _admob and _sdk_ready and _ads_enabled and not Entitlements.has_plus():
		_apply_request_config_before_ad_load()
		_admob.load_rewarded_ad()


func _show_banner_native() -> void:
	if not _sdk_ready or _admob == null:
		banner_visibility_changed.emit(should_show_banner())
		return
	_apply_request_config_before_ad_load()
	if _admob.is_banner_ad_loaded():
		_admob.show_banner_ad()
		_banner_mounted = true
		banner_visibility_changed.emit(true)
		return
	## One load request per free-tier session; AdMob refreshes the creative on its own.
	if _banner_load_requested:
		banner_visibility_changed.emit(true)
		return
	_banner_load_requested = true
	_admob.load_banner_ad()
	banner_visibility_changed.emit(true)


func _on_rewarded_earned(_ad_info, _reward) -> void:
	_reward_earned_pending = true


func _on_rewarded_dismissed(_ad_info) -> void:
	var sound_id := _pending_reward_sound_id
	var earned := _reward_earned_pending
	_pending_reward_sound_id = ""
	_reward_earned_pending = false
	_preload_rewarded()
	if sound_id.is_empty():
		return
	if earned:
		Entitlements.grant_temp_unlock(sound_id)
		rewarded_unlock_completed.emit(sound_id)
	else:
		rewarded_unlock_failed.emit("Watch the full ad to unlock.")


func _on_rewarded_failed_to_load(_ad_info, _error) -> void:
	_rewarded_ready = false
	## Soft retry shortly after a failed load.
	get_tree().create_timer(8.0).timeout.connect(_preload_rewarded)


func _on_rewarded_failed_to_show(_ad_info, _error) -> void:
	_pending_reward_sound_id = ""
	_reward_earned_pending = false
	_preload_rewarded()
	rewarded_unlock_failed.emit("Couldn't show the ad. Try again.")


func _on_playback_started(_sound_id: String) -> void:
	_playback_active = true


func _on_playback_stopped(_sound_id: String = "") -> void:
	_playback_active = false
