extends Control

## Opt-in dialog for the daily reminder. Not a Home card.

signal declined
signal time_chosen(hour: int, minute: int)
signal cancelled

const DEFAULT_HOUR := 20
const DEFAULT_MINUTE := 0

var _card: PanelContainer
var _title: Label
var _body: Label
var _pick_btn: Button
var _no_btn: Button
var _save_btn: Button
var _hour_box: OptionButton
var _minute_box: OptionButton
var _ampm_box: OptionButton
var _picker: VBoxContainer
var _time_only := false
var _closing := false


func _ready() -> void:
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	mouse_filter = Control.MOUSE_FILTER_STOP
	_build()


func present_opt_in() -> void:
	_time_only = false
	visible = true
	_show_choice()


func present_time(hour_24: int, minute: int) -> void:
	_time_only = true
	visible = true
	_apply_time(hour_24, minute)
	_show_picker()


func _build() -> void:
	var scrim := ColorRect.new()
	scrim.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	scrim.color = Color(0.02, 0.04, 0.06, 0.72)
	scrim.mouse_filter = Control.MOUSE_FILTER_STOP
	add_child(scrim)

	var center := CenterContainer.new()
	center.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	center.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(center)

	_card = PanelContainer.new()
	_card.custom_minimum_size = Vector2(300, 0)
	_card.size_flags_horizontal = Control.SIZE_SHRINK_CENTER
	center.add_child(_card)
	var style := StyleBoxFlat.new()
	style.bg_color = Color(0.11, 0.15, 0.21, 1)
	style.corner_radius_top_left = 26
	style.corner_radius_top_right = 26
	style.corner_radius_bottom_right = 26
	style.corner_radius_bottom_left = 26
	style.set_content_margin_all(22)
	style.border_color = Color(0.37, 0.81, 0.69, 0.5)
	style.border_width_left = 1
	style.border_width_top = 1
	style.border_width_right = 1
	style.border_width_bottom = 1
	_card.add_theme_stylebox_override("panel", style)

	var box := VBoxContainer.new()
	box.add_theme_constant_override("separation", 14)
	_card.add_child(box)

	_title = Label.new()
	_title.text = tr("Daily reminder")
	_title.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_title.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	_title.add_theme_font_size_override("font_size", 20)
	_title.add_theme_color_override("font_color", Color(0.96, 0.97, 1, 1))
	box.add_child(_title)

	_body = Label.new()
	_body.text = tr("Want a quiet daily nudge with today's free sound?")
	_body.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_body.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	_body.custom_minimum_size = Vector2(260, 0)
	_body.add_theme_font_size_override("font_size", 16)
	_body.add_theme_color_override("font_color", Color(0.78, 0.84, 0.9, 1))
	box.add_child(_body)

	_picker = VBoxContainer.new()
	_picker.add_theme_constant_override("separation", 8)
	_picker.visible = false
	box.add_child(_picker)

	var row := HBoxContainer.new()
	row.alignment = BoxContainer.ALIGNMENT_CENTER
	row.add_theme_constant_override("separation", 8)
	_picker.add_child(row)
	_hour_box = _make_options(row)
	_minute_box = _make_options(row)
	_ampm_box = _make_options(row)
	for h in range(1, 13):
		_hour_box.add_item(str(h))
	for m in range(0, 60):
		_minute_box.add_item("%02d" % m)
	_ampm_box.add_item("AM")
	_ampm_box.add_item("PM")
	_apply_time(DEFAULT_HOUR, DEFAULT_MINUTE)

	var buttons := VBoxContainer.new()
	buttons.add_theme_constant_override("separation", 8)
	box.add_child(buttons)
	_pick_btn = _make_button(tr("Pick a time"))
	_no_btn = _make_button(tr("No thanks"))
	_save_btn = _make_button(tr("Set reminder"))
	_save_btn.visible = false
	buttons.add_child(_pick_btn)
	buttons.add_child(_save_btn)
	buttons.add_child(_no_btn)
	UiLook.style_primary_mint(_pick_btn)
	UiLook.style_primary_mint(_save_btn)
	UiLook.style_secondary_slate(_no_btn)
	_pick_btn.pressed.connect(_show_picker)
	_save_btn.pressed.connect(_confirm_time)
	_no_btn.pressed.connect(_on_no)


func _make_options(parent: Node) -> OptionButton:
	var box := OptionButton.new()
	box.custom_minimum_size = Vector2(88, 44)
	box.focus_mode = Control.FOCUS_NONE
	parent.add_child(box)
	return box


func _make_button(text: String) -> Button:
	var btn := Button.new()
	btn.text = text
	btn.custom_minimum_size = Vector2(0, 48)
	btn.focus_mode = Control.FOCUS_NONE
	return btn


func _show_choice() -> void:
	_body.visible = true
	_body.text = tr("Want a quiet daily nudge with today's free sound?")
	_picker.visible = false
	_pick_btn.visible = true
	_save_btn.visible = false
	_no_btn.visible = true
	_no_btn.text = tr("No thanks")
	_apply_time(DEFAULT_HOUR, DEFAULT_MINUTE)


func _show_picker() -> void:
	_picker.visible = true
	_pick_btn.visible = false
	_save_btn.visible = true
	if _time_only:
		_body.visible = false
		_title.text = tr("Reminder time")
		_save_btn.text = tr("Save")
		_no_btn.text = tr("Cancel")
	else:
		_body.visible = true
		_save_btn.text = tr("Set reminder")
		_no_btn.text = tr("No thanks")


func _apply_time(hour_24: int, minute: int) -> void:
	var hour := clampi(hour_24, 0, 23)
	var mins := clampi(minute, 0, 59)
	var pm := hour >= 12
	var h12 := hour % 12
	if h12 == 0:
		h12 = 12
	if _hour_box:
		_hour_box.select(h12 - 1)
	if _minute_box:
		_minute_box.select(mins)
	if _ampm_box:
		_ampm_box.select(1 if pm else 0)


func _selected_hour_24() -> int:
	var h12 := _hour_box.selected + 1
	var pm := _ampm_box.selected == 1
	var hour := h12 % 12
	if pm:
		hour += 12
	return hour


func _confirm_time() -> void:
	if _closing:
		return
	_closing = true
	time_chosen.emit(_selected_hour_24(), _minute_box.selected)
	queue_free()


func _on_no() -> void:
	if _closing:
		return
	_closing = true
	if _time_only:
		cancelled.emit()
	else:
		declined.emit()
	queue_free()
