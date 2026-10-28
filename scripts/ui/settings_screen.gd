extends Control

@onready var _restore_btn: Button = $Margin/VBox/Scroll/Content/RestoreBtn
@onready var _privacy_btn: Button = $Margin/VBox/Scroll/Content/PrivacyBtn
@onready var _feedback_btn: Button = $Margin/VBox/Scroll/Content/FeedbackBtn
@onready var _rate_btn: Button = $Margin/VBox/Scroll/Content/RateBtn
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
const VERSION_TAP_WINDOW_SEC := 3.0

var _version_taps: int = 0
var _version_tap_at: float = 0.0
var _reminder_btn: CheckButton
var _reminder_time_btn: Button
var _reminder_guard := false


func _ready() -> void:
	_restore_btn.pressed.connect(_on_restore)
	_privacy_btn.pressed.connect(_on_privacy)
	_feedback_btn.pressed.connect(_on_feedback)
	_rate_btn.pressed.connect(_on_rate)
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
	_version.text = tr("StimPad v%s") % AppInfo.version_line()
	_version.mouse_filter = Control.MOUSE_FILTER_STOP
	_version.gui_input.connect(_on_version_gui_input)
	Entitlements.plus_changed.connect(func(_v): _refresh_plus_status())
	resized.connect(_apply_responsive_layout)
	_style_controls()
	_apply_responsive_layout()
	_refresh_plus_status()
	_refresh_toggles()
	_refresh_ad_privacy_btn(AdsService.privacy_choices_available())
	_build_reminder_rows()


func _on_visibility_changed() -> void:
	if visible:
		_refresh_toggles()
		_refresh_plus_status()
		_refresh_ad_privacy_btn(AdsService.privacy_choices_available())
		_refresh_reminder_rows()


func _style_controls() -> void:
	UiLook.style_settings_row(_restore_btn)
	UiLook.style_settings_row(_privacy_btn)
	UiLook.style_settings_row(_feedback_btn)
	UiLook.style_settings_row(_rate_btn)
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
	_plus_status.text = tr("StimPad Plus: Active") if Entitlements.has_plus() else tr("StimPad Plus: Not purchased")


func _refresh_toggles() -> void:
	_head_floss_btn.set_pressed_no_signal(HeadFlossService.is_enabled())
	_haptics_btn.set_pressed_no_signal(LocalPrefs.haptics_enabled)
	_pitch_speed_btn.set_pressed_no_signal(LocalPrefs.show_pitch_speed)
	_tap_ripples_btn.set_pressed_no_signal(LocalPrefs.tap_ripples_enabled)
	_repeat_btn.set_pressed_no_signal(LocalPrefs.repeat_oneshots)
	_volume_slider.set_value_no_signal(LocalPrefs.sfx_volume)
	_update_volume_label(LocalPrefs.sfx_volume)


func _update_volume_label(v: float) -> void:
	_volume_label.text = tr("Volume  ·  %.0f%%") % (clampf(v, 0.0, 1.0) * 100.0)


func _on_volume_changed(value: float) -> void:
	AudioController.apply_sfx_volume(value)
	LocalPrefs.save_prefs()
	_update_volume_label(value)


func _on_repeat_toggled(pressed: bool) -> void:
	LocalPrefs.repeat_oneshots = pressed
	LocalPrefs.save_prefs()
	if AudioController.is_playing() and not AudioController.is_previewing():
		LocalPrefs.capture_playback_session()
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


func _on_rate() -> void:
	ReviewService.open_write_review()


func _on_version_gui_input(event: InputEvent) -> void:
	## Five quick taps open the ads status panel. A shake must not, on a release build.
	if not Platform.is_android():
		return
	if not (event is InputEventMouseButton):
		return
	var press := event as InputEventMouseButton
	if not press.pressed or press.button_index != MOUSE_BUTTON_LEFT:
		return
	var now := Time.get_ticks_msec() / 1000.0
	if _version_taps == 0 or now - _version_tap_at > VERSION_TAP_WINDOW_SEC:
		_version_taps = 0
	_version_tap_at = now
	_version_taps += 1
	if _version_taps < 5:
		return
	_version_taps = 0
	AdsService.open_status_panel()


func _on_ad_privacy() -> void:
	AdsService.open_privacy_choices_from_settings()


func _on_back() -> void:
	get_tree().get_first_node_in_group("main_nav").call("show_home")


func _build_reminder_rows() -> void:
	if not Platform.is_ios() and not OS.has_feature("editor"):
		return
	var content := _restore_btn.get_parent()
	_reminder_btn = CheckButton.new()
	_reminder_btn.name = "ReminderBtn"
	_reminder_btn.text = tr("Daily reminder")
	_reminder_btn.custom_minimum_size = Vector2(0, 54)
	_reminder_btn.focus_mode = Control.FOCUS_NONE
	_reminder_time_btn = Button.new()
	_reminder_time_btn.name = "ReminderTimeBtn"
	_reminder_time_btn.custom_minimum_size = Vector2(0, 50)
	_reminder_time_btn.focus_mode = Control.FOCUS_NONE
	content.add_child(_reminder_btn)
	content.add_child(_reminder_time_btn)
	content.move_child(_reminder_btn, _restore_btn.get_index())
	content.move_child(_reminder_time_btn, _reminder_btn.get_index() + 1)
	UiLook.style_settings_row(_reminder_btn)
	UiLook.style_settings_row(_reminder_time_btn)
	_reminder_btn.action_mode = BaseButton.ACTION_MODE_BUTTON_RELEASE
	_reminder_btn.mouse_filter = Control.MOUSE_FILTER_STOP
	_reminder_btn.toggled.connect(_on_reminder_toggled)
	_reminder_time_btn.pressed.connect(_on_reminder_time)
	ReminderService.reminder_state_changed.connect(_refresh_reminder_rows)
	_refresh_reminder_rows()


func _refresh_reminder_rows() -> void:
	if _reminder_btn == null:
		return
	_reminder_guard = true
	_reminder_btn.set_pressed_no_signal(LocalPrefs.reminder_enabled)
	_reminder_guard = false
	_reminder_time_btn.text = tr("Reminder time  ·  %s") % ReminderService.format_time(
		LocalPrefs.reminder_hour, LocalPrefs.reminder_minute
	)


func _on_reminder_toggled(pressed: bool) -> void:
	if _reminder_guard:
		return
	if pressed:
		await ReminderService.enable_from_settings()
	else:
		await ReminderService.disable_from_settings()
	_refresh_reminder_rows()


func _on_reminder_time() -> void:
	ReminderService.pick_time_from_settings()
