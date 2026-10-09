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

const NOW_PLAYING_H := 58.0
const ICON_STOP := "res://assets/ui/icon_stop.png"

var _current_screen: Control
var _ripple_layer: Control
var _boot_dismissed: bool = false
var _now_playing: PanelContainer
var _now_title: Button
var _now_stop: Button
var _now_hint: Label
var _preview_started_unix: float = 0.0


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
	Entitlements.plus_changed.connect(func(_v): _update_banner_inset())
	get_viewport().size_changed.connect(_update_banner_inset)
	AudioController.preview_finished.connect(_on_preview_finished)
	Entitlements.library_unlock_ended.connect(_on_library_unlock_ended)
	_update_banner_inset()
	AnalyticsService.log_app_open()
	## Keep splash up until home grid has staggered in — avoids crop flash + mid-load crash.
	if _home.has_signal("home_content_ready"):
		_home.home_content_ready.connect(_on_home_content_ready, CONNECT_ONE_SHOT)
	else:
		call_deferred("_on_home_content_ready")


func _setup_boot_overlay() -> void:
	if _boot_overlay == null:
		return
	_boot_overlay.visible = true
	_boot_overlay.mouse_filter = Control.MOUSE_FILTER_STOP
	_boot_overlay.z_index = 100
	_boot_overlay.color = Color(0.102, 0.133, 0.188, 1)
	_boot_overlay.modulate = Color.WHITE
	if _boot_image:
		_boot_image.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
		_boot_image.mouse_filter = Control.MOUSE_FILTER_IGNORE
		## Match Godot engine splash (aspect fit / centered). Cover mode caused the
		## "full → bars → full" flash vs the engine letterbox step.
		_boot_image.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
		_boot_image.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
		if ResourceLoader.exists("res://assets/branding/boot_splash.png"):
			_boot_image.texture = load("res://assets/branding/boot_splash.png")


func _on_home_content_ready() -> void:
	if _boot_dismissed:
		return
	_boot_dismissed = true
	## Wait until several tile batches are on screen before revealing home.
	await get_tree().create_timer(0.35).timeout
	if _boot_overlay != null and is_instance_valid(_boot_overlay):
		var tw := create_tween()
		tw.tween_property(_boot_overlay, "modulate:a", 0.0, 0.35)
		await tw.finished
		_boot_overlay.visible = false
		_boot_overlay.mouse_filter = Control.MOUSE_FILTER_IGNORE
	## Ads start only after splash is gone (and AdsService may still no-op if disabled).
	AdsService.notify_ui_ready()
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


func show_home() -> void:
	if AudioController.is_previewing():
		AudioController.end_preview("cancel")
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
		show_paywall(SoundCatalog.get_sound_by_id(sound_id), "preview_ended")


func _on_library_unlock_ended(reason: String) -> void:
	if reason == "plus_purchased":
		return
	var sound := AudioController.get_current_sound()
	if AudioController.is_playing() and not sound.is_empty() and not SoundCatalog.is_sound_unlocked(sound):
		AudioController.stop()
		if _current_screen == _player or _current_screen == _home or _current_screen == _paywall:
			show_paywall(sound, "library_window_ended")


func _notification(what: int) -> void:
	if what == NOTIFICATION_APPLICATION_PAUSED or what == NOTIFICATION_APPLICATION_FOCUS_OUT:
		if AudioController.is_previewing():
			AudioController.end_preview("cancel")
			_show_screen(_home)


func _show_screen(screen: Control) -> void:
	for child in _screens.get_children():
		child.visible = child == screen
	_current_screen = screen
	## Same native banner on every screen — show only, never reload.
	AdsService.keep_banner_visible()
	_refresh_now_playing()


func _on_banner_visibility_changed(_visible: bool) -> void:
	_update_banner_inset()


func _update_banner_inset() -> void:
	## Reserve bottom space on free tier so app UI does not sit under the native banner.
	## On device the spacer must be empty — an opaque “Ad banner area” panel can cover
	## the native AdMob view and produce requests with 0 impressions.
	var reserve := not Entitlements.has_plus()
	var banner_h := AdsService.banner_reserved_height() if reserve else 0.0
	var bar_h := NOW_PLAYING_H if _now_playing_visible() else 0.0
	_screens.offset_bottom = -(banner_h + bar_h)
	_banner_placeholder.offset_top = -banner_h
	_banner_placeholder.custom_minimum_size = Vector2(0, banner_h)
	_banner_placeholder.visible = reserve
	if _now_playing != null:
		_now_playing.offset_bottom = -banner_h
		_now_playing.offset_top = -(banner_h + NOW_PLAYING_H)
		_now_playing.visible = bar_h > 0.0
	var preview := reserve and (not OS.has_feature("mobile") or OS.is_debug_build())
	if preview:
		_banner_placeholder.remove_theme_stylebox_override("panel")
	else:
		_banner_placeholder.add_theme_stylebox_override("panel", StyleBoxEmpty.new())
	_banner_placeholder.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var label := _banner_placeholder.get_node_or_null("Label") as Label
	if label:
		label.visible = preview
		label.text = tr("Ad banner area") if AdsService.should_show_banner() else tr("Ad banner area (preview)")


func _build_now_playing() -> void:
	_now_playing = PanelContainer.new()
	_now_playing.name = "NowPlaying"
	_now_playing.set_anchors_preset(Control.PRESET_BOTTOM_WIDE)
	_now_playing.offset_bottom = 0
	_now_playing.offset_top = -NOW_PLAYING_H
	_now_playing.mouse_filter = Control.MOUSE_FILTER_STOP
	_now_playing.visible = false
	_now_playing.z_index = 30
	var style := StyleBoxFlat.new()
	style.bg_color = Color(0.1, 0.14, 0.2, 0.96)
	style.border_color = Color(0.37, 0.81, 0.69, 0.7)
	style.border_width_top = 2
	style.content_margin_left = 8
	style.content_margin_right = 8
	style.content_margin_top = 6
	style.content_margin_bottom = 6
	_now_playing.add_theme_stylebox_override("panel", style)
	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 8)
	_now_playing.add_child(row)
	_now_title = Button.new()
	_now_title.flat = true
	_now_title.focus_mode = Control.FOCUS_NONE
	_now_title.alignment = HORIZONTAL_ALIGNMENT_LEFT
	_now_title.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_now_title.clip_text = true
	_now_title.add_theme_font_size_override("font_size", 16)
	_now_title.add_theme_color_override("font_color", Color(0.94, 0.97, 1, 1))
	_now_title.add_theme_color_override("font_hover_color", Color(0.94, 0.97, 1, 1))
	_now_title.add_theme_color_override("font_pressed_color", Color(0.72, 0.95, 0.88, 1))
	_now_title.pressed.connect(_on_now_playing_open)
	row.add_child(_now_title)
	_now_hint = Label.new()
	_now_hint.add_theme_font_size_override("font_size", 13)
	_now_hint.add_theme_color_override("font_color", Color(0.65, 0.78, 0.74, 1))
	_now_hint.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	row.add_child(_now_hint)
	_now_stop = Button.new()
	_now_stop.focus_mode = Control.FOCUS_NONE
	_now_stop.custom_minimum_size = Vector2(72, 40)
	_now_stop.tooltip_text = tr("Stop")
	_now_stop.pressed.connect(_on_now_playing_stop)
	if ResourceLoader.exists(ICON_STOP):
		_now_stop.icon = load(ICON_STOP)
		_now_stop.expand_icon = true
		_now_stop.add_theme_constant_override("icon_max_width", 28)
		_now_stop.text = ""
	else:
		_now_stop.text = tr("Stop")
	UiLook.style_chip(_now_stop, true)
	row.add_child(_now_stop)
	add_child(_now_playing)
	if _boot_overlay != null:
		move_child(_now_playing, _boot_overlay.get_index())


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
		_now_title.tooltip_text = tr("Open %s") % name
		var left := AudioController.get_stop_seconds_left()
		if left < 0:
			_now_hint.text = ""
			_now_hint.visible = false
		else:
			_now_hint.visible = true
			_now_hint.text = _format_remaining(left)
	_update_banner_inset()


func _process(_delta: float) -> void:
	if _now_playing == null or not _now_playing.visible:
		return
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
