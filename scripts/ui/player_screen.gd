extends Control

@onready var _title: Label = $Margin/VBox/Title
@onready var _art: TextureRect = $Margin/VBox/ArtFrame/Art
@onready var _fx_layer: ColorRect = $Margin/VBox/ArtFrame/FxLayer
@onready var _play_stop_btn: Button = $Margin/VBox/ControlsPanel/Controls/PlayStopBtn
@onready var _repeat_btn: Button = $Margin/VBox/ControlsPanel/Controls/RepeatBtn
@onready var _back_btn: Button = $Margin/VBox/Top/BackBtn
@onready var _favorite_btn: Button = $Margin/VBox/Top/FavoriteBtn
@onready var _rate_panel: VBoxContainer = $Margin/VBox/RatePanel
@onready var _rate_label: Label = $Margin/VBox/RatePanel/RateLabel
@onready var _rate_slider: HSlider = $Margin/VBox/RatePanel/RateSlider
@onready var _controls_panel: PanelContainer = $Margin/VBox/ControlsPanel
@onready var _art_frame: PanelContainer = $Margin/VBox/ArtFrame
@onready var _margin: MarginContainer = $Margin
@onready var _vbox: VBoxContainer = $Margin/VBox

const FAV_ON := "res://assets/ui/icon_favorite_on.png"
const FAV_OFF := "res://assets/ui/icon_favorite_off.png"
const ICON_PLAY := "res://assets/ui/icon_play.png"
const ICON_STOP := "res://assets/ui/icon_stop.png"

var _sound: Dictionary = {}
var _is_playing: bool = false
var _breathe_tween: Tween
var _press_tween: Tween
var _play_ripple_timer: Timer


func _ready() -> void:
	add_to_group("player_screen")
	_back_btn.pressed.connect(_on_back)
	_play_stop_btn.pressed.connect(_on_play_stop)
	_play_stop_btn.button_down.connect(_on_play_press_down)
	_play_stop_btn.button_up.connect(_on_play_press_up)
	_repeat_btn.pressed.connect(_on_repeat_toggle)
	_favorite_btn.pressed.connect(_on_favorite_toggle)
	_rate_slider.value_changed.connect(_on_rate_changed)
	AudioController.playback_started.connect(_on_playback_started)
	AudioController.playback_stopped.connect(_on_playback_stopped)
	AudioController.playback_finished.connect(_on_playback_stopped)
	resized.connect(_apply_responsive_layout)
	get_viewport().size_changed.connect(_apply_responsive_layout)
	_fx_layer.visible = false
	_play_ripple_timer = Timer.new()
	_play_ripple_timer.wait_time = 1.15
	_play_ripple_timer.one_shot = false
	_play_ripple_timer.timeout.connect(_on_play_ripple_tick)
	add_child(_play_ripple_timer)
	_style_controls()
	_apply_responsive_layout()
	_refresh_rate_controls()
	_refresh_repeat_btn()
	_set_play_stop_visual(false)


func _style_controls() -> void:
	UiLook.style_back(_back_btn)
	UiLook.style_icon_button(_favorite_btn, FAV_OFF, true)
	UiLook.style_icon_button(_play_stop_btn, ICON_PLAY, true)
	_style_controls_panel_quiet()
	_rate_label.add_theme_color_override("font_color", Color(0.75, 0.82, 0.88, 1))
	_rate_slider.min_value = 0.5
	_rate_slider.max_value = 1.5
	_rate_slider.step = 0.05
	UiLook.style_hslider(_rate_slider)
	_title.add_theme_color_override("font_color", Color(0.86, 0.9, 0.94, 0.92))


func _style_controls_panel_quiet() -> void:
	var style := StyleBoxFlat.new()
	style.bg_color = Color(0.1, 0.13, 0.18, 0.28)
	style.corner_radius_top_left = 32
	style.corner_radius_top_right = 32
	style.corner_radius_bottom_right = 32
	style.corner_radius_bottom_left = 32
	style.set_content_margin_all(12)
	style.border_color = Color(0.37, 0.81, 0.69, 0.12)
	style.border_width_left = 1
	style.border_width_top = 1
	style.border_width_right = 1
	style.border_width_bottom = 1
	_controls_panel.add_theme_stylebox_override("panel", style)


func _apply_responsive_layout() -> void:
	var vs := get_viewport_rect().size
	var margins := Responsive.safe_outer_margins(Responsive.content_margins(vs))
	var tablet := Responsive.is_tablet(vs)
	## Extra top inset so Back never clips under the status bar / notch.
	var top := maxf(margins.y, 36.0 if tablet else 44.0)
	_margin.add_theme_constant_override("margin_left", int(margins.x))
	_margin.add_theme_constant_override("margin_top", int(top))
	_margin.add_theme_constant_override("margin_right", int(margins.z))
	_margin.add_theme_constant_override("margin_bottom", int(margins.w))
	_vbox.add_theme_constant_override("separation", 14 if tablet else 10)
	_title.add_theme_font_size_override("font_size", Responsive.title_font_size(vs))
	_art_frame.custom_minimum_size = Vector2(0, Responsive.player_art_min_height(vs))
	var btn_h := Responsive.top_button_min_height(vs)
	_back_btn.custom_minimum_size = Vector2(100, btn_h)
	_favorite_btn.custom_minimum_size = Vector2(btn_h + 8.0, btn_h + 8.0)
	var play_s := 132.0 if tablet else 116.0
	_play_stop_btn.custom_minimum_size = Vector2(play_s, play_s)
	_play_stop_btn.add_theme_constant_override("icon_max_width", int(play_s))
	_favorite_btn.add_theme_constant_override("icon_max_width", int(btn_h + 4.0))
	_repeat_btn.custom_minimum_size = Vector2(140 if tablet else 120, 44 if tablet else 40)
	_repeat_btn.add_theme_font_size_override("font_size", 15 if tablet else 14)


func open_sound(sound: Dictionary) -> void:
	_sound = sound
	_title.text = str(sound.get("name", ""))
	var art_path: String = str(sound.get("art", ""))
	if art_path != "" and ResourceLoader.exists(art_path):
		_art.texture = load(art_path)
	else:
		_art.texture = null
	_refresh_favorite_icon()
	_refresh_rate_controls()
	_refresh_repeat_btn()
	_art.rotation_degrees = 0
	_art.scale = Vector2.ONE
	_art.position = Vector2.ZERO
	_art.modulate = Color.WHITE
	_play_stop_btn.scale = Vector2.ONE
	_fx_layer.visible = false
	_stop_breathe()
	_set_play_stop_visual(false)
	_apply_art_frame(false)
	## Soundboard UX: start playback as soon as the player opens.
	call_deferred("_autoplay_opened_sound")


func _autoplay_opened_sound() -> void:
	if _sound.is_empty() or not visible:
		return
	if AudioController.is_playing() and AudioController.get_current_sound_id() == str(_sound.get("id", "")):
		return
	HapticsService.play()
	_spawn_ripple_on_control(_play_stop_btn)
	AudioController.play_sound(_sound)


func _refresh_rate_controls() -> void:
	_rate_panel.visible = LocalPrefs.show_pitch_speed
	var rate := AudioController.get_playback_rate()
	_rate_slider.set_value_no_signal(rate)
	_update_rate_label(rate)


func _update_rate_label(rate: float) -> void:
	_rate_label.text = "Pitch & Speed  ·  %.0f%%" % (rate * 100.0)


func _on_rate_changed(value: float) -> void:
	AudioController.set_playback_rate(value)
	LocalPrefs.save_prefs()
	_update_rate_label(value)


func _refresh_repeat_btn() -> void:
	var on := LocalPrefs.repeat_oneshots
	_repeat_btn.text = "Repeat  On" if on else "Repeat  Off"
	UiLook.style_chip(_repeat_btn, on)
	_repeat_btn.tooltip_text = (
		"Short sounds keep replaying until you stop"
		if on
		else "Turn on to replay short sounds automatically"
	)


func _on_repeat_toggle() -> void:
	LocalPrefs.repeat_oneshots = not LocalPrefs.repeat_oneshots
	LocalPrefs.save_prefs()
	HapticsService.tap()
	_spawn_ripple_on_control(_repeat_btn)
	_refresh_repeat_btn()
	## If already playing a oneshot, restart so loop flags apply.
	if _is_playing and not _sound.is_empty():
		AudioController.play_sound(_sound)


func _apply_art_frame(playing: bool) -> void:
	var style := StyleBoxFlat.new()
	style.bg_color = Color(0.1, 0.13, 0.18, 0.42)
	style.corner_radius_top_left = 28
	style.corner_radius_top_right = 28
	style.corner_radius_bottom_right = 28
	style.corner_radius_bottom_left = 28
	style.set_content_margin_all(10)
	if playing:
		style.border_color = Color(0.37, 0.81, 0.69, 0.55)
		style.border_width_left = 3
		style.border_width_top = 3
		style.border_width_right = 3
		style.border_width_bottom = 3
		style.shadow_color = Color(0.25, 0.65, 0.55, 0.32)
		style.shadow_size = 18
	else:
		style.border_color = Color(0.37, 0.81, 0.69, 0.16)
		style.border_width_left = 1
		style.border_width_top = 1
		style.border_width_right = 1
		style.border_width_bottom = 1
		style.shadow_color = Color(0.02, 0.03, 0.05, 0.3)
		style.shadow_size = 10
	style.shadow_offset = Vector2(0, 4)
	_art_frame.add_theme_stylebox_override("panel", style)


func _on_play_press_down() -> void:
	if _press_tween:
		_press_tween.kill()
	_press_tween = create_tween()
	_press_tween.tween_property(_play_stop_btn, "scale", Vector2(0.92, 0.92), 0.08).set_trans(Tween.TRANS_SINE)


func _on_play_press_up() -> void:
	if _press_tween:
		_press_tween.kill()
	_press_tween = create_tween()
	_press_tween.tween_property(_play_stop_btn, "scale", Vector2.ONE, 0.12).set_trans(Tween.TRANS_SINE)


func _on_play_stop() -> void:
	if _is_playing:
		HapticsService.tap()
		AudioController.stop()
	else:
		HapticsService.play()
		_spawn_ripple_on_control(_play_stop_btn)
		AudioController.play_sound(_sound)


func _spawn_ripple_on_control(ctrl: Control) -> void:
	var layer := get_tree().get_first_node_in_group("tap_ripple_layer")
	if layer != null and layer.has_method("spawn_at_global"):
		layer.call("spawn_at_global", ctrl.get_global_rect().get_center())


func _on_play_ripple_tick() -> void:
	if not _is_playing or not LocalPrefs.tap_ripples_enabled:
		return
	_spawn_ripple_on_control(_art_frame)


func _on_playback_started(sound_id: String) -> void:
	if sound_id != str(_sound.get("id", "")):
		return
	_set_play_stop_visual(true)
	_apply_art_frame(true)
	_start_breathe()
	if LocalPrefs.tap_ripples_enabled and _play_ripple_timer:
		_play_ripple_timer.start()


func _on_playback_stopped(_sound_id: String = "") -> void:
	if _sound.is_empty():
		return
	if _sound_id != "" and _sound_id != str(_sound.get("id", "")):
		return
	_set_play_stop_visual(false)
	_apply_art_frame(false)
	_stop_breathe()
	if _play_ripple_timer:
		_play_ripple_timer.stop()


func _on_back() -> void:
	AudioController.stop()
	get_tree().get_first_node_in_group("main_nav").call("show_home")


func _on_favorite_toggle() -> void:
	var sound_id := str(_sound.get("id", ""))
	LocalPrefs.toggle_favorite(sound_id)
	HapticsService.tap()
	_spawn_ripple_on_control(_favorite_btn)
	_refresh_favorite_icon()


func _refresh_favorite_icon() -> void:
	var on := LocalPrefs.is_favorite(str(_sound.get("id", "")))
	var path := FAV_ON if on else FAV_OFF
	if ResourceLoader.exists(path):
		_favorite_btn.icon = load(path)
		_favorite_btn.expand_icon = true
	_favorite_btn.text = ""
	_favorite_btn.tooltip_text = "Remove favorite" if on else "Add to favorites"


func _set_play_stop_visual(playing: bool) -> void:
	_is_playing = playing
	var path := ICON_STOP if playing else ICON_PLAY
	if ResourceLoader.exists(path):
		_play_stop_btn.icon = load(path)
		_play_stop_btn.expand_icon = true
	_play_stop_btn.text = ""
	_play_stop_btn.tooltip_text = "Stop" if playing else "Play"
	_play_stop_btn.modulate = Color.WHITE


func _start_breathe() -> void:
	_stop_breathe()
	_fx_layer.visible = true
	_fx_layer.color = Color(0.37, 0.81, 0.69, 0.0)
	_breathe_tween = create_tween().set_loops()
	_breathe_tween.tween_property(_art, "modulate", Color(1.04, 1.05, 1.04, 1.0), 1.7).set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_IN_OUT)
	_breathe_tween.parallel().tween_property(_fx_layer, "color:a", 0.07, 1.7).set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_IN_OUT)
	_breathe_tween.tween_property(_art, "modulate", Color.WHITE, 1.7).set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_IN_OUT)
	_breathe_tween.parallel().tween_property(_fx_layer, "color:a", 0.0, 1.7).set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_IN_OUT)


func _stop_breathe() -> void:
	if _breathe_tween != null:
		_breathe_tween.kill()
		_breathe_tween = null
	_art.modulate = Color.WHITE
	_art.scale = Vector2.ONE
	_fx_layer.color = Color(0.37, 0.81, 0.69, 0.0)
	_fx_layer.visible = false
