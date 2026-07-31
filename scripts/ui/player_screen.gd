extends Control

@onready var _title: Label = $Margin/VBox/Title
@onready var _art: TextureRect = $Margin/VBox/ArtFrame/Art
@onready var _fx_layer: ColorRect = $Margin/VBox/ArtFrame/FxLayer
@onready var _play_btn: Button = $Margin/VBox/Controls/PlayBtn
@onready var _stop_btn: Button = $Margin/VBox/Controls/StopBtn
@onready var _back_btn: Button = $Margin/VBox/Top/BackBtn
@onready var _favorite_btn: Button = $Margin/VBox/Top/FavoriteBtn
@onready var _duration_row: HBoxContainer = $Margin/VBox/DurationRow
@onready var _duration_30: Button = $Margin/VBox/DurationRow/Duration30
@onready var _duration_60: Button = $Margin/VBox/DurationRow/Duration60
@onready var _duration_300: Button = $Margin/VBox/DurationRow/Duration300

var _sound: Dictionary = {}
var _fx_tween: Tween


func _ready() -> void:
	add_to_group("player_screen")
	_back_btn.pressed.connect(_on_back)
	_play_btn.pressed.connect(_on_play)
	_stop_btn.pressed.connect(_on_stop)
	_favorite_btn.pressed.connect(_on_favorite_toggle)
	_duration_30.pressed.connect(_set_duration.bind(30))
	_duration_60.pressed.connect(_set_duration.bind(60))
	_duration_300.pressed.connect(_set_duration.bind(300))
	AudioController.playback_started.connect(_on_playback_started)
	AudioController.playback_stopped.connect(_on_playback_stopped)
	AudioController.playback_finished.connect(_on_playback_stopped)
	LocalPrefs.save_prefs()


func open_sound(sound: Dictionary) -> void:
	_sound = sound
	_title.text = str(sound.get("name", ""))
	var art_path: String = str(sound.get("art", ""))
	if art_path != "" and ResourceLoader.exists(art_path):
		_art.texture = load(art_path)
	else:
		_art.texture = null
	var is_loop := str(sound.get("mode", "")) == "loop"
	_duration_row.visible = is_loop
	_update_duration_buttons()
	_favorite_btn.text = "★" if LocalPrefs.is_favorite(str(sound.get("id", ""))) else "☆"
	_stop_fx()


func _on_play() -> void:
	AudioController.play_sound(_sound)
	if str(_sound.get("mode", "")) == "oneshot":
		_pulse_fx_once()
	else:
		_start_fx_loop()


func _on_stop() -> void:
	AudioController.stop()
	_stop_fx()


func _on_back() -> void:
	AudioController.stop()
	get_tree().get_first_node_in_group("main_nav").call("show_home")


func _on_favorite_toggle() -> void:
	var sound_id := str(_sound.get("id", ""))
	LocalPrefs.toggle_favorite(sound_id)
	_favorite_btn.text = "★" if LocalPrefs.is_favorite(sound_id) else "☆"


func _set_duration(seconds: int) -> void:
	LocalPrefs.session_duration_sec = seconds
	LocalPrefs.save_prefs()
	AudioController.set_session_duration(seconds)
	_update_duration_buttons()


func _update_duration_buttons() -> void:
	var current := AudioController.get_session_duration()
	_duration_30.button_pressed = current == 30
	_duration_60.button_pressed = current == 60
	_duration_300.button_pressed = current == 300


func _on_playback_started(sound_id: String) -> void:
	if sound_id != str(_sound.get("id", "")):
		return
	_play_btn.disabled = true
	_stop_btn.disabled = false


func _on_playback_stopped(_sound_id: String = "") -> void:
	if _sound.is_empty():
		return
	if _sound_id != "" and _sound_id != str(_sound.get("id", "")):
		return
	_play_btn.disabled = false
	_stop_btn.disabled = true
	_stop_fx()


func _start_fx_loop() -> void:
	if not LocalPrefs.visual_effects_enabled:
		_fx_layer.visible = false
		return
	_fx_layer.visible = true
	if _fx_tween:
		_fx_tween.kill()
	_fx_tween = create_tween().set_loops()
	_fx_tween.tween_property(_fx_layer, "color:a", 0.55, 0.35)
	_fx_tween.tween_property(_fx_layer, "color:a", 0.08, 0.35)


func _pulse_fx_once() -> void:
	if not LocalPrefs.visual_effects_enabled:
		return
	_fx_layer.visible = true
	if _fx_tween:
		_fx_tween.kill()
	_fx_tween = create_tween()
	_fx_layer.color.a = 0.0
	_fx_tween.tween_property(_fx_layer, "color:a", 0.65, 0.08)
	_fx_tween.tween_property(_fx_layer, "color:a", 0.0, 0.25)


func _stop_fx() -> void:
	if _fx_tween:
		_fx_tween.kill()
	_fx_layer.visible = false
	_fx_layer.color.a = 0.0
