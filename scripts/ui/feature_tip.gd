extends Control
## Lightweight tip card pointing users at Settings features.

signal closed

const CLOSE_ICON := "res://assets/ui/icon_close_x.png"

@onready var _scrim: ColorRect = $Scrim
@onready var _card: Control = $Center/Card
@onready var _panel: PanelContainer = $Center/Card/Panel
@onready var _title: Label = $Center/Card/Panel/Margin/VBox/Title
@onready var _subtitle: Label = $Center/Card/Panel/Margin/VBox/Subtitle
@onready var _settings_btn: Button = $Center/Card/Panel/Margin/VBox/Buttons/SettingsBtn
@onready var _ok_btn: Button = $Center/Card/Panel/Margin/VBox/Buttons/OkBtn
@onready var _close_btn: Button = $Center/Card/CloseBtn

var _closing := false


func _ready() -> void:
	_settings_btn.pressed.connect(_on_settings)
	_ok_btn.pressed.connect(_on_ok)
	_close_btn.pressed.connect(_on_ok)
	_scrim.gui_input.connect(_on_scrim_input)
	_style()


func present(tip: Dictionary) -> void:
	_title.text = str(tip.get("title", "Tip"))
	_subtitle.text = str(tip.get("body", ""))
	visible = true
	modulate.a = 0.0
	call_deferred("_animate_in")


func _animate_in() -> void:
	pivot_offset = size * 0.5
	scale = Vector2(0.96, 0.96)
	var tw := create_tween().set_parallel(true)
	tw.tween_property(self, "modulate:a", 1.0, 0.22)
	tw.tween_property(self, "scale", Vector2.ONE, 0.26).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)


func _style() -> void:
	var style := StyleBoxFlat.new()
	style.bg_color = Color(0.11, 0.15, 0.21, 1.0)
	style.corner_radius_top_left = 26
	style.corner_radius_top_right = 26
	style.corner_radius_bottom_right = 26
	style.corner_radius_bottom_left = 26
	style.border_color = Color(0.37, 0.81, 0.69, 0.5)
	style.border_width_left = 1
	style.border_width_top = 1
	style.border_width_right = 1
	style.border_width_bottom = 1
	style.anti_aliasing = true
	_panel.add_theme_stylebox_override("panel", style)
	_panel.clip_contents = true
	_title.add_theme_color_override("font_color", Color(0.96, 0.97, 1, 1))
	_subtitle.add_theme_color_override("font_color", Color(0.68, 0.76, 0.84, 1))
	UiLook.style_primary_mint(_settings_btn)
	_settings_btn.add_theme_font_size_override("font_size", 17)
	UiLook.style_secondary_slate(_ok_btn)
	_ok_btn.add_theme_font_size_override("font_size", 16)
	_style_close_btn()


func _style_close_btn() -> void:
	_close_btn.text = ""
	_close_btn.flat = true
	_close_btn.focus_mode = Control.FOCUS_NONE
	_close_btn.custom_minimum_size = Vector2(36, 36)
	var empty := StyleBoxEmpty.new()
	_close_btn.add_theme_stylebox_override("normal", empty)
	_close_btn.add_theme_stylebox_override("hover", empty)
	_close_btn.add_theme_stylebox_override("pressed", empty)
	_close_btn.add_theme_stylebox_override("focus", empty)
	if ResourceLoader.exists(CLOSE_ICON):
		_close_btn.icon = load(CLOSE_ICON)
		_close_btn.expand_icon = true
		_close_btn.add_theme_constant_override("icon_max_width", 20)


func _on_settings() -> void:
	if _closing:
		return
	_closing = true
	var nav := get_tree().get_first_node_in_group("main_nav")
	if nav != null and nav.has_method("show_settings"):
		nav.call("show_settings")
	call_deferred("_finish")


func _on_ok() -> void:
	if _closing:
		return
	_finish()


func _on_scrim_input(event: InputEvent) -> void:
	if _closing:
		return
	if event is InputEventMouseButton and event.pressed and event.button_index == MOUSE_BUTTON_LEFT:
		_on_ok()


func _finish() -> void:
	if not is_inside_tree():
		return
	_closing = true
	closed.emit()
	queue_free()
