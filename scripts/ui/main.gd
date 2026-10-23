extends Control

signal banner_visibility_changed(visible: bool) ## unused; kept for scene group

@onready var _screens: Control = $Screens
@onready var _home: Control = $Screens/HomeScreen
@onready var _player: Control = $Screens/PlayerScreen
@onready var _settings: Control = $Screens/SettingsScreen
@onready var _paywall: Control = $Screens/PaywallScreen
@onready var _feedback: Control = $Screens/FeedbackScreen
@onready var _banner_placeholder: Control = $BannerPlaceholder
@onready var _boot_overlay: ColorRect = $BootOverlay
@onready var _boot_image: TextureRect = $BootOverlay/SplashImage

const NOW_PLAYING_H := 78.0
const NOW_PLAYING_GAP := 10.0
const NOW_PLAYING_SIDE := 12.0
const ICON_STOP := "res://assets/ui/icon_stop.png"
const EQ_FRAMES: Array[String] = [
	"res://assets/ui/eq_1.png",
	"res://assets/ui/eq_2.png",
	"res://assets/ui/eq_3.png",
	"res://assets/ui/eq_4.png",
]
const _DEVICE_LAYOUT_BRIDGE := "com.godot.game.DeviceLayoutBridge"
const _THREE_BUTTON_HOME_GAP_DP := 28.0

var _current_screen: Control
var _ripple_layer: Control
var _boot_dismissed: bool = false
var _now_playing: PanelContainer
var _now_open_btn: Button
var _now_title: Label
var _now_art: TextureRect
var _now_eq: TextureRect
var _now_eq_frames: Array[Texture2D] = []
var _now_eq_frame := 0
var _now_eq_wait := 0.0
var _now_stop: Button
var _now_hint: Label
var _now_open := false
var _now_bottom_target := 0.0
var _now_tween: Tween
var _preview_started_unix: float = 0.0
## -2 unknown, 0 no nav buttons, 1 has on-screen Home.
var _nav_buttons_cached: int = -2
var _house_banner: TextureButton
var _banner_fill: ColorRect
var _grid_fade: TextureRect


func _ready() -> void:
	AudioController.set_session_duration(LocalPrefs.session_duration_sec)
	_build_now_playing()
	AudioController.playback_started.connect(_on_now_playing_changed)
	AudioController.playback_stopped.connect(_on_now_playing_changed)
	AudioController.playback_finished.connect(_on_now_playing_changed)
	_setup_boot_overlay()
	_ensure_ripple_layer()
	_show_screen(_home)
	AdsService.banner_visibility_changed.connect(_on_banner_visibility_changed)
	AdsService.house_banner_changed.connect(_update_banner_inset)
	_ensure_banner_fill()
	_ensure_grid_fade()
	_ensure_house_banner()
	Entitlements.plus_changed.connect(func(_v): _update_banner_inset())
	get_viewport().size_changed.connect(_update_banner_inset)
	AudioController.preview_finished.connect(_on_preview_finished)
	Entitlements.library_unlock_ended.connect(_on_library_unlock_ended)
	_screens.clip_contents = true
	_update_banner_inset()
	AnalyticsService.log_app_open()
	## Keep splash up until home grid has staggered in — avoids crop flash + mid-load crash.
	if _home.has_signal("home_content_ready"):
		_home.home_content_ready.connect(_on_home_content_ready, CONNECT_ONE_SHOT)
	else:
		call_deferred("_on_home_content_ready")
	## If the home grid never signals, the overlay is nearly black. Reveal anyway.
	get_tree().create_timer(8.0).timeout.connect(_on_boot_timeout, CONNECT_ONE_SHOT)


func _setup_boot_overlay() -> void:
	if _boot_overlay == null:
		return
	_boot_overlay.visible = true
	_boot_overlay.mouse_filter = Control.MOUSE_FILTER_STOP
	_boot_overlay.z_index = 100
	_boot_overlay.color = Color(0, 0.051, 0.063, 1)
	_boot_overlay.modulate = Color.WHITE
	if _boot_image:
		_boot_image.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
		_boot_image.mouse_filter = Control.MOUSE_FILTER_IGNORE
		## Cover the screen. The art keeps its aspect and the matching background
		## fills anything the crop does not. Letterbox bars were the gray bands.
		_boot_image.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
		_boot_image.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_COVERED
		if ResourceLoader.exists("res://assets/branding/boot_splash.png"):
			_boot_image.texture = load("res://assets/branding/boot_splash.png")


func _on_boot_timeout() -> void:
	if _boot_dismissed:
		return
	push_warning("Main: home did not become ready in 8s — showing UI anyway")
	_finish_boot(true)


func _on_home_content_ready() -> void:
	_finish_boot(false)


func _finish_boot(from_timeout: bool) -> void:
	if _boot_dismissed:
		return
	_boot_dismissed = true
	## Wait until several tile batches are on screen before revealing home.
	if not from_timeout:
		await get_tree().create_timer(0.35).timeout
	if _boot_overlay != null and is_instance_valid(_boot_overlay):
		var tw := create_tween()
		tw.tween_property(_boot_overlay, "modulate:a", 0.0, 0.35)
		await tw.finished
		_boot_overlay.visible = false
		_boot_overlay.mouse_filter = Control.MOUSE_FILTER_IGNORE
	## Ads, Play Billing, and Firebase start only after splash is gone.
	AdsService.notify_ui_ready()
	IAPService.ensure_store_started()
	AnalyticsService.ensure_started()
	AdsService.ensure_banner_mounted()
	## Defer analytics — native Firebase log right at reveal coincided with prior crashes.
	get_tree().create_timer(3.0).timeout.connect(func() -> void:
		AnalyticsService.log_screen("home")
	, CONNECT_ONE_SHOT)


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


func show_home(count_safe_exit: bool = true) -> void:
	if AudioController.is_previewing():
		AudioController.end_preview("cancel")
	if count_safe_exit:
		AdsService.try_show_interstitial_on_safe_exit()
	_show_screen(_home)
	AnalyticsService.log_screen("home")
	EnjoyPromptService.on_returned_home()
	FeatureTipService.on_returned_home()


func show_player(sound: Dictionary) -> void:
	if not SoundCatalog.is_sound_unlocked(sound):
		if not _try_start_preview(sound):
			show_paywall(sound)
		return
	var reopening := (
		AudioController.is_playing()
		and AudioController.get_current_sound_id() == str(sound.get("id", ""))
	)
	if not reopening:
		FeatureTipService.note_sound_opened()
	_show_screen(_player)
	_player.call("open_sound", sound)
	AnalyticsService.log_screen("player")


func show_settings() -> void:
	if AudioController.is_previewing():
		AudioController.end_preview("cancel")
	AdsService.try_show_interstitial_on_safe_exit()
	_show_screen(_settings)
	AnalyticsService.log_screen("settings")


func show_paywall(for_sound: Dictionary = {}, reason: String = "") -> void:
	IAPService.ensure_store_started()
	_show_screen(_paywall)
	_paywall.call("open_for_sound", for_sound, reason)
	var why := reason
	if why.is_empty():
		why = "locked_sound" if not for_sound.is_empty() else "plus_button"
	AnalyticsService.log_event("paywall_view", {
		"reason": why,
		"sound_id": str(for_sound.get("id", "")),
	})
	AnalyticsService.log_screen("paywall")


func show_feedback(return_to_settings: bool = true) -> void:
	_show_screen(_feedback)
	if _feedback.has_method("open"):
		_feedback.call("open", return_to_settings)
	AnalyticsService.log_screen("feedback")


func _try_start_preview(sound: Dictionary) -> bool:
	if Entitlements.has_plus() or SoundCatalog.is_sound_unlocked(sound) or AudioController.is_playing():
		return false
	var sound_id := str(sound.get("id", ""))
	if not LocalPrefs.can_preview_today(sound_id):
		return false
	LocalPrefs.mark_previewed_today(sound_id)
	_show_screen(_player)
	_player.call("open_preview", sound)
	AnalyticsService.log_screen("player")
	if not AudioController.play_preview(sound):
		_player.call("close_preview")
		show_paywall(sound)
		return true
	_preview_started_unix = Time.get_unix_time_from_system()
	AnalyticsService.log_event("preview_started", {
		"sound_id": sound_id,
		"tier": str(sound.get("tier", "")),
	})
	return true


func _on_preview_finished(sound_id: String, reason: String) -> void:
	var duration := 0.0
	if _preview_started_unix > 0.0:
		duration = minf(float(AudioController.PREVIEW_SECONDS), Time.get_unix_time_from_system() - _preview_started_unix)
	_preview_started_unix = 0.0
	AnalyticsService.log_event("preview_ended", {
		"sound_id": sound_id,
		"reason": reason,
		"duration_sec": snappedf(maxf(duration, 0.0), 0.1),
	})
	_player.call("close_preview")
	if reason == "timeout" or reason == "stop":
		var sound := SoundCatalog.get_sound_by_id(sound_id)
		if SoundCatalog.is_sound_unlocked(sound):
			show_player(sound)
		else:
			show_paywall(sound, "preview_ended")


func _on_library_unlock_ended(reason: String) -> void:
	if reason == "plus_purchased":
		return
	var sound := AudioController.get_current_sound()
	if AudioController.is_playing() and not sound.is_empty() and not SoundCatalog.is_sound_unlocked(sound):
		AudioController.stop()
		if _current_screen == _player or _current_screen == _home or _current_screen == _paywall:
			show_paywall(sound, "library_window_ended")


func _notification(what: int) -> void:
	if what == NOTIFICATION_WM_GO_BACK_REQUEST:
		get_viewport().set_input_as_handled()
		_on_android_back()
		return
	if what == NOTIFICATION_APPLICATION_PAUSED or what == NOTIFICATION_APPLICATION_FOCUS_OUT:
		if AudioController.is_previewing():
			AudioController.end_preview("cancel")
			_show_screen(_home)


func _on_android_back() -> void:
	if EnjoyPromptService.is_showing():
		EnjoyPromptService.dismiss()
		return
	if FeatureTipService.is_showing():
		FeatureTipService.dismiss()
		return
	if _current_screen == _player or _current_screen == _paywall or _current_screen == _settings or _current_screen == _feedback:
		if _current_screen == _player and AudioController.is_previewing():
			_player.call("close_preview")
		show_home(false)
		return
	if _current_screen == _home:
		get_tree().quit()


func _show_screen(screen: Control) -> void:
	for child in _screens.get_children():
		child.visible = child == screen
	_current_screen = screen
	## Same native banner on every screen — show only, never reload.
	AdsService.keep_banner_visible()
	_refresh_now_playing()


func _on_banner_visibility_changed(_visible: bool) -> void:
	_update_banner_inset()


func _android_bottom_chrome() -> float:
	var safe: Rect2i = DisplayServer.get_display_safe_area()
	var win: Vector2i = DisplayServer.window_get_size()
	var view := get_viewport().get_visible_rect().size
	var bottom_px := float(win.y - (safe.position.y + safe.size.y))
	var inset := Responsive.px_to_viewport(maxf(bottom_px, 0.0), float(win.y), view.y)
	return inset + _three_button_gap_viewport()


func _has_on_screen_nav_buttons() -> bool:
	if not Platform.is_android():
		return false
	if _nav_buttons_cached >= 0:
		return _nav_buttons_cached == 1
	var bridge: Variant = JavaClassWrapper.wrap(_DEVICE_LAYOUT_BRIDGE)
	if JavaClassWrapper.get_exception() != null or bridge == null:
		return false
	var has: bool = bool(bridge.hasOnScreenNavButtons())
	if JavaClassWrapper.get_exception() != null:
		return false
	_nav_buttons_cached = 1 if has else 0
	return has


func _three_button_gap_viewport() -> float:
	if not _has_on_screen_nav_buttons():
		return 0.0
	var dpi: int = DisplayServer.screen_get_dpi()
	var density: float = maxf(float(dpi) / 160.0, 1.0)
	var extra_px: float = _THREE_BUTTON_HOME_GAP_DP * density
	var win_h: float = float(DisplayServer.window_get_size().y)
	var view_h: float = get_viewport().get_visible_rect().size.y
	return Responsive.px_to_viewport(extra_px, win_h, view_h)


func _ensure_banner_fill() -> void:
	if _banner_fill != null:
		return
	var fill := ColorRect.new()
	fill.name = "BannerFill"
	fill.mouse_filter = Control.MOUSE_FILTER_IGNORE
	fill.color = Color(0.055, 0.072, 0.095, 1)
	fill.visible = false
	fill.z_index = 0
	_banner_placeholder.z_index = 2
	fill.set_anchors_preset(Control.PRESET_BOTTOM_WIDE)
	add_child(fill)
	move_child(fill, _banner_placeholder.get_index())
	_banner_fill = fill


func _ensure_grid_fade() -> void:
	if _grid_fade != null:
		return
	var fade := TextureRect.new()
	fade.name = "GridFade"
	fade.mouse_filter = Control.MOUSE_FILTER_IGNORE
	fade.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	fade.stretch_mode = TextureRect.STRETCH_SCALE
	fade.z_index = 20
	fade.visible = false
	var grad := Gradient.new()
	grad.set_color(0, Color(0.04, 0.06, 0.09, 0.0))
	grad.set_color(1, Color(0.04, 0.06, 0.09, 0.82))
	grad.add_point(0.42, Color(0.04, 0.06, 0.09, 0.28))
	var tex := GradientTexture2D.new()
	tex.gradient = grad
	tex.width = 8
	tex.height = 128
	tex.fill_from = Vector2(0.5, 0.0)
	tex.fill_to = Vector2(0.5, 1.0)
	fade.texture = tex
	fade.set_anchors_preset(Control.PRESET_BOTTOM_WIDE)
	add_child(fade)
	_grid_fade = fade


func _ensure_house_banner() -> void:
	if _house_banner != null:
		return
	var button := TextureButton.new()
	button.name = "HouseBanner"
	button.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	button.ignore_texture_size = true
	button.stretch_mode = TextureButton.STRETCH_KEEP_ASPECT_COVERED
	button.mouse_filter = Control.MOUSE_FILTER_STOP
	button.focus_mode = Control.FOCUS_NONE
	button.visible = false
	button.pressed.connect(func() -> void:
		AdsService.open_current_house_ad()
	)
	_banner_placeholder.add_child(button)
	_house_banner = button


func _sync_house_banner(banner_h: float) -> void:
	if _house_banner == null:
		return
	var show := banner_h > 1.0 and AdsService.should_show_house_banner()
	_house_banner.visible = show
	if not show:
		return
	var ad: Dictionary = AdsService.current_house_ad()
	var path := str(ad.get("banner", ""))
	if path.is_empty() or not ResourceLoader.exists(path):
		_house_banner.texture_normal = null
		return
	_house_banner.texture_normal = load(path)


func _update_banner_inset() -> void:
	## The banner slot is the bottom of the screen. The grid runs under the
	## mini-player and fades there; it is not chopped off above a gray band.
	var banner_h := AdsService.banner_reserved_height()
	## Android anchors the banner above the system nav. That strip is painted
	## with the same dark fill so it is not a gray bar under the ad.
	var system_bottom := _android_bottom_chrome() if Platform.is_android() and banner_h > 1.0 else 0.0
	var show_bar := _now_playing_visible()
	var floor_h := banner_h + system_bottom
	if banner_h <= 1.0:
		floor_h = _card_safe_lift(banner_h)
	_screens.offset_bottom = -floor_h
	_banner_placeholder.offset_bottom = -system_bottom
	_banner_placeholder.offset_top = -(banner_h + system_bottom)
	_banner_placeholder.custom_minimum_size = Vector2(0, banner_h)
	_banner_placeholder.visible = banner_h > 1.0
	if _banner_fill != null:
		_banner_fill.offset_bottom = 0
		_banner_fill.offset_top = -floor_h
		_banner_fill.visible = floor_h > 1.0
	var rest_bottom := -(floor_h + NOW_PLAYING_GAP)
	_apply_now_playing_pose(show_bar, rest_bottom)
	if _grid_fade != null:
		var fade_h := NOW_PLAYING_H + NOW_PLAYING_GAP + 36.0
		_grid_fade.offset_bottom = -floor_h
		_grid_fade.offset_top = -(floor_h + fade_h)
		_grid_fade.visible = show_bar or _now_open
	## Never paint the scene's gray panel over the native banner view.
	_banner_placeholder.add_theme_stylebox_override("panel", StyleBoxEmpty.new())
	_banner_placeholder.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_sync_house_banner(banner_h)
	var house_up := _house_banner != null and _house_banner.visible
	var label := _banner_placeholder.get_node_or_null("Label") as Label
	if label:
		var show_label := not OS.has_feature("mobile") and OS.is_debug_build() and not house_up
		label.visible = show_label
		label.text = tr("Ad banner area") if AdsService.should_show_banner() else tr("Ad banner area (preview)")


func _card_safe_lift(banner_h: float) -> float:
	## The banner already sits in the home-indicator strip. With no banner,
	## the card itself has to clear that inset.
	if banner_h > 1.0:
		return 0.0
	var bottom_px := 0.0
	if Responsive.test_insets_enabled:
		bottom_px = Responsive.test_inset_px.w
	else:
		var safe := DisplayServer.get_display_safe_area()
		var win := DisplayServer.window_get_size()
		bottom_px = float(win.y - (safe.position.y + safe.size.y))
	var view := get_viewport().get_visible_rect().size
	var lift := Responsive.px_to_viewport(maxf(bottom_px, 0.0), float(DisplayServer.window_get_size().y), view.y)
	if Platform.is_android():
		lift += _three_button_gap_viewport()
	return lift


func _build_now_playing() -> void:
	_now_playing = PanelContainer.new()
	_now_playing.name = "NowPlaying"
	_now_playing.set_anchors_preset(Control.PRESET_BOTTOM_WIDE)
	_now_playing.offset_left = NOW_PLAYING_SIDE
	_now_playing.offset_right = -NOW_PLAYING_SIDE
	_now_playing.offset_bottom = 0
	_now_playing.offset_top = -NOW_PLAYING_H
	_now_playing.mouse_filter = Control.MOUSE_FILTER_STOP
	_now_playing.visible = false
	_now_playing.z_index = 30
	_now_playing.modulate.a = 0.0
	UiLook.style_now_playing_card(_now_playing)
	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 8)
	row.alignment = BoxContainer.ALIGNMENT_BEGIN
	_now_playing.add_child(row)
	_now_open_btn = Button.new()
	_now_open_btn.flat = true
	_now_open_btn.focus_mode = Control.FOCUS_NONE
	_now_open_btn.text = ""
	_now_open_btn.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_now_open_btn.size_flags_vertical = Control.SIZE_EXPAND_FILL
	var empty := StyleBoxEmpty.new()
	for state in ["normal", "hover", "pressed", "focus"]:
		_now_open_btn.add_theme_stylebox_override(state, empty)
	_now_open_btn.pressed.connect(_on_now_playing_open)
	row.add_child(_now_open_btn)
	var info := HBoxContainer.new()
	info.mouse_filter = Control.MOUSE_FILTER_IGNORE
	info.add_theme_constant_override("separation", 8)
	info.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	info.alignment = BoxContainer.ALIGNMENT_BEGIN
	_now_open_btn.add_child(info)
	_now_art = TextureRect.new()
	_now_art.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_now_art.custom_minimum_size = Vector2(52, 52)
	_now_art.size_flags_horizontal = Control.SIZE_SHRINK_BEGIN
	_now_art.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	_now_art.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	_now_art.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	info.add_child(_now_art)
	_now_eq = TextureRect.new()
	_now_eq.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_now_eq.custom_minimum_size = Vector2(28, 28)
	_now_eq.size_flags_horizontal = Control.SIZE_SHRINK_BEGIN
	_now_eq.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	_now_eq.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	_now_eq.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	info.add_child(_now_eq)
	for path in EQ_FRAMES:
		var frame := UiLook.load_tex(path)
		if frame != null:
			_now_eq_frames.append(frame)
	if not _now_eq_frames.is_empty():
		_now_eq.texture = _now_eq_frames[0]
	var words := VBoxContainer.new()
	words.mouse_filter = Control.MOUSE_FILTER_IGNORE
	words.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	words.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	words.alignment = BoxContainer.ALIGNMENT_CENTER
	words.add_theme_constant_override("separation", 0)
	info.add_child(words)
	_now_title = Label.new()
	_now_title.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_now_title.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_now_title.clip_text = true
	_now_title.text_overrun_behavior = TextServer.OVERRUN_TRIM_ELLIPSIS
	_now_title.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	_now_title.horizontal_alignment = HORIZONTAL_ALIGNMENT_LEFT
	_now_title.add_theme_font_size_override("font_size", 17)
	_now_title.add_theme_color_override("font_color", Color(0.94, 0.97, 1, 1))
	words.add_child(_now_title)
	_now_hint = Label.new()
	_now_hint.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_now_hint.add_theme_font_size_override("font_size", 13)
	_now_hint.add_theme_color_override("font_color", Color(0.65, 0.86, 0.78, 1))
	_now_hint.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	words.add_child(_now_hint)
	_now_stop = Button.new()
	_now_stop.focus_mode = Control.FOCUS_NONE
	_now_stop.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	_now_stop.custom_minimum_size = Vector2(56, 56)
	_now_stop.tooltip_text = tr("Stop")
	_now_stop.text = ""
	_now_stop.pressed.connect(_on_now_playing_stop)
	if ResourceLoader.exists(ICON_STOP):
		_now_stop.icon = load(ICON_STOP)
		_now_stop.expand_icon = true
		_now_stop.add_theme_constant_override("icon_max_width", 56)
		UiLook.style_icon_button(_now_stop, ICON_STOP, true)
	else:
		_now_stop.text = tr("Stop")
		UiLook.style_stop_button(_now_stop)
	row.add_child(_now_stop)
	add_child(_now_playing)
	if _boot_overlay != null:
		move_child(_now_playing, _boot_overlay.get_index())


func _apply_now_playing_pose(show: bool, rest_bottom: float) -> void:
	if _now_playing == null:
		return
	_now_playing.offset_left = NOW_PLAYING_SIDE
	_now_playing.offset_right = -NOW_PLAYING_SIDE
	var hidden_bottom := rest_bottom + NOW_PLAYING_H + 24.0
	if show:
		if _now_open and is_equal_approx(_now_bottom_target, rest_bottom):
			return
		var first := not _now_open
		_now_open = true
		_now_bottom_target = rest_bottom
		_now_playing.visible = true
		if first:
			_now_playing.modulate.a = 0.0
			_now_playing.offset_bottom = hidden_bottom
			_now_playing.offset_top = hidden_bottom - NOW_PLAYING_H
		_tween_now_playing(rest_bottom, 1.0, false)
		return
	if not _now_open:
		_now_playing.visible = false
		return
	_now_open = false
	_now_bottom_target = hidden_bottom
	_tween_now_playing(hidden_bottom, 0.0, true)


func _tween_now_playing(bottom: float, alpha: float, hide_after: bool) -> void:
	if _now_tween != null and _now_tween.is_valid():
		_now_tween.kill()
	_now_tween = create_tween()
	_now_tween.set_parallel(true)
	_now_tween.tween_property(_now_playing, "offset_bottom", bottom, 0.28).set_trans(Tween.TRANS_CUBIC).set_ease(Tween.EASE_OUT)
	_now_tween.tween_property(_now_playing, "offset_top", bottom - NOW_PLAYING_H, 0.28).set_trans(Tween.TRANS_CUBIC).set_ease(Tween.EASE_OUT)
	_now_tween.tween_property(_now_playing, "modulate:a", alpha, 0.22)
	if hide_after:
		_now_tween.chain().tween_callback(_hide_now_playing_after_slide)


func _hide_now_playing_after_slide() -> void:
	if _now_open or _now_playing == null:
		return
	_now_playing.visible = false
	_update_banner_inset()


func _now_playing_visible() -> bool:
	if not AudioController.is_playing():
		return false
	return _current_screen != _player


func _on_now_playing_changed(_sound_id: String = "") -> void:
	_refresh_now_playing()


func _refresh_now_playing() -> void:
	if _now_playing == null:
		return
	var show := _now_playing_visible()
	if show:
		var sound := AudioController.get_current_sound()
		var name := tr(str(sound.get("name", "Playing")))
		_now_title.text = name
		_now_open_btn.tooltip_text = tr("Open %s") % name
		var art_path := str(sound.get("art", ""))
		_now_art.texture = UiLook.load_tex(art_path)
		var left := AudioController.get_stop_seconds_left()
		if left < 0:
			_now_hint.text = ""
			_now_hint.visible = false
		else:
			_now_hint.visible = true
			_now_hint.text = _format_remaining(left)
	_update_banner_inset()


func _process(delta: float) -> void:
	if _now_playing == null or not _now_playing.visible:
		return
	if _now_eq != null and _now_eq_frames.size() > 1:
		_now_eq_wait += delta
		if _now_eq_wait >= 0.18:
			_now_eq_wait = 0.0
			_now_eq_frame = (_now_eq_frame + 1) % _now_eq_frames.size()
			_now_eq.texture = _now_eq_frames[_now_eq_frame]
	var left := AudioController.get_stop_seconds_left()
	if left < 0:
		if _now_hint.visible:
			_now_hint.visible = false
			_now_hint.text = ""
		return
	var text := _format_remaining(left)
	if _now_hint.text != text:
		_now_hint.visible = true
		_now_hint.text = text


func _format_remaining(seconds: int) -> String:
	var s := maxi(seconds, 0)
	return "%d:%02d" % [int(s / 60.0), s % 60]


func _on_now_playing_open() -> void:
	var sound := AudioController.get_current_sound()
	if sound.is_empty():
		return
	show_player(sound)


func _on_now_playing_stop() -> void:
	HapticsService.tap()
	AudioController.stop()
