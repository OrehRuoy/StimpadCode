extends Node

signal banner_visibility_changed(visible: bool)

const PROD_BANNER_IOS := "stimpad_ios_banner"
const PROD_INTERSTITIAL_IOS := "stimpad_ios_interstitial"
const PROD_BANNER_ANDROID := "stimpad_android_banner"
const PROD_INTERSTITIAL_ANDROID := "stimpad_android_interstitial"

var _ads_enabled: bool = true
var _initialized: bool = false
var _playback_active: bool = false
var _admob: Admob
var _interstitial_ready: bool = false


func _ready() -> void:
	AudioController.playback_started.connect(_on_playback_started)
	AudioController.playback_stopped.connect(_on_playback_stopped)
	AudioController.playback_finished.connect(_on_playback_stopped.bind(""))
	call_deferred("_initialize_ads")


func set_ads_enabled(enabled: bool) -> void:
	_ads_enabled = enabled
	if not enabled:
		hide_banner()
	banner_visibility_changed.emit(should_show_banner())


func should_show_banner() -> bool:
	return _ads_enabled and not Entitlements.has_plus() and _has_mobile_ads()


func can_show_interstitial() -> bool:
	return (
		_ads_enabled
		and not Entitlements.has_plus()
		and not _playback_active
		and _has_mobile_ads()
		and _interstitial_ready
	)


func show_banner_if_allowed() -> void:
	if should_show_banner():
		_show_banner_native()
	else:
		hide_banner()


func hide_banner() -> void:
	if _admob:
		_admob.hide_banner_ad()
	banner_visibility_changed.emit(false)


func try_show_interstitial_on_safe_exit() -> void:
	if not can_show_interstitial():
		return
	if _admob:
		_admob.show_interstitial_ad()
		_interstitial_ready = false
		_preload_interstitial()


func _has_mobile_ads() -> bool:
	return OS.has_feature("mobile") and _admob != null and Engine.has_singleton("AdmobPlugin")


func _initialize_ads() -> void:
	if not OS.has_feature("mobile"):
		return
	if not ResourceLoader.exists("res://addons/AdmobPlugin/Admob.gd"):
		return
	var admob_script: Script = load("res://addons/AdmobPlugin/Admob.gd")
	_admob = admob_script.new()
	_admob.name = "Admob"
	_admob.is_real = false
	_admob.set("banner_position", 1)
	add_child(_admob)
	_admob.initialization_completed.connect(_on_admob_initialized)
	_admob.banner_ad_loaded.connect(func(_a, _r): _admob.show_banner_ad())
	_admob.interstitial_ad_loaded.connect(func(_a, _r): _interstitial_ready = true)
	if OS.get_name() == "iOS":
		await get_tree().process_frame
		await get_tree().create_timer(1.0).timeout
		_admob.request_tracking_authorization()
		await get_tree().process_frame
	_admob.initialize()


func _on_admob_initialized(_status) -> void:
	_initialized = true
	show_banner_if_allowed()
	if should_show_banner():
		_admob.load_banner_ad()
	_preload_interstitial()


func _preload_interstitial() -> void:
	if _admob and _ads_enabled and not Entitlements.has_plus():
		_admob.load_interstitial_ad()


func _show_banner_native() -> void:
	if not _initialized or _admob == null:
		banner_visibility_changed.emit(true)
		return
	if not _admob.is_banner_ad_loaded():
		_admob.load_banner_ad()
	else:
		_admob.show_banner_ad()
	banner_visibility_changed.emit(true)


func _on_playback_started(_sound_id: String) -> void:
	_playback_active = true


func _on_playback_stopped(_sound_id: String = "") -> void:
	_playback_active = false
