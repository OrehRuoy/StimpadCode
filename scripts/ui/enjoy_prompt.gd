extends Control
## Modal: “Are you enjoying StimPad?” — Yes / No / X.

signal closed

const CLOSE_ICON := "res://assets/ui/icon_close_x.png"

@onready var _scrim: ColorRect = $Scrim
@onready var _card: Control = $Center/Card
@onready var _panel: PanelContainer = $Center/Card/Panel
@onready var _logo: TextureRect = $Center/Card/Panel/Margin/VBox/Logo
@onready var _title: Label = $Center/Card/Panel/Margin/VBox/Title
@onready var _subtitle: Label = $Center/Card/Panel/Margin/VBox/Subtitle
@onready var _yes_btn: Button = $Center/Card/Panel/Margin/VBox/Buttons/YesBtn
@onready var _no_btn: Button = $Center/Card/Panel/Margin/VBox/Buttons/NoBtn
@onready var _close_btn: Button = $Center/Card/CloseBtn

var _closing := false


func _ready() -> void:
	_yes_btn.pressed.connect(_on_yes)
	_no_btn.pressed.connect(_on_no)
	_close_btn.pressed.connect(_on_close)
	_scrim.gui_input.connect(_on_scrim_input)
	_style()
	call_deferred("_fit_card_height")


func present() -> void:
	visible = true
	modulate.a = 0.0
	call_deferred("_animate_in")


func _animate_in() -> void:
	_fit_card_height()
	pivot_offset = size * 0.5
	scale = Vector2(0.96, 0.96)
	var tw := create_tween().set_parallel(true)
	tw.tween_property(self, "modulate:a", 1.0, 0.24)
	tw.tween_property(self, "scale", Vector2.ONE, 0.28).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)


func _fit_card_height() -> void:
	## Card is a plain Control so CloseBtn can sit on the true top-right corner
	## without PanelContainer stretching it over the Yes/No buttons.
	if _panel == null or _card == null:
		return
	var content := _panel.get_combined_minimum_size()
	_card.custom_minimum_size = Vector2(maxi(318, int(content.x)), maxi(280, int(content.y)))


func _style() -> void:
	var style := StyleBoxFlat.new()
	style.bg_color = Color(0.11, 0.15, 0.21, 1.0)
	style.corner_radius_top_left = 26
	style.corner_radius_top_right = 26
	style.corner_radius_bottom_right = 26
	style.corner_radius_bottom_left = 26
	style.set_content_margin_all(0)
	style.border_color = Color(0.37, 0.81, 0.69, 0.5)
	style.border_width_left = 1
	style.border_width_top = 1
	style.border_width_right = 1
	style.border_width_bottom = 1
	style.shadow_size = 0
	style.anti_aliasing = true
	_panel.add_theme_stylebox_override("panel", style)
	_panel.clip_contents = true

	_title.add_theme_color_override("font_color", Color(0.96, 0.97, 1, 1))
	_subtitle.add_theme_color_override("font_color", Color(0.68, 0.76, 0.84, 1))

	if _logo:
		_logo.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
		_logo.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
		_logo.mouse_filter = Control.MOUSE_FILTER_IGNORE

	UiLook.style_primary_mint(_yes_btn)
	_yes_btn.add_theme_font_size_override("font_size", 18)
	UiLook.style_secondary_slate(_no_btn)
	_no_btn.add_theme_font_size_override("font_size", 17)

	_style_close_btn()


func _style_close_btn() -> void:
	_close_btn.text = ""
	_close_btn.flat = true
	_close_btn.focus_mode = Control.FOCUS_NONE
	_close_btn.mouse_filter = Control.MOUSE_FILTER_STOP
	_close_btn.mouse_default_cursor_shape = Control.CURSOR_POINTING_HAND
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
	_close_btn.modulate = Color(0.9, 0.93, 0.97, 0.95)


func _on_yes() -> void:
	if _closing:
		return
	LocalPrefs.mark_enjoy_prompt_completed()
	AnalyticsService.log_event("enjoy_yes", {})
	ReviewService.request_review()
	_finish()


func _on_no() -> void:
	if _closing:
		return
	_closing = true
	LocalPrefs.snooze_enjoy_prompt(EnjoyPromptService.SNOOZE_NO_SEC)
	AnalyticsService.log_event("enjoy_no", {})
	## Open feedback first, then free this overlay next frame so the click
	## can’t fall through to the scrim / close handler.
	var nav := get_tree().get_first_node_in_group("main_nav")
	if nav != null and nav.has_method("show_feedback"):
		nav.call("show_feedback", false)
	call_deferred("_finish")


func _on_close() -> void:
	if _closing:
		return
	LocalPrefs.snooze_enjoy_prompt(EnjoyPromptService.SNOOZE_DISMISS_SEC)
	AnalyticsService.log_event("enjoy_dismiss", {})
	_finish()


func _on_scrim_input(event: InputEvent) -> void:
	if _closing:
		return
	if event is InputEventMouseButton and event.pressed and event.button_index == MOUSE_BUTTON_LEFT:
		_on_close()


func _finish() -> void:
	if not is_inside_tree():
		return
	_closing = true
	closed.emit()
	queue_free()
