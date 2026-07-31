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
	AdsService.show_banner_if_allowed()
	AnalyticsService.log_screen("home")


func show_home() -> void:
	AdsService.try_show_interstitial_on_safe_exit()
	_show_screen(_home)
	AnalyticsService.log_screen("home")


func show_player(sound: Dictionary) -> void:
	if not SoundCatalog.is_sound_unlocked(sound):
		show_paywall()
		return
	_show_screen(_player)
	_player.call("open_sound", sound)
	AnalyticsService.log_screen("player")


func show_settings() -> void:
	AdsService.try_show_interstitial_on_safe_exit()
	_show_screen(_settings)
	AnalyticsService.log_screen("settings")


func show_paywall() -> void:
	_show_screen(_paywall)
	AnalyticsService.log_screen("paywall")


func _show_screen(screen: Control) -> void:
	for child in _screens.get_children():
		child.visible = child == screen
	_current_screen = screen


func _on_banner_visibility_changed(visible: bool) -> void:
	_banner_placeholder.visible = visible and AdsService.should_show_banner()
