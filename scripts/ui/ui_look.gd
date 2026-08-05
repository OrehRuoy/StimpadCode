extends RefCounted
class_name UiLook

## Shared StimPad visual helpers (slate / mint / coral).


static func load_tex(path: String) -> Texture2D:
	if ResourceLoader.exists(path):
		return load(path) as Texture2D
	return null


static func apply_bg_texture(rect: TextureRect, path: String) -> void:
	var tex := load_tex(path)
	if tex == null or rect == null:
		return
	rect.texture = tex
	rect.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	rect.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_COVERED
	rect.mouse_filter = Control.MOUSE_FILTER_IGNORE


static func round_flat(bg: Color, radius: float = 18.0, pad: float = 14.0) -> StyleBoxFlat:
	var style := StyleBoxFlat.new()
	style.bg_color = bg
	style.corner_radius_top_left = int(radius)
	style.corner_radius_top_right = int(radius)
	style.corner_radius_bottom_right = int(radius)
	style.corner_radius_bottom_left = int(radius)
	style.set_content_margin_all(pad)
	return style


static func style_primary_coral(btn: Button) -> void:
	var style := round_flat(Color(1.0, 0.42, 0.357, 1), 24, 18)
	style.shadow_color = Color(0.05, 0.05, 0.08, 0.45)
	style.shadow_size = 8
	style.shadow_offset = Vector2(0, 3)
	style.border_color = Color(1.0, 0.62, 0.52, 0.85)
	style.border_width_top = 2
	style.border_width_left = 1
	style.border_width_right = 1
	style.border_width_bottom = 0
	_apply_btn_styles(btn, style, Color(0.1, 0.12, 0.16, 1))


static func style_buy_plus(btn: Button) -> void:
	## Extra-large coral unlock CTA for paywall.
	var style := round_flat(Color(1.0, 0.45, 0.38, 1), 26, 20)
	style.bg_color = Color(1.0, 0.45, 0.38, 1)
	style.shadow_color = Color(0.04, 0.05, 0.08, 0.5)
	style.shadow_size = 10
	style.shadow_offset = Vector2(0, 4)
	style.border_color = Color(1.0, 0.72, 0.62, 0.95)
	style.border_width_top = 2
	style.border_width_left = 1
	style.border_width_right = 1
	style.border_width_bottom = 0
	style.content_margin_top = 18
	style.content_margin_bottom = 18
	style.content_margin_left = 22
	style.content_margin_right = 22
	_apply_btn_styles(btn, style, Color(0.1, 0.1, 0.14, 1))
	var hover := style.duplicate()
	hover.bg_color = Color(1.0, 0.52, 0.44, 1)
	btn.add_theme_stylebox_override("hover", hover)
	var pressed := style.duplicate()
	pressed.bg_color = Color(0.92, 0.38, 0.32, 1)
	btn.add_theme_stylebox_override("pressed", pressed)


static func style_primary_mint(btn: Button) -> void:
	var style := round_flat(Color(0.37, 0.81, 0.69, 1), 24, 18)
	style.shadow_color = Color(0.05, 0.08, 0.1, 0.4)
	style.shadow_size = 10
	style.shadow_offset = Vector2(0, 4)
	style.border_color = Color(0.72, 0.95, 0.88, 0.85)
	style.border_width_top = 2
	style.border_width_left = 1
	style.border_width_right = 1
	style.border_width_bottom = 0
	_apply_btn_styles(btn, style, Color(0.1, 0.12, 0.16, 1))
	var hover := style.duplicate()
	hover.bg_color = Color(0.45, 0.88, 0.76, 1)
	btn.add_theme_stylebox_override("hover", hover)
	var pressed := style.duplicate()
	pressed.bg_color = Color(0.3, 0.7, 0.6, 1)
	pressed.shadow_size = 4
	btn.add_theme_stylebox_override("pressed", pressed)


static func style_secondary_slate(btn: Button) -> void:
	var style := round_flat(Color(0.14, 0.18, 0.26, 0.92), 20, 16)
	style.border_color = Color(0.45, 0.86, 0.74, 0.55)
	style.border_width_left = 1
	style.border_width_top = 1
	style.border_width_right = 1
	style.border_width_bottom = 1
	style.shadow_color = Color(0.02, 0.04, 0.08, 0.42)
	style.shadow_size = 10
	style.shadow_offset = Vector2(0, 4)
	_apply_btn_styles(btn, style, Color(0.94, 0.97, 1, 1))
	btn.add_theme_font_size_override("font_size", 17)
	var hover := style.duplicate()
	hover.bg_color = Color(0.2, 0.27, 0.36, 0.96)
	hover.border_color = Color(0.55, 0.92, 0.82, 0.85)
	btn.add_theme_stylebox_override("hover", hover)
	var pressed := style.duplicate()
	pressed.bg_color = Color(0.12, 0.16, 0.22, 0.98)
	pressed.shadow_size = 4
	btn.add_theme_stylebox_override("pressed", pressed)


static func style_settings_row(btn: Button) -> void:
	## Taller settings list rows with mint left accent.
	var style := round_flat(Color(0.13, 0.17, 0.24, 0.9), 18, 16)
	style.border_color = Color(0.37, 0.81, 0.69, 0.55)
	style.border_width_left = 4
	style.border_width_top = 1
	style.border_width_right = 1
	style.border_width_bottom = 1
	style.shadow_color = Color(0.02, 0.03, 0.06, 0.38)
	style.shadow_size = 8
	style.shadow_offset = Vector2(0, 3)
	style.content_margin_left = 20
	style.content_margin_right = 20
	style.content_margin_top = 16
	style.content_margin_bottom = 16
	_apply_btn_styles(btn, style, Color(0.94, 0.97, 1, 1))
	btn.add_theme_font_size_override("font_size", 17)
	btn.custom_minimum_size = Vector2(btn.custom_minimum_size.x, maxf(btn.custom_minimum_size.y, 54.0))
	btn.alignment = HORIZONTAL_ALIGNMENT_LEFT
	var hover := style.duplicate()
	hover.bg_color = Color(0.18, 0.24, 0.32, 0.95)
	hover.border_color = Color(0.5, 0.9, 0.8, 0.75)
	btn.add_theme_stylebox_override("hover", hover)
	var pressed := style.duplicate()
	pressed.bg_color = Color(0.11, 0.14, 0.2, 0.98)
	btn.add_theme_stylebox_override("pressed", pressed)


static func style_ghost(btn: Button) -> void:
	var style := round_flat(Color(0.12, 0.15, 0.2, 0.5), 18, 12)
	style.border_color = Color(0.78, 0.84, 0.9, 0.18)
	style.border_width_left = 1
	style.border_width_top = 1
	style.border_width_right = 1
	style.border_width_bottom = 1
	_apply_btn_styles(btn, style, Color(0.82, 0.88, 0.93, 1))


static func style_back(btn: Button) -> void:
	## Uniform back control across paywall / player / settings.
	btn.text = "← Back"
	style_ghost(btn)
	btn.add_theme_font_size_override("font_size", 16)
	btn.custom_minimum_size = Vector2(maxf(btn.custom_minimum_size.x, 100.0), maxf(btn.custom_minimum_size.y, 44.0))
	btn.focus_mode = Control.FOCUS_ALL


static func style_chip(btn: Button, selected: bool, free_chip: bool = false) -> void:
	var style := StyleBoxFlat.new()
	if selected:
		if free_chip:
			style.bg_color = Color(0.37, 0.81, 0.69, 0.42)
			style.border_color = Color(0.37, 0.81, 0.69, 1)
		else:
			style.bg_color = Color(0.37, 0.81, 0.69, 0.38)
			style.border_color = Color(0.55, 0.92, 0.82, 1)
		style.border_width_left = 2
		style.border_width_top = 2
		style.border_width_right = 2
		style.border_width_bottom = 2
		style.shadow_color = Color(0.05, 0.1, 0.1, 0.28)
		style.shadow_size = 6
		style.shadow_offset = Vector2(0, 2)
	else:
		style.bg_color = Color(0.14, 0.18, 0.24, 0.88)
		style.border_color = Color(0.37, 0.81, 0.69, 0.28 if not free_chip else 0.5)
		style.border_width_left = 1
		style.border_width_top = 1
		style.border_width_right = 1
		style.border_width_bottom = 1
	style.corner_radius_top_left = 18
	style.corner_radius_top_right = 18
	style.corner_radius_bottom_right = 18
	style.corner_radius_bottom_left = 18
	style.content_margin_left = 12
	style.content_margin_right = 12
	style.content_margin_top = 10
	style.content_margin_bottom = 10
	_apply_btn_styles(btn, style, Color(0.94, 0.97, 1, 1))
	btn.alignment = HORIZONTAL_ALIGNMENT_CENTER


static func style_player_controls_panel(panel: PanelContainer) -> void:
	var style := StyleBoxFlat.new()
	style.bg_color = Color(0.1, 0.13, 0.18, 0.72)
	style.corner_radius_top_left = 26
	style.corner_radius_top_right = 26
	style.corner_radius_bottom_right = 26
	style.corner_radius_bottom_left = 26
	style.set_content_margin_all(16)
	style.border_color = Color(0.37, 0.81, 0.69, 0.28)
	style.border_width_left = 1
	style.border_width_top = 1
	style.border_width_right = 1
	style.border_width_bottom = 1
	style.shadow_color = Color(0.02, 0.03, 0.05, 0.4)
	style.shadow_size = 12
	style.shadow_offset = Vector2(0, 4)
	panel.add_theme_stylebox_override("panel", style)


static func style_large_dropdown(
	dropdown: OptionButton,
	min_height: float,
	font_size: int,
	popup_font_size: int
) -> void:
	dropdown.custom_minimum_size = Vector2(0, min_height)
	dropdown.focus_mode = Control.FOCUS_ALL
	dropdown.fit_to_longest_item = false
	var style := round_flat(Color(0.14, 0.18, 0.24, 0.94), 16, 14)
	style.border_color = Color(0.37, 0.81, 0.69, 0.45)
	style.border_width_left = 2
	style.border_width_top = 2
	style.border_width_right = 2
	style.border_width_bottom = 2
	style.content_margin_left = 18
	style.content_margin_right = 18
	style.content_margin_top = 14
	style.content_margin_bottom = 14
	dropdown.add_theme_stylebox_override("normal", style)
	dropdown.add_theme_stylebox_override("hover", style)
	dropdown.add_theme_stylebox_override("pressed", style)
	dropdown.add_theme_stylebox_override("focus", style)
	dropdown.add_theme_color_override("font_color", Color(0.94, 0.97, 1, 1))
	dropdown.add_theme_color_override("font_hover_color", Color(0.94, 0.97, 1, 1))
	dropdown.add_theme_color_override("font_pressed_color", Color(0.94, 0.97, 1, 1))
	dropdown.add_theme_font_size_override("font_size", font_size)
	var popup := dropdown.get_popup()
	popup.add_theme_font_size_override("font_size", popup_font_size)
	popup.add_theme_constant_override("v_separation", 10)
	popup.add_theme_constant_override("item_start_padding", 18)
	popup.add_theme_constant_override("item_end_padding", 18)
	## Extra vertical padding so each menu row is easy to tap.
	var popup_bg := round_flat(Color(0.12, 0.15, 0.2, 0.98), 14, 10)
	popup.add_theme_stylebox_override("panel", popup_bg)
	var hover := round_flat(Color(0.37, 0.81, 0.69, 0.28), 10, 12)
	hover.content_margin_left = 18
	hover.content_margin_right = 18
	hover.content_margin_top = 16
	hover.content_margin_bottom = 16
	popup.add_theme_stylebox_override("hover", hover)
	var sep := StyleBoxEmpty.new()
	sep.set_content_margin_all(6)
	popup.add_theme_stylebox_override("separator", sep)


static func style_texture_button(btn: Button, texture_path: String, font_color: Color) -> void:
	var tex := load_tex(texture_path)
	if tex == null:
		return
	var style := StyleBoxTexture.new()
	style.texture = tex
	style.texture_margin_left = 48
	style.texture_margin_top = 28
	style.texture_margin_right = 48
	style.texture_margin_bottom = 36
	style.content_margin_left = 20
	style.content_margin_right = 20
	style.content_margin_top = 14
	style.content_margin_bottom = 16
	btn.add_theme_stylebox_override("normal", style)
	btn.add_theme_stylebox_override("hover", style)
	btn.add_theme_stylebox_override("pressed", style)
	btn.add_theme_stylebox_override("disabled", style)
	btn.add_theme_color_override("font_color", font_color)
	btn.add_theme_color_override("font_hover_color", font_color)
	btn.add_theme_color_override("font_pressed_color", font_color)
	btn.add_theme_color_override("font_disabled_color", Color(font_color, 0.55))
	btn.flat = false


static func style_icon_button(btn: Button, icon_path: String, clear_text: bool = true) -> void:
	var tex := load_tex(icon_path)
	if tex:
		btn.icon = tex
		btn.expand_icon = true
	if clear_text:
		btn.text = ""
	var empty := StyleBoxEmpty.new()
	btn.add_theme_stylebox_override("normal", empty)
	btn.add_theme_stylebox_override("hover", empty)
	btn.add_theme_stylebox_override("pressed", empty)
	btn.add_theme_stylebox_override("focus", empty)
	btn.flat = true


static func _apply_btn_styles(btn: Button, style: StyleBoxFlat, font_color: Color) -> void:
	btn.add_theme_stylebox_override("normal", style)
	btn.add_theme_stylebox_override("hover", style)
	btn.add_theme_stylebox_override("pressed", style)
	btn.add_theme_stylebox_override("disabled", style)
	btn.add_theme_color_override("font_color", font_color)
	btn.add_theme_color_override("font_hover_color", font_color)
	btn.add_theme_color_override("font_pressed_color", font_color)
	btn.add_theme_color_override("font_disabled_color", Color(font_color, 0.5))
