extends Control

@onready var _screens: Control = $Screens
@onready var _home: Control = $Screens/HomeScreen
@onready var _player: Control = $Screens/PlayerScreen
@onready var _settings: Control = $Screens/SettingsScreen
@onready var _paywall: Control = $Screens/PaywallScreen
@onready var _feedback: Control = $Screens/FeedbackScreen
@onready var _banner_placeholder: Control = $BannerPlaceholder

var _current_screen: Control
var _ripple_layer: Control


func _ready() -> void:
	AudioController.set_session_duration(LocalPrefs.session_duration_sec)
	_ensure_ripple_layer()
	_show_screen(_home)
	AdsService.banner_visibility_changed.connect(_on_banner_visibility_changed)
	Entitlements.plus_changed.connect(func(_v): _update_banner_inset())
	## Banner lives on AdsService for the whole free-tier session — not per-screen.
	AdsService.ensure_banner_mounted()
	AnalyticsService.log_screen("home")
	get_viewport().size_changed.connect(_update_banner_inset)
	_update_banner_inset()


func _ensure_ripple_layer() -> void:
	_ripple_layer = Control.new()
	_ripple_layer.name = "TapRippleLayer"
	_ripple_layer.set_script(load("res://scripts/ui/tap_ripple_layer.gd"))
	_ripple_layer.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	_ripple_layer.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_ripple_layer.add_to_group("tap_ripple_layer")
	add_child(_ripple_layer)
	_ripple_layer.z_index = 40


func is_home_visible() -> bool:
	return _current_screen == _home and _home.visible


func show_home() -> void:
	AdsService.try_show_interstitial_on_safe_exit()
	_show_screen(_home)
	AnalyticsService.log_screen("home")
	EnjoyPromptService.on_returned_home()
	FeatureTipService.on_returned_home()


func show_player(sound: Dictionary) -> void:
	if not SoundCatalog.is_sound_unlocked(sound):
		show_paywall(sound)
		return
	EnjoyPromptService.note_sound_opened()
	FeatureTipService.note_sound_opened()
	_show_screen(_player)
	_player.call("open_sound", sound)
	AnalyticsService.log_screen("player")


func show_settings() -> void:
	AdsService.try_show_interstitial_on_safe_exit()
	_show_screen(_settings)
	AnalyticsService.log_screen("settings")


func show_paywall(for_sound: Dictionary = {}) -> void:
	_show_screen(_paywall)
	_paywall.call("open_for_sound", for_sound)
	AnalyticsService.log_screen("paywall")


func show_feedback(return_to_settings: bool = true) -> void:
	_show_screen(_feedback)
	if _feedback.has_method("open"):
		_feedback.call("open", return_to_settings)
	AnalyticsService.log_screen("feedback")


func _show_screen(screen: Control) -> void:
	for child in _screens.get_children():
		child.visible = child == screen
	_current_screen = screen


func _on_banner_visibility_changed(_visible: bool) -> void:
	_update_banner_inset()


func _update_banner_inset() -> void:
	## Always reserve bottom space on free tier so you can see where the banner sits
	## (editor + device), even before AdMob is ready. Plus hides it.
	var reserve := not Entitlements.has_plus()
	var banner_h := 0.0
	if reserve:
		banner_h = 64.0 if Responsive.is_tablet(get_viewport_rect().size) else 52.0
	_screens.offset_bottom = -banner_h
	_banner_placeholder.offset_top = -banner_h
	_banner_placeholder.custom_minimum_size = Vector2(0, banner_h)
	_banner_placeholder.visible = reserve
	var label := _banner_placeholder.get_node_or_null("Label") as Label
	if label:
		label.text = "Ad banner area" if AdsService.should_show_banner() else "Ad banner area (preview)"
