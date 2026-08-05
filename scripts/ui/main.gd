extends Control

@onready var _screens: Control = $Screens
@onready var _home: Control = $Screens/HomeScreen
@onready var _player: Control = $Screens/PlayerScreen
@onready var _settings: Control = $Screens/SettingsScreen
@onready var _paywall: Control = $Screens/PaywallScreen
@onready var _banner_placeholder: Control = $BannerPlaceholder

var _current_screen: Control


func _ready() -> void:
	AudioController.set_session_duration(LocalPrefs.session_duration_sec)
	_show_screen(_home)
	AdsService.banner_visibility_changed.connect(_on_banner_visibility_changed)
	## Banner lives on AdsService for the whole free-tier session — not per-screen.
	AdsService.ensure_banner_mounted()
	AnalyticsService.log_screen("home")
	get_viewport().size_changed.connect(_update_banner_inset)
	_update_banner_inset()


func _update_banner_inset() -> void:
	var show_banner := AdsService.should_show_banner()
	var banner_h := 0.0
	if show_banner:
		banner_h = 64.0 if Responsive.is_tablet(get_viewport_rect().size) else 52.0
	## Reserve bottom space for the persistent native banner; do not recreate the ad.
	_screens.offset_bottom = -banner_h
	_banner_placeholder.offset_top = -banner_h
	_banner_placeholder.custom_minimum_size = Vector2(0, banner_h)
	_banner_placeholder.visible = show_banner


func show_home() -> void:
	AdsService.try_show_interstitial_on_safe_exit()
	_show_screen(_home)
	AnalyticsService.log_screen("home")


func show_player(sound: Dictionary) -> void:
	if not SoundCatalog.is_sound_unlocked(sound):
		show_paywall(sound)
		return
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


func _show_screen(screen: Control) -> void:
	for child in _screens.get_children():
		child.visible = child == screen
	_current_screen = screen
	## Keep the same banner visible while switching sounds / screens.


func _on_banner_visibility_changed(_visible: bool) -> void:
	_update_banner_inset()
