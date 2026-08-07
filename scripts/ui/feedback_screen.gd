extends Control

@onready var _back_btn: Button = $Margin/VBox/Top/BackBtn
@onready var _margin: MarginContainer = $Margin
@onready var _title_art: TextureRect = $Margin/VBox/TitleArt
@onready var _subtitle: Label = $Margin/VBox/Subtitle
@onready var _meta_card: PanelContainer = $Margin/VBox/MetaCard
@onready var _form_card: PanelContainer = $Margin/VBox/FormCard
@onready var _os_value: Label = $Margin/VBox/MetaCard/MetaMargin/MetaRow/OsBlock/OsValue
@onready var _version_value: Label = $Margin/VBox/MetaCard/MetaMargin/MetaRow/VersionBlock/VersionValue
@onready var _feedback_heading: Label = $Margin/VBox/FormCard/FormMargin/FormVBox/FeedbackHeading
@onready var _email_heading: Label = $Margin/VBox/FormCard/FormMargin/FormVBox/EmailHeading
@onready var _sounds_heading: Label = $Margin/VBox/FormCard/FormMargin/FormVBox/SoundsHeading
@onready var _feedback_edit: TextEdit = $Margin/VBox/FormCard/FormMargin/FormVBox/FeedbackEdit
@onready var _email_edit: LineEdit = $Margin/VBox/FormCard/FormMargin/FormVBox/EmailEdit
@onready var _sounds_edit: TextEdit = $Margin/VBox/FormCard/FormMargin/FormVBox/SoundsEdit
@onready var _submit_btn: Button = $Margin/VBox/SubmitBtn
@onready var _status: Label = $Margin/VBox/StatusLabel

var _return_to_settings: bool = true


func _ready() -> void:
	_back_btn.pressed.connect(_on_back)
	_submit_btn.pressed.connect(_on_submit)
	FeedbackService.submit_finished.connect(_on_submit_finished)
	resized.connect(_apply_responsive_layout)
	_style()
	_apply_responsive_layout()
	_fill_meta()


func open(return_to_settings: bool = true) -> void:
	_return_to_settings = return_to_settings
	_fill_meta()
	_status.text = " "
	_submit_btn.disabled = false


func _fill_meta() -> void:
	_os_value.text = AppInfo.os_label()
	_version_value.text = AppInfo.version_line()


func _style() -> void:
	UiLook.style_back(_back_btn)
	_back_btn.custom_minimum_size = Vector2(96, 40)
	UiLook.style_primary_mint(_submit_btn)
	_submit_btn.add_theme_font_size_override("font_size", 17)

	if _title_art:
		_title_art.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
		_title_art.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
		_title_art.mouse_filter = Control.MOUSE_FILTER_IGNORE

	_subtitle.add_theme_color_override("font_color", Color(0.68, 0.76, 0.84, 1))

	_style_card(_meta_card, true)
	_style_card(_form_card, false)
	_style_section_heading(_feedback_heading)
	_style_section_heading(_email_heading)
	_style_section_heading(_sounds_heading)
	_style_field(_feedback_edit)
	_style_line(_email_edit)
	_style_field(_sounds_edit)
	_status.add_theme_color_override("font_color", Color(0.72, 0.9, 0.84, 1))


func _style_card(panel: PanelContainer, mint_accent: bool) -> void:
	var style := StyleBoxFlat.new()
	style.bg_color = Color(0.11, 0.15, 0.21, 0.92)
	style.corner_radius_top_left = 16
	style.corner_radius_top_right = 16
	style.corner_radius_bottom_right = 16
	style.corner_radius_bottom_left = 16
	style.set_content_margin_all(0)
	if mint_accent:
		style.border_color = Color(0.37, 0.81, 0.69, 0.55)
		style.border_width_left = 4
		style.border_width_top = 1
		style.border_width_right = 1
		style.border_width_bottom = 1
	else:
		style.border_color = Color(0.37, 0.81, 0.69, 0.28)
		style.border_width_left = 1
		style.border_width_top = 1
		style.border_width_right = 1
		style.border_width_bottom = 1
	style.shadow_size = 0
	panel.add_theme_stylebox_override("panel", style)


func _style_section_heading(label: Label) -> void:
	label.add_theme_color_override("font_color", Color(0.55, 0.88, 0.78, 1))
	label.add_theme_font_size_override("font_size", 12)


func _style_field(edit: TextEdit) -> void:
	var style := UiLook.round_flat(Color(0.08, 0.11, 0.16, 0.95), 12, 10)
	style.border_color = Color(0.37, 0.81, 0.69, 0.4)
	style.border_width_left = 1
	style.border_width_top = 1
	style.border_width_right = 1
	style.border_width_bottom = 1
	edit.add_theme_stylebox_override("normal", style)
	edit.add_theme_stylebox_override("focus", style)
	edit.add_theme_color_override("font_color", Color(0.94, 0.97, 1, 1))
	edit.add_theme_color_override("font_placeholder_color", Color(0.52, 0.6, 0.68, 1))
	edit.add_theme_color_override("background_color", Color(0, 0, 0, 0))


func _style_line(edit: LineEdit) -> void:
	var style := UiLook.round_flat(Color(0.08, 0.11, 0.16, 0.95), 12, 10)
	style.border_color = Color(0.37, 0.81, 0.69, 0.4)
	style.border_width_left = 1
	style.border_width_top = 1
	style.border_width_right = 1
	style.border_width_bottom = 1
	edit.add_theme_stylebox_override("normal", style)
	edit.add_theme_stylebox_override("focus", style)
	edit.add_theme_color_override("font_color", Color(0.94, 0.97, 1, 1))
	edit.add_theme_color_override("font_placeholder_color", Color(0.52, 0.6, 0.68, 1))


func _apply_responsive_layout() -> void:
	var vs := get_viewport_rect().size
	var margins := Responsive.safe_outer_margins(Responsive.content_margins(vs))
	_margin.add_theme_constant_override("margin_left", int(maxi(14, int(margins.x))))
	_margin.add_theme_constant_override("margin_top", int(maxi(8, int(margins.y * 0.55))))
	_margin.add_theme_constant_override("margin_right", int(maxi(14, int(margins.z))))
	_margin.add_theme_constant_override("margin_bottom", int(maxi(8, int(margins.w * 0.55))))
	var tablet := Responsive.is_tablet(vs)
	if _title_art:
		_title_art.custom_minimum_size = Vector2(0, 48 if tablet else 40)
	_feedback_edit.custom_minimum_size = Vector2(0, 100 if tablet else 80)
	_sounds_edit.custom_minimum_size = Vector2(0, 72 if tablet else 56)


func _on_submit() -> void:
	if FeedbackService.is_busy():
		return
	_status.text = "Sending…"
	_status.add_theme_color_override("font_color", Color(0.75, 0.82, 0.9, 1))
	_submit_btn.disabled = true
	FeedbackService.submit(
		_feedback_edit.text,
		_email_edit.text,
		_sounds_edit.text
	)


func _on_submit_finished(ok: bool, message: String) -> void:
	_submit_btn.disabled = false
	_status.text = message
	if ok:
		_status.add_theme_color_override("font_color", Color(0.45, 0.9, 0.75, 1))
		_feedback_edit.text = ""
		_sounds_edit.text = ""
	else:
		_status.add_theme_color_override("font_color", Color(1.0, 0.55, 0.48, 1))


func _on_back() -> void:
	var nav := get_tree().get_first_node_in_group("main_nav")
	if _return_to_settings:
		nav.call("show_settings")
	else:
		nav.call("show_home")
