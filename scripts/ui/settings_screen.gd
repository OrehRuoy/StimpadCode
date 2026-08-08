extends Control

@onready var _restore_btn: Button = $Margin/VBox/Scroll/Content/RestoreBtn
@onready var _privacy_btn: Button = $Margin/VBox/Scroll/Content/PrivacyBtn
@onready var _feedback_btn: Button = $Margin/VBox/Scroll/Content/FeedbackBtn
@onready var _ad_privacy_btn: Button = $Margin/VBox/Scroll/Content/AdPrivacyBtn
@onready var _head_floss_btn: CheckButton = $Margin/VBox/Scroll/Content/HeadFlossBtn
@onready var _haptics_btn: CheckButton = $Margin/VBox/Scroll/Content/HapticsBtn
@onready var _pitch_speed_btn: CheckButton = $Margin/VBox/Scroll/Content/PitchSpeedBtn
@onready var _tap_ripples_btn: CheckButton = $Margin/VBox/Scroll/Content/TapRipplesBtn
@onready var _repeat_btn: CheckButton = $Margin/VBox/Scroll/Content/RepeatBtn
@onready var _volume_slider: HSlider = $Margin/VBox/Scroll/Content/VolumeSlider
@onready var _volume_label: Label = $Margin/VBox/Scroll/Content/VolumeLabel
@onready var _back_btn: Button = $Margin/VBox/Top/BackBtn
@onready var _version: Label = $Margin/VBox/Scroll/Content/VersionLabel
@onready var _plus_status: Label = $Margin/VBox/Scroll/Content/PlusStatus
@onready var _margin: MarginContainer = $Margin
@onready var _hero: TextureRect = $Margin/VBox/Scroll/Content/Hero
@onready var _scroll: ScrollContainer = $Margin/VBox/Scroll

const PRIVACY_URL := "https://orehruoy.github.io/StimPad/privacy-policy.html"


func _ready() -> void:
	_restore_btn.pressed.connect(_on_restore)
	_privacy_btn.pressed.connect(_on_privacy)
	_feedback_btn.pressed.connect(_on_feedback)
	_ad_privacy_btn.pressed.connect(_on_ad_privacy)
	_head_floss_btn.toggled.connect(_on_head_floss_toggled)
	_haptics_btn.toggled.connect(_on_haptics_toggled)
	_pitch_speed_btn.toggled.connect(_on_pitch_speed_toggled)
	_tap_ripples_btn.toggled.connect(_on_tap_ripples_toggled)
	_repeat_btn.toggled.connect(_on_repeat_toggled)
	_volume_slider.value_changed.connect(_on_volume_changed)
	AdsService.privacy_choices_availability_changed.connect(_refresh_ad_privacy_btn)
	_back_btn.pressed.connect(_on_back)
	visibility_changed.connect(_on_visibility_changed)
	_version.text = "StimPad v%s" % AppInfo.version_line()
	Entitlements.plus_changed.connect(func(_v): _refresh_plus_status())
	resized.connect(_apply_responsive_layout)
	_style_controls()
	_apply_responsive_layout()
	_refresh_plus_status()
	_refresh_toggles()
	_refresh_ad_privacy_btn(AdsService.privacy_choices_available())


func _on_visibility_changed() -> void:
	if visible:
		_refresh_toggles()
		_refresh_plus_status()
		_refresh_ad_privacy_btn(AdsService.privacy_choices_available())


func _style_controls() -> void:
	UiLook.style_settings_row(_restore_btn)
	UiLook.style_settings_row(_privacy_btn)
	UiLook.style_settings_row(_feedback_btn)
	UiLook.style_settings_row(_ad_privacy_btn)
	UiLook.style_settings_row(_head_floss_btn)
	UiLook.style_settings_row(_haptics_btn)
	UiLook.style_settings_row(_pitch_speed_btn)
	UiLook.style_settings_row(_tap_ripples_btn)
	UiLook.style_settings_row(_repeat_btn)
	UiLook.style_back(_back_btn)
	_scroll.vertical_scroll_mode = ScrollContainer.SCROLL_MODE_SHOW_NEVER
	## High deadzone so finger slides on toggles don't steal the tap into a scroll.
	_scroll.scroll_deadzone = 56
	var vbar := _scroll.get_v_scroll_bar()
	if vbar:
		vbar.modulate.a = 0.0
		vbar.mouse_filter = Control.MOUSE_FILTER_IGNORE
	UiLook.style_hslider(_volume_slider)
	## Prefer release-to-toggle so a short drag doesn't cancel the flip.
	for toggle in [_head_floss_btn, _haptics_btn, _pitch_speed_btn, _tap_ripples_btn, _repeat_btn]:
		toggle.action_mode = BaseButton.ACTION_MODE_BUTTON_RELEASE
		toggle.mouse_filter = Control.MOUSE_FILTER_STOP


func _apply_responsive_layout() -> void:
	var vs := get_viewport_rect().size
	var margins := Responsive.safe_outer_margins(Responsive.content_margins(vs))
	_margin.add_theme_constant_override("margin_left", int(margins.x))
	_margin.add_theme_constant_override("margin_top", int(margins.y))
	_margin.add_theme_constant_override("margin_right", int(margins.z))
	_margin.add_theme_constant_override("margin_bottom", int(margins.w))
	_hero.custom_minimum_size = Vector2(0, 140 if Responsive.is_tablet(vs) else 110)


func _refresh_plus_status() -> void:
	_plus_status.text = "StimPad Plus: Active" if Entitlements.has_plus() else "StimPad Plus: Not purchased"


func _refresh_toggles() -> void:
	_head_floss_btn.set_pressed_no_signal(HeadFlossService.is_enabled())
	_haptics_btn.set_pressed_no_signal(LocalPrefs.haptics_enabled)
	_pitch_speed_btn.set_pressed_no_signal(LocalPrefs.show_pitch_speed)
	_tap_ripples_btn.set_pressed_no_signal(LocalPrefs.tap_ripples_enabled)
	_repeat_btn.set_pressed_no_signal(LocalPrefs.repeat_oneshots)
	_volume_slider.set_value_no_signal(LocalPrefs.sfx_volume)
	_update_volume_label(LocalPrefs.sfx_volume)


func _update_volume_label(v: float) -> void:
	_volume_label.text = "Volume  ·  %.0f%%" % (clampf(v, 0.0, 1.0) * 100.0)


func _on_volume_changed(value: float) -> void:
	AudioController.apply_sfx_volume(value)
	LocalPrefs.save_prefs()
	_update_volume_label(value)


func _on_repeat_toggled(pressed: bool) -> void:
	LocalPrefs.repeat_oneshots = pressed
	LocalPrefs.save_prefs()
	HapticsService.tap()


func _on_head_floss_toggled(pressed: bool) -> void:
	HeadFlossService.set_enabled(pressed)
	if pressed:
		FeatureTipService.notify_feature_used("head_floss")


func _on_haptics_toggled(pressed: bool) -> void:
	LocalPrefs.haptics_enabled = pressed
	LocalPrefs.save_prefs()
	if pressed:
		HapticsService.tap()
		FeatureTipService.notify_feature_used("haptics")


func _on_pitch_speed_toggled(pressed: bool) -> void:
	LocalPrefs.show_pitch_speed = pressed
	LocalPrefs.save_prefs()
	if pressed:
		FeatureTipService.notify_feature_used("pitch_speed")


func _on_tap_ripples_toggled(pressed: bool) -> void:
	LocalPrefs.tap_ripples_enabled = pressed
	LocalPrefs.save_prefs()
	if pressed:
		FeatureTipService.notify_feature_used("tap_ripples")


func _on_restore() -> void:
	IAPService.restore_purchases()


func _refresh_ad_privacy_btn(available: bool) -> void:
	_ad_privacy_btn.visible = available and not Entitlements.has_plus()


func _on_privacy() -> void:
	OS.shell_open(PRIVACY_URL)


func _on_feedback() -> void:
	get_tree().get_first_node_in_group("main_nav").call("show_feedback", true)


func _on_ad_privacy() -> void:
	AdsService.open_privacy_choices_from_settings()


func _on_back() -> void:
	get_tree().get_first_node_in_group("main_nav").call("show_home")
