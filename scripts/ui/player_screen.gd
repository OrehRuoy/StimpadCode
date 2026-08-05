extends Control

@onready var _title: Label = $Margin/VBox/Title
@onready var _art: TextureRect = $Margin/VBox/ArtFrame/Art
@onready var _fx_layer: ColorRect = $Margin/VBox/ArtFrame/FxLayer
@onready var _play_btn: Button = $Margin/VBox/ControlsPanel/Controls/PlayBtn
@onready var _stop_btn: Button = $Margin/VBox/ControlsPanel/Controls/StopBtn
@onready var _back_btn: Button = $Margin/VBox/Top/BackBtn
@onready var _favorite_btn: Button = $Margin/VBox/Top/FavoriteBtn
@onready var _controls_panel: PanelContainer = $Margin/VBox/ControlsPanel
@onready var _art_frame: PanelContainer = $Margin/VBox/ArtFrame
@onready var _margin: MarginContainer = $Margin
@onready var _vbox: VBoxContainer = $Margin/VBox

const FAV_ON := "res://assets/ui/icon_favorite_on.png"
const FAV_OFF := "res://assets/ui/icon_favorite_off.png"

var _sound: Dictionary = {}


func _ready() -> void:
	add_to_group("player_screen")
	_back_btn.pressed.connect(_on_back)
	_play_btn.pressed.connect(_on_play)
	_stop_btn.pressed.connect(_on_stop)
	_favorite_btn.pressed.connect(_on_favorite_toggle)
	AudioController.playback_started.connect(_on_playback_started)
	AudioController.playback_stopped.connect(_on_playback_stopped)
	AudioController.playback_finished.connect(_on_playback_stopped)
	resized.connect(_apply_responsive_layout)
	get_viewport().size_changed.connect(_apply_responsive_layout)
	_fx_layer.visible = false
	_style_controls()
	_apply_responsive_layout()


func _style_controls() -> void:
	UiLook.style_back(_back_btn)
	UiLook.style_primary_mint(_play_btn)
	UiLook.style_secondary_slate(_stop_btn)
	UiLook.style_icon_button(_favorite_btn, FAV_OFF, true)
	UiLook.style_player_controls_panel(_controls_panel)
	_play_btn.add_theme_font_size_override("font_size", 22)
	_stop_btn.add_theme_font_size_override("font_size", 20)
	_stop_btn.modulate = Color(1, 1, 1, 0.7)


func _apply_responsive_layout() -> void:
	var vs := get_viewport_rect().size
	var margins := Responsive.safe_outer_margins(Responsive.content_margins(vs))
	var tablet := Responsive.is_tablet(vs)
	_margin.add_theme_constant_override("margin_left", int(margins.x))
	_margin.add_theme_constant_override("margin_top", int(margins.y))
	_margin.add_theme_constant_override("margin_right", int(margins.z))
	_margin.add_theme_constant_override("margin_bottom", int(margins.w))
	_vbox.add_theme_constant_override("separation", 16 if tablet else 12)
	_title.add_theme_font_size_override("font_size", Responsive.title_font_size(vs))
	_art_frame.custom_minimum_size = Vector2(0, Responsive.player_art_min_height(vs))
	var btn_h := Responsive.top_button_min_height(vs)
	_back_btn.custom_minimum_size = Vector2(100, btn_h)
	_favorite_btn.custom_minimum_size = Vector2(btn_h + 8.0, btn_h + 8.0)
	var control_h := 72.0 if tablet else 64.0
	_play_btn.custom_minimum_size = Vector2(0, control_h)
	_stop_btn.custom_minimum_size = Vector2(0, control_h)
	_play_btn.add_theme_font_size_override("font_size", 24 if tablet else 22)
	_stop_btn.add_theme_font_size_override("font_size", 22 if tablet else 20)
	_favorite_btn.add_theme_constant_override("icon_max_width", int(btn_h + 4.0))


func open_sound(sound: Dictionary) -> void:
	_sound = sound
	_title.text = str(sound.get("name", ""))
	var art_path: String = str(sound.get("art", ""))
	if art_path != "" and ResourceLoader.exists(art_path):
		_art.texture = load(art_path)
	else:
		_art.texture = null
	_refresh_favorite_icon()
	_art.rotation_degrees = 0
	_art.scale = Vector2.ONE
	_art.position = Vector2.ZERO
	_art.modulate = Color.WHITE
	_fx_layer.visible = false
	_apply_art_frame()


func _apply_art_frame() -> void:
	var style := StyleBoxFlat.new()
	style.bg_color = Color(0.1, 0.13, 0.18, 0.92)
	style.corner_radius_top_left = 28
	style.corner_radius_top_right = 28
	style.corner_radius_bottom_right = 28
	style.corner_radius_bottom_left = 28
	style.set_content_margin_all(16)
	style.border_color = Color(0.37, 0.81, 0.69, 0.5)
	style.border_width_left = 2
	style.border_width_top = 2
	style.border_width_right = 2
	style.border_width_bottom = 2
	style.shadow_color = Color(0.02, 0.03, 0.05, 0.45)
	style.shadow_size = 14
	style.shadow_offset = Vector2(0, 5)
	_art_frame.add_theme_stylebox_override("panel", style)


func _on_play() -> void:
	AudioController.play_sound(_sound)


func _on_stop() -> void:
	AudioController.stop()


func _on_back() -> void:
	AudioController.stop()
	get_tree().get_first_node_in_group("main_nav").call("show_home")


func _on_favorite_toggle() -> void:
	var sound_id := str(_sound.get("id", ""))
	LocalPrefs.toggle_favorite(sound_id)
	_refresh_favorite_icon()


func _refresh_favorite_icon() -> void:
	var on := LocalPrefs.is_favorite(str(_sound.get("id", "")))
	var path := FAV_ON if on else FAV_OFF
	if ResourceLoader.exists(path):
		_favorite_btn.icon = load(path)
		_favorite_btn.expand_icon = true
	_favorite_btn.text = ""
	_favorite_btn.tooltip_text = "Remove favorite" if on else "Add to favorites"


func _on_playback_started(sound_id: String) -> void:
	if sound_id != str(_sound.get("id", "")):
		return
	_play_btn.disabled = true
	_stop_btn.disabled = false
	_play_btn.modulate = Color(1, 1, 1, 0.55)
	_stop_btn.modulate = Color.WHITE


func _on_playback_stopped(_sound_id: String = "") -> void:
	if _sound.is_empty():
		return
	if _sound_id != "" and _sound_id != str(_sound.get("id", "")):
		return
	_play_btn.disabled = false
	_stop_btn.disabled = true
	_play_btn.modulate = Color.WHITE
	_stop_btn.modulate = Color(1, 1, 1, 0.7)
