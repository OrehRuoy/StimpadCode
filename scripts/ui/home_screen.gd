extends Control

signal home_content_ready

const SOUND_TILE_SCENE := preload("res://scenes/ui/sound_tile.tscn")
const PLUS_ICON := "res://assets/ui/icon_plus_badge.png"
const SETTINGS_ICON := "res://assets/ui/icon_settings_gear.png"
const PLAY_BADGE := "res://assets/ui/icon_play.png"
const _ROUNDED_THUMB := preload("res://assets/ui/rounded_thumb.gdshader")
const PLAY_AGAIN_THUMB := 56.0
## Stagger tile art so iOS doesn't jetsam from decoding ~95 textures in one frame.
const TILE_BATCH := 6

## Scope chips stay compact. Categories use a dropdown (many items).
const CHIP_H_PHONE := 44.0
const CHIP_H_TABLET := 50.0
const CHIP_FONT_PHONE := 15
const CHIP_FONT_TABLET := 17
const DROPDOWN_H_PHONE := 52.0
const DROPDOWN_H_TABLET := 60.0
const DROPDOWN_FONT_PHONE := 17
const DROPDOWN_FONT_TABLET := 20
const POPUP_FONT_PHONE := 19
const POPUP_FONT_TABLET := 22

@onready var _margin: MarginContainer = $Margin
@onready var _grid: GridContainer = $Margin/VBox/Scroll/Grid
@onready var _scroll: ScrollContainer = $Margin/VBox/Scroll
@onready var _empty_state: Label = $Margin/VBox/EmptyState
@onready var _settings_btn: Button = $SettingsBtn
@onready var _plus_btn: Button = $PlusBtn
@onready var _logo: TextureRect = $Margin/VBox/TopBar/BrandRow/Logo
@onready var _top_bar: VBoxContainer = $Margin/VBox/TopBar
@onready var _corner_spacer: Control = $Margin/VBox/TopBar/CornerSpacer
@onready var _scope_scroll: ScrollContainer = $Margin/VBox/ScopeScroll
@onready var _scope_row: HBoxContainer = $Margin/VBox/ScopeScroll/ScopeRow
@onready var _category_select: OptionButton = $Margin/VBox/CategorySelect
@onready var _features_banner: HBoxContainer = $Margin/VBox/FeaturesBanner
@onready var _features_dismiss: Button = $Margin/VBox/FeaturesBanner/FeaturesDismiss
@onready var _dev_menu: OptionButton = $Margin/VBox/DevMenu

var _selected_scope: String = "All"
var _selected_sound_category: String = "All"
var _last_columns: int = -1
var _scope_ids: Array[String] = ["All", "Free", "Favorites", "Recent"]
var _category_ids: Array[String] = []
var _scope_chips: Dictionary = {} ## id -> Button
var _scope_fade: TextureRect
var _shared_thumb_mat: ShaderMaterial
var _syncing_dev_menu: bool = false
var _grid_gen: int = 0
var _first_home_ready_emitted: bool = false
var _popup_clamps: Dictionary = {}
var _play_again_column: VBoxContainer
var _play_again_caption: Label
var _play_again_scroll: ScrollContainer
var _play_again_box: HBoxContainer
var _library_label: Label

enum DevMenuItem {
	UNPAID = 0,
	PAID = 1,
	FORCE_ENJOY_PROMPT = 2,
	FORCE_FEATURE_TIP = 3,
}


func _ready() -> void:
	_selected_scope = LocalPrefs.last_scope
	_selected_sound_category = LocalPrefs.last_sound_category
	_settings_btn.pressed.connect(_on_settings_pressed)
	_plus_btn.pressed.connect(_on_plus_pressed)
	_category_select.item_selected.connect(_on_category_item_selected)
	_features_dismiss.pressed.connect(_on_features_dismiss)
	Entitlements.plus_changed.connect(_on_plus_changed)
	Entitlements.temp_unlocks_changed.connect(_refresh_grid)
	Entitlements.temp_unlocks_changed.connect(_rebuild_play_again)
	Entitlements.temp_unlocks_changed.connect(_refresh_library_banner)
	visibility_changed.connect(_on_home_visibility_changed)
	SoundCatalog.catalog_loaded.connect(_rebuild_filters)
	SoundCatalog.catalog_loaded.connect(_refresh_grid)
	resized.connect(_apply_responsive_layout)
	get_viewport().size_changed.connect(_apply_responsive_layout)
	if ResourceLoader.exists("res://assets/branding/logo_wordmark.png"):
		_logo.texture = load("res://assets/branding/logo_wordmark.png")
	_style_top_buttons()
	_setup_dev_menu()
	_refresh_features_banner()
	_scroll.scroll_deadzone = 24
	_scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	_scroll.vertical_scroll_mode = ScrollContainer.SCROLL_MODE_SHOW_NEVER
	_scroll.clip_contents = true
	_hide_scroll_bar(_scroll.get_v_scroll_bar())
	_hide_scroll_bar(_scroll.get_h_scroll_bar())
	_scope_scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_AUTO
	_scope_scroll.vertical_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	_scope_scroll.clip_contents = true
	_hide_scroll_bar(_scope_scroll.get_h_scroll_bar())
	_hide_scroll_bar(_scope_scroll.get_v_scroll_bar())
	_rebuild_filters()
	_build_play_again()
	_build_library_banner()
	_apply_responsive_layout()
	_wire_android_popups()
	if SoundCatalog.sounds.size() > 0:
		_refresh_grid()


func _hide_scroll_bar(bar: ScrollBar) -> void:
	if bar == null:
		return
	bar.modulate.a = 0.0
	bar.mouse_filter = Control.MOUSE_FILTER_IGNORE
	bar.custom_minimum_size = Vector2.ZERO


func _setup_dev_menu() -> void:
	## Editor / debug builds only — never in release store builds.
	var show_menu := OS.is_debug_build()
	_dev_menu.visible = show_menu
	if not show_menu:
		_dev_menu.mouse_filter = Control.MOUSE_FILTER_IGNORE
		return
	_dev_menu.clear()
	_dev_menu.add_item("Dev: Unpaid", DevMenuItem.UNPAID)
	_dev_menu.add_item("Dev: Paid (Plus)", DevMenuItem.PAID)
	_dev_menu.add_item("Dev: Force enjoy prompt", DevMenuItem.FORCE_ENJOY_PROMPT)
	_dev_menu.add_item("Dev: Force feature tip", DevMenuItem.FORCE_FEATURE_TIP)
	_sync_dev_menu_to_entitlements(Entitlements.has_plus())
	_dev_menu.item_selected.connect(_on_dev_menu_selected)
	Entitlements.plus_changed.connect(_sync_dev_menu_to_entitlements)
	UiLook.style_large_dropdown(_dev_menu, 48.0, 15, 16)


func _sync_dev_menu_to_entitlements(is_plus: bool) -> void:
	if not _dev_menu.visible:
		return
	_syncing_dev_menu = true
	_dev_menu.select(DevMenuItem.PAID if is_plus else DevMenuItem.UNPAID)
	_syncing_dev_menu = false


func _on_dev_menu_selected(index: int) -> void:
	if _syncing_dev_menu:
		return
	var id := _dev_menu.get_item_id(index)
	match id:
		DevMenuItem.UNPAID:
			Entitlements.set_plus_for_debug(false)
		DevMenuItem.PAID:
			Entitlements.set_plus_for_debug(true)
		DevMenuItem.FORCE_ENJOY_PROMPT:
			LocalPrefs.reset_enjoy_prompt_for_debug()
			EnjoyPromptService.force_show_now()
			_sync_dev_menu_to_entitlements(Entitlements.has_plus())
		DevMenuItem.FORCE_FEATURE_TIP:
			LocalPrefs.reset_feature_tips_for_debug()
			FeatureTipService.force_show_now()
			_sync_dev_menu_to_entitlements(Entitlements.has_plus())


func _refresh_features_banner() -> void:
	_features_banner.visible = not LocalPrefs.home_features_banner_dismissed


func _on_features_dismiss() -> void:
	LocalPrefs.home_features_banner_dismissed = true
	LocalPrefs.save_prefs()
	_features_banner.visible = false


func _style_top_buttons() -> void:
	UiLook.style_icon_button(_plus_btn, PLUS_ICON, true)
	UiLook.style_icon_button(_settings_btn, SETTINGS_ICON, true)
	_plus_btn.visible = not Entitlements.has_plus()


func _on_plus_changed(is_plus: bool) -> void:
	_plus_btn.visible = not is_plus
	_apply_responsive_layout()
	_refresh_grid()
	_rebuild_play_again()


func _apply_responsive_layout() -> void:
	var vs := get_viewport_rect().size
	var margins := Responsive.safe_outer_margins(Responsive.content_margins(vs))
	_margin.add_theme_constant_override("margin_left", int(margins.x))
	_margin.add_theme_constant_override("margin_top", int(margins.y))
	_margin.add_theme_constant_override("margin_right", int(margins.z))
	_margin.add_theme_constant_override("margin_bottom", int(margins.w))
	_margin.clip_contents = true
	_layout_header(vs, margins)
	_wire_android_popups()
	_style_filters(vs)
	var columns := _column_count(vs)
	if columns != _last_columns and _grid.get_child_count() > 0:
		_refresh_grid()
	elif _last_columns < 0:
		_last_columns = columns


func _content_width(vs: Vector2, margins: Vector4) -> float:
	return maxf(120.0, vs.x - margins.x - margins.z)


func _column_count(vs: Vector2) -> int:
	var margins := Responsive.safe_outer_margins(Responsive.content_margins(vs))
	return Responsive.grid_columns_for_width(_content_width(vs, margins))


func _layout_header(vs: Vector2, margins: Vector4) -> void:
	## Logo is centered on its own. Plus is the top-left corner. The gear is
	## the top-right corner. Neither sits beside the wordmark.
	var tablet := Responsive.is_tablet(vs)
	var icon_s := 52.0 if tablet else 44.0
	_plus_btn.custom_minimum_size = Vector2(icon_s, icon_s)
	_settings_btn.custom_minimum_size = Vector2(icon_s, icon_s)
	var content_w := _content_width(vs, margins)
	var logo_h := 72.0 if tablet else 52.0
	var logo_pref := 260.0 if tablet else 188.0
	var logo_w := minf(logo_pref, content_w)
	_logo.custom_minimum_size = Vector2(logo_w, logo_h)
	_logo.size_flags_horizontal = Control.SIZE_SHRINK_CENTER
	var brand := _logo.get_parent() as HBoxContainer
	if brand != null:
		brand.alignment = BoxContainer.ALIGNMENT_CENTER
		brand.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_corner_spacer.custom_minimum_size = Vector2(0, icon_s)
	_top_bar.custom_minimum_size = Vector2(0, icon_s + 8.0 + logo_h)
	var side := maxf(margins.x, margins.z)
	_plus_btn.offset_left = side
	_plus_btn.offset_right = side + icon_s
	_plus_btn.offset_top = margins.y
	_plus_btn.offset_bottom = margins.y + icon_s
	_settings_btn.offset_right = -side
	_settings_btn.offset_left = -(side + icon_s)
	_settings_btn.offset_top = margins.y
	_settings_btn.offset_bottom = margins.y + icon_s


func _wire_android_popups() -> void:
	if not Responsive.use_android_layout():
		return
	_bind_popup_clamp(_category_select)
	_bind_popup_clamp(_dev_menu)


func _bind_popup_clamp(dropdown: OptionButton) -> void:
	if dropdown == null or _popup_clamps.has(dropdown):
		return
	var popup := dropdown.get_popup()
	var callback := _on_android_popup_about_to_show.bind(dropdown)
	popup.about_to_popup.connect(callback)
	_popup_clamps[dropdown] = callback


func _on_android_popup_about_to_show(dropdown: OptionButton) -> void:
	_clamp_android_popup_soon(dropdown)


func _clamp_android_popup_soon(dropdown: OptionButton) -> void:
	await get_tree().process_frame
	_clamp_android_popup(dropdown)
	await get_tree().process_frame
	_clamp_android_popup(dropdown)


func _clamp_android_popup(dropdown: OptionButton) -> void:
	if not Responsive.use_android_layout() or not is_instance_valid(dropdown):
		return
	var popup := dropdown.get_popup()
	var margin := 12.0
	var view := get_viewport().get_visible_rect()
	var limit := Rect2(view.position + Vector2(margin, margin), view.size - Vector2(margin, margin) * 2.0)
	if limit.size.x < 1.0 or limit.size.y < 1.0:
		return
	var embedded := get_tree().root.gui_embed_subwindows
	var origin := Vector2.ZERO
	var to_view := Vector2.ONE
	var win := Vector2(DisplayServer.window_get_size())
	if not embedded:
		origin = Vector2(DisplayServer.window_get_position())
		if win.x < 1.0 or win.y < 1.0 or view.size.x < 1.0 or view.size.y < 1.0:
			return
		to_view = Vector2(view.size.x / win.x, view.size.y / win.y)
	var pos := (Vector2(popup.position) - origin) * to_view
	var sz := Vector2(popup.size) * to_view
	sz.x = minf(maxf(sz.x, 1.0), limit.size.x)
	sz.y = minf(maxf(sz.y, 1.0), limit.size.y)
	pos.x = clampf(pos.x, limit.position.x, limit.end.x - sz.x)
	pos.y = clampf(pos.y, limit.position.y, limit.end.y - sz.y)
	var from_view := Vector2(1.0 / to_view.x, 1.0 / to_view.y)
	popup.max_size = Vector2i(int(round(limit.size.x * from_view.x)), int(round(limit.size.y * from_view.y)))
	popup.size = Vector2i(int(round(sz.x * from_view.x)), int(round(sz.y * from_view.y)))
	popup.position = Vector2i(int(round(pos.x * from_view.x + origin.x)), int(round(pos.y * from_view.y + origin.y)))


func _style_filters(vs: Vector2) -> void:
	var is_tablet := Responsive.is_tablet(vs)
	var chip_h := CHIP_H_TABLET if is_tablet else CHIP_H_PHONE
	var chip_font := CHIP_FONT_TABLET if is_tablet else CHIP_FONT_PHONE
	_scope_scroll.custom_minimum_size = Vector2(0, chip_h + 4.0)
	_scope_row.custom_minimum_size = Vector2(0, chip_h + 4.0)
	_scope_row.alignment = BoxContainer.ALIGNMENT_CENTER
	_category_select.clip_text = true
	for id in _scope_chips.keys():
		var btn := _scope_chips[id] as Button
		btn.custom_minimum_size = Vector2(0, chip_h)
		btn.add_theme_font_size_override("font_size", chip_font)
		UiLook.style_chip(btn, id == _selected_scope)
	var drop_h := DROPDOWN_H_TABLET if is_tablet else DROPDOWN_H_PHONE
	var drop_font := DROPDOWN_FONT_TABLET if is_tablet else DROPDOWN_FONT_PHONE
	var popup_font := POPUP_FONT_TABLET if is_tablet else POPUP_FONT_PHONE
	UiLook.style_large_dropdown(_category_select, drop_h, drop_font, popup_font)
	var margins := Responsive.safe_outer_margins(Responsive.content_margins(vs))
	_fit_scope_pills(_content_width(vs, margins))
	_rebuild_play_again()


func _fit_scope_pills(content_w: float) -> void:
	## Shrink padding and type until every label fits. If a translation still
	## overflows, the row scrolls and a fade hides the clipped edge.
	var buttons: Array[Button] = []
	for id in _scope_chips.keys():
		var btn := _scope_chips[id] as Button
		if btn != null:
			buttons.append(btn)
	if buttons.is_empty() or content_w < 40.0:
		return
	var font := buttons[0].get_theme_font("font")
	if font == null:
		font = ThemeDB.fallback_font
	var font_size := CHIP_FONT_TABLET if Responsive.is_tablet(get_viewport_rect().size) else CHIP_FONT_PHONE
	var pad := 14
	var gap := float(_scope_row.get_theme_constant("separation"))
	if gap <= 0.0:
		gap = 8.0
	var guard := 0
	while guard < 24:
		guard += 1
		if _scope_row_width(buttons, font, font_size, pad, gap) <= content_w - 2.0:
			break
		if pad > 6:
			pad -= 2
		elif font_size > 12:
			font_size -= 1
		else:
			break
	for btn in buttons:
		btn.add_theme_font_size_override("font_size", font_size)
		btn.clip_text = false
		btn.text_overrun_behavior = TextServer.OVERRUN_NO_TRIMMING
		for state in ["normal", "hover", "pressed", "disabled", "focus"]:
			var style := btn.get_theme_stylebox(state)
			if style is StyleBoxFlat:
				var copy := (style as StyleBoxFlat).duplicate()
				copy.content_margin_left = pad
				copy.content_margin_right = pad
				btn.add_theme_stylebox_override(state, copy)
	var fitted := _scope_row_width(buttons, font, font_size, pad, gap) <= content_w - 2.0
	_scope_row.alignment = BoxContainer.ALIGNMENT_CENTER if fitted else BoxContainer.ALIGNMENT_BEGIN
	_scope_scroll.horizontal_scroll_mode = (
		ScrollContainer.SCROLL_MODE_DISABLED if fitted else ScrollContainer.SCROLL_MODE_AUTO
	)
	_place_scope_fade(not fitted)


func _scope_row_width(buttons: Array[Button], font: Font, font_size: int, pad: int, gap: float) -> float:
	var total := gap * float(maxi(buttons.size() - 1, 0))
	for btn in buttons:
		total += font.get_string_size(btn.text, HORIZONTAL_ALIGNMENT_LEFT, -1, font_size).x + float(pad * 2)
	return total


func _place_scope_fade(show: bool) -> void:
	if _scope_fade == null:
		_scope_fade = TextureRect.new()
		_scope_fade.name = "ScopeFade"
		_scope_fade.mouse_filter = Control.MOUSE_FILTER_IGNORE
		_scope_fade.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
		_scope_fade.stretch_mode = TextureRect.STRETCH_SCALE
		var grad := Gradient.new()
		grad.set_color(0, Color(0.05, 0.07, 0.10, 0.0))
		grad.set_color(1, Color(0.05, 0.07, 0.10, 0.92))
		var tex := GradientTexture2D.new()
		tex.gradient = grad
		tex.width = 32
		tex.height = 8
		tex.fill_from = Vector2(0, 0.5)
		tex.fill_to = Vector2(1, 0.5)
		_scope_fade.texture = tex
		_scope_fade.z_index = 4
		add_child(_scope_fade)
	_scope_fade.visible = show
	if not show:
		return
	var rect := _scope_scroll.get_global_rect()
	var xform := get_global_transform_with_canvas().affine_inverse()
	var origin := xform * rect.position
	var extent := xform * rect.end
	_scope_fade.position = Vector2(extent.x - 22.0, origin.y)
	_scope_fade.size = Vector2(22.0, maxf(extent.y - origin.y, 36.0))


func _clear_row(row: HBoxContainer) -> void:
	for child in row.get_children():
		child.queue_free()


func _make_chip(label: String, selected: bool) -> Button:
	var btn := Button.new()
	btn.text = label
	btn.focus_mode = Control.FOCUS_ALL
	btn.mouse_filter = Control.MOUSE_FILTER_STOP
	btn.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	UiLook.style_chip(btn, selected)
	return btn


func _rebuild_filters() -> void:
	_clear_row(_scope_row)
	_scope_chips.clear()
	if _scope_ids.find(_selected_scope) < 0:
		_selected_scope = "All"
	for id in _scope_ids:
		var btn := _make_chip(tr(id), id == _selected_scope)
		btn.pressed.connect(_on_scope_chip_pressed.bind(id))
		_scope_row.add_child(btn)
		_scope_chips[id] = btn

	_category_select.clear()
	_category_ids.clear()
	_category_ids.append("All")
	_category_select.add_item(tr("All categories"))
	for category in SoundCatalog.categories:
		_category_ids.append(category)
		_category_select.add_item(tr(category))
	if _category_ids.find(_selected_sound_category) < 0:
		_selected_sound_category = "All"
	var cat_idx := _category_ids.find(_selected_sound_category)
	_category_select.select(maxi(cat_idx, 0))
	_style_filters(get_viewport_rect().size)


func _on_scope_chip_pressed(id: String) -> void:
	if id == _selected_scope:
		return
	HapticsService.tap()
	_selected_scope = id
	LocalPrefs.last_scope = _selected_scope
	LocalPrefs.save_prefs()
	for sid in _scope_chips.keys():
		UiLook.style_chip(_scope_chips[sid] as Button, sid == _selected_scope)
	var vs := get_viewport_rect().size
	var margins := Responsive.safe_outer_margins(Responsive.content_margins(vs))
	_fit_scope_pills(_content_width(vs, margins))
	_refresh_grid()


func _on_category_item_selected(index: int) -> void:
	if index < 0 or index >= _category_ids.size():
		return
	_selected_sound_category = _category_ids[index]
	LocalPrefs.last_sound_category = _selected_sound_category
	LocalPrefs.save_prefs()
	HapticsService.tap()
	_refresh_grid()


func _refresh_grid() -> void:
	_grid_gen += 1
	var gen := _grid_gen
	for child in _grid.get_children():
		child.queue_free()
	## Let queue_free settle before adding a big batch (avoids one-frame spike).
	await get_tree().process_frame
	if gen != _grid_gen or not is_inside_tree():
		return
	var sounds := _filtered_sounds()
	var vs := get_viewport_rect().size
	var margins := Responsive.safe_outer_margins(Responsive.content_margins(vs))
	var content_w := _scroll.size.x
	if content_w < 8.0:
		content_w = _content_width(vs, margins)
	_last_columns = Responsive.grid_columns_for_width(content_w)
	_grid.columns = _last_columns
	var gap := 16 if Responsive.is_tablet(vs) else 12
	var tile_w := Responsive.tile_width(content_w, _last_columns, float(gap))
	_grid.custom_minimum_size = Vector2(0, 0)
	_grid.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_grid.add_theme_constant_override("h_separation", gap)
	_grid.add_theme_constant_override("v_separation", gap)

	var empty := sounds.is_empty()
	_empty_state.visible = empty
	_scroll.visible = not empty
	if empty:
		_empty_state.text = _empty_message()
		_emit_first_home_ready()
		return

	var i := 0
	for sound in sounds:
		if gen != _grid_gen:
			return
		var tile: Control = SOUND_TILE_SCENE.instantiate()
		_grid.add_child(tile)
		tile.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		tile.size_flags_stretch_ratio = 1.0
		tile.call("setup", sound)
		tile.custom_minimum_size = Vector2(0, tile.custom_minimum_size.y)
		tile.set_meta("tile_width", tile_w)
		tile.pressed.connect(_on_tile_pressed.bind(sound))
		i += 1
		## First batch paints under splash; then emit ready so splash can fade.
		if i == mini(TILE_BATCH, sounds.size()):
			_emit_first_home_ready()
		if i % TILE_BATCH == 0:
			await get_tree().process_frame
			if gen != _grid_gen or not is_inside_tree():
				return
	_emit_first_home_ready()


func _emit_first_home_ready() -> void:
	if _first_home_ready_emitted:
		return
	_first_home_ready_emitted = true
	home_content_ready.emit()


func _empty_message() -> String:
	match _selected_scope:
		"Favorites":
			return tr("No favorites yet.\nTap the heart on a sound to save it here.")
		"Recent":
			return tr("No recent sounds yet.\nPlay something and it will show up here.")
		"Free":
			return tr("No free sounds in this category.")
		_:
			return tr("No sounds in this filter.")


func _filtered_sounds() -> Array[Dictionary]:
	var sounds: Array[Dictionary] = []
	match _selected_scope:
		"Favorites":
			sounds = SoundCatalog.get_favorite_sounds(LocalPrefs.favorites)
		"Free":
			sounds = SoundCatalog.get_free_sounds()
		"Recent":
			sounds = SoundCatalog.get_sounds_by_ids(LocalPrefs.recent_sound_ids)
		_:
			sounds = SoundCatalog.get_all_sounds()
	if _selected_sound_category == "All":
		return sounds
	var filtered: Array[Dictionary] = []
	for sound in sounds:
		if str(sound.get("category", "")) == _selected_sound_category:
			filtered.append(sound)
	return filtered


func _build_library_banner() -> void:
	_library_label = Label.new()
	_library_label.name = "LibraryUnlock"
	_library_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_library_label.add_theme_font_size_override("font_size", 14)
	_library_label.add_theme_color_override("font_color", Color(0.55, 0.92, 0.82, 1))
	var vbox := _category_select.get_parent()
	vbox.add_child(_library_label)
	vbox.move_child(_library_label, _category_select.get_index() + 1)
	_refresh_library_banner()
	set_process(true)


func _process(_delta: float) -> void:
	if _library_label == null or not _library_label.visible:
		return
	var text := tr("Plus unlocked: %s left") % _library_clock()
	if _library_label.text != text:
		_library_label.text = text


func _refresh_library_banner() -> void:
	if _library_label == null:
		return
	var on := Entitlements.is_library_unlocked()
	_library_label.visible = on
	if on:
		_library_label.text = tr("Plus unlocked: %s left") % _library_clock()


func _library_clock() -> String:
	var left := Entitlements.library_unlock_seconds_left()
	return "%d:%02d" % [int(left / 60), left % 60]


func _on_home_visibility_changed() -> void:
	if visible:
		_rebuild_play_again()


func _build_play_again() -> void:
	_play_again_column = VBoxContainer.new()
	_play_again_column.name = "PlayAgain"
	_play_again_column.add_theme_constant_override("separation", 6)
	_play_again_column.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_play_again_caption = Label.new()
	_play_again_caption.name = "PlayAgainCaption"
	_play_again_caption.text = tr("Play again")
	_play_again_caption.clip_text = false
	_play_again_caption.autowrap_mode = TextServer.AUTOWRAP_OFF
	_play_again_caption.text_overrun_behavior = TextServer.OVERRUN_NO_TRIMMING
	_play_again_caption.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_play_again_caption.custom_minimum_size = Vector2(0, 26)
	_play_again_caption.add_theme_font_size_override("font_size", 17)
	_play_again_caption.add_theme_color_override("font_color", Color(0.98, 0.94, 0.92, 1))
	_play_again_column.add_child(_play_again_caption)
	_play_again_scroll = ScrollContainer.new()
	_play_again_scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_AUTO
	_play_again_scroll.vertical_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	_play_again_scroll.scroll_deadzone = 24
	_play_again_scroll.clip_contents = true
	_play_again_scroll.custom_minimum_size = Vector2(0, 0)
	_play_again_scroll.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_play_again_box = HBoxContainer.new()
	_play_again_box.add_theme_constant_override("separation", 8)
	_play_again_scroll.add_child(_play_again_box)
	_play_again_column.add_child(_play_again_scroll)
	var vbox := _category_select.get_parent()
	vbox.add_child(_play_again_column)
	vbox.move_child(_play_again_column, _category_select.get_index() + 1)
	_hide_scroll_bar(_play_again_scroll.get_h_scroll_bar())
	_hide_scroll_bar(_play_again_scroll.get_v_scroll_bar())
	_rebuild_play_again()


func _play_again_ok(sound: Dictionary) -> bool:
	return not sound.is_empty() and SoundCatalog.is_sound_unlocked(sound)


func _rebuild_play_again() -> void:
	if _play_again_box == null or _play_again_column == null:
		return
	for child in _play_again_box.get_children():
		_play_again_box.remove_child(child)
		child.queue_free()
	var entries: Array[Dictionary] = []
	var used := {}
	var recents: Array[String] = LocalPrefs.recent_sound_ids
	if not recents.is_empty():
		var last := SoundCatalog.get_sound_by_id(recents[0])
		if _play_again_ok(last):
			entries.append({"sound": last, "slot": "last"})
			used[recents[0]] = true
	if LocalPrefs.favorites.is_empty():
		var recent_added := 0
		for recent_id in recents:
			if used.has(recent_id) or recent_added >= 7:
				continue
			var recent_sound := SoundCatalog.get_sound_by_id(recent_id)
			if not _play_again_ok(recent_sound):
				continue
			entries.append({"sound": recent_sound, "slot": "recent"})
			used[recent_id] = true
			recent_added += 1
	else:
		var ordered: Array[String] = []
		for recent_id in recents:
			if recent_id in LocalPrefs.favorites and not used.has(recent_id):
				ordered.append(recent_id)
		for i in range(LocalPrefs.favorites.size() - 1, -1, -1):
			var fav_id := LocalPrefs.favorites[i]
			if not used.has(fav_id) and ordered.find(fav_id) < 0:
				ordered.append(fav_id)
		var fav_added := 0
		for fav_id in ordered:
			if fav_added >= 7:
				break
			var fav_sound := SoundCatalog.get_sound_by_id(fav_id)
			if not _play_again_ok(fav_sound):
				continue
			entries.append({"sound": fav_sound, "slot": "favorite"})
			used[fav_id] = true
			fav_added += 1
	if entries.is_empty():
		_play_again_column.visible = false
		return
	_play_again_column.visible = true
	_play_again_caption.text = tr("Play again")
	var vs := get_viewport_rect().size
	var is_tablet := Responsive.is_tablet(vs)
	var margins := Responsive.safe_outer_margins(Responsive.content_margins(vs))
	var content_w := _content_width(vs, margins)
	var row_w := _play_again_scroll.size.x
	if row_w < 40.0:
		row_w = content_w
	## Two full cards stay on screen. Further recents scroll at the same width.
	var visible := 2.15 if entries.size() > 2 else 2.0
	var slot_w := floorf((row_w - 8.0) / visible)
	var narrow := content_w < 340.0
	var chip_h := PLAY_AGAIN_THUMB + (16.0 if narrow else 12.0)
	var font_size := 12 if narrow else (15 if is_tablet else 14)
	var position := 0
	for entry in entries:
		var sound: Dictionary = entry["sound"]
		var slot := str(entry["slot"])
		var sound_name := tr(str(sound.get("name", "")))
		var btn := _make_sound_shortcut(sound, sound_name, font_size, chip_h, slot_w, narrow)
		btn.pressed.connect(_on_play_again_pressed.bind(sound, slot, position))
		_play_again_box.add_child(btn)
		position += 1
	_play_again_scroll.custom_minimum_size = Vector2(0, chip_h + 4.0)


func _thumb_material() -> ShaderMaterial:
	if _shared_thumb_mat == null:
		_shared_thumb_mat = ShaderMaterial.new()
		_shared_thumb_mat.shader = _ROUNDED_THUMB
	return _shared_thumb_mat


func _make_sound_shortcut(sound: Dictionary, sound_name: String, font_size: int, chip_h: float, slot_w: float, narrow: bool) -> Button:
	var btn := Button.new()
	btn.text = ""
	btn.tooltip_text = tr("Play %s") % sound_name
	btn.focus_mode = Control.FOCUS_ALL
	btn.mouse_filter = Control.MOUSE_FILTER_STOP
	btn.clip_contents = true
	UiLook.style_sound_shortcut(btn)
	var row := HBoxContainer.new()
	row.mouse_filter = Control.MOUSE_FILTER_IGNORE
	row.alignment = BoxContainer.ALIGNMENT_CENTER
	row.add_theme_constant_override("separation", 8)
	row.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	row.offset_left = 6
	row.offset_top = 6
	row.offset_right = -8
	row.offset_bottom = -6
	var frame := Control.new()
	frame.mouse_filter = Control.MOUSE_FILTER_IGNORE
	frame.custom_minimum_size = Vector2(PLAY_AGAIN_THUMB, PLAY_AGAIN_THUMB)
	frame.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	var art := TextureRect.new()
	art.mouse_filter = Control.MOUSE_FILTER_IGNORE
	art.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	art.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	art.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	art.texture = UiLook.load_tex(str(sound.get("art", "")))
	art.material = _thumb_material().duplicate()
	frame.add_child(art)
	var play := TextureRect.new()
	play.mouse_filter = Control.MOUSE_FILTER_IGNORE
	play.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	play.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	play.texture = UiLook.load_tex(PLAY_BADGE)
	play.set_anchors_preset(Control.PRESET_BOTTOM_RIGHT)
	play.offset_left = -22
	play.offset_top = -22
	play.offset_right = -1
	play.offset_bottom = -1
	frame.add_child(play)
	row.add_child(frame)
	var name := Label.new()
	name.mouse_filter = Control.MOUSE_FILTER_IGNORE
	name.text = sound_name
	name.clip_text = true
	name.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART if narrow else TextServer.AUTOWRAP_OFF
	name.max_lines_visible = 2 if narrow else 1
	name.text_overrun_behavior = TextServer.OVERRUN_TRIM_ELLIPSIS
	name.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	name.horizontal_alignment = HORIZONTAL_ALIGNMENT_LEFT
	name.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	name.size_flags_vertical = Control.SIZE_EXPAND_FILL
	name.add_theme_font_size_override("font_size", font_size)
	name.add_theme_color_override("font_color", Color(0.98, 0.96, 0.95, 1))
	row.add_child(name)
	btn.add_child(row)
	btn.custom_minimum_size = Vector2(slot_w, chip_h)
	btn.size_flags_horizontal = Control.SIZE_SHRINK_BEGIN
	btn.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	return btn


func _on_play_again_pressed(sound: Dictionary, slot: String, position: int) -> void:
	HapticsService.tap()
	AnalyticsService.log_event("play_again_tap", {
		"sound_id": str(sound.get("id", "")),
		"slot": slot,
		"position": position,
	})
	get_tree().get_first_node_in_group("main_nav").call("show_player", sound)


func _on_tile_pressed(sound: Dictionary) -> void:
	HapticsService.tap()
	get_tree().get_first_node_in_group("main_nav").call("show_player", sound)


func _on_settings_pressed() -> void:
	get_tree().get_first_node_in_group("main_nav").call("show_settings")


func _on_plus_pressed() -> void:
	if Entitlements.has_plus():
		return
	get_tree().get_first_node_in_group("main_nav").call("show_paywall")
