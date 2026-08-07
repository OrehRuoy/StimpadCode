extends Control

const SOUND_TILE_SCENE := preload("res://scenes/ui/sound_tile.tscn")
const PLUS_ICON := "res://assets/ui/icon_plus_badge.png"
const SETTINGS_ICON := "res://assets/ui/icon_settings_gear.png"

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
@onready var _settings_btn: Button = $Margin/VBox/TopBar/RightCluster/SettingsBtn
@onready var _plus_btn: Button = $Margin/VBox/TopBar/RightCluster/PlusBtn
@onready var _logo: TextureRect = $Margin/VBox/TopBar/Logo
@onready var _top_bar: HBoxContainer = $Margin/VBox/TopBar
@onready var _left_balance: Control = $Margin/VBox/TopBar/LeftBalance
@onready var _right_cluster: HBoxContainer = $Margin/VBox/TopBar/RightCluster
@onready var _scope_row: HBoxContainer = $Margin/VBox/ScopeRow
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
var _syncing_dev_menu: bool = false

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
	SoundCatalog.catalog_loaded.connect(_rebuild_filters)
	SoundCatalog.catalog_loaded.connect(_refresh_grid)
	resized.connect(_apply_responsive_layout)
	get_viewport().size_changed.connect(_apply_responsive_layout)
	if ResourceLoader.exists("res://assets/branding/logo_wordmark.png"):
		_logo.texture = load("res://assets/branding/logo_wordmark.png")
	_style_top_buttons()
	_setup_dev_menu()
	_refresh_features_banner()
	_scroll.scroll_deadzone = 8
	_scroll.vertical_scroll_mode = ScrollContainer.SCROLL_MODE_SHOW_NEVER
	_hide_scroll_bar(_scroll.get_v_scroll_bar())
	_rebuild_filters()
	_apply_responsive_layout()
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
	_balance_top_bar()
	_refresh_grid()


func _apply_responsive_layout() -> void:
	var vs := get_viewport_rect().size
	var margins := Responsive.safe_outer_margins(Responsive.content_margins(vs))
	_margin.add_theme_constant_override("margin_left", int(margins.x))
	_margin.add_theme_constant_override("margin_top", int(margins.y))
	_margin.add_theme_constant_override("margin_right", int(margins.z))
	_margin.add_theme_constant_override("margin_bottom", int(margins.w))
	_logo.custom_minimum_size = Responsive.logo_min_size(vs)
	var icon_s := 56.0 if Responsive.is_tablet(vs) else 48.0
	_plus_btn.custom_minimum_size = Vector2(icon_s, icon_s)
	_settings_btn.custom_minimum_size = Vector2(icon_s, icon_s)
	_top_bar.custom_minimum_size = Vector2(0, icon_s + 12.0)
	_balance_top_bar()
	_style_filters(vs)
	var columns := Responsive.grid_columns(vs)
	if columns != _last_columns and _grid.get_child_count() > 0:
		_refresh_grid()
	elif _last_columns < 0:
		_last_columns = columns


func _balance_top_bar() -> void:
	## Match left spacer to right icon cluster so the logo is optically screen-centered.
	await get_tree().process_frame
	if not is_instance_valid(_right_cluster) or not is_instance_valid(_left_balance):
		return
	var right_w := _right_cluster.get_combined_minimum_size().x
	if right_w < 1.0:
		right_w = _settings_btn.custom_minimum_size.x
		if _plus_btn.visible:
			right_w += _plus_btn.custom_minimum_size.x + 10.0
	_left_balance.custom_minimum_size = Vector2(right_w, 0)


func _style_filters(vs: Vector2) -> void:
	var is_tablet := Responsive.is_tablet(vs)
	var chip_h := CHIP_H_TABLET if is_tablet else CHIP_H_PHONE
	var chip_font := CHIP_FONT_TABLET if is_tablet else CHIP_FONT_PHONE
	_scope_row.custom_minimum_size = Vector2(0, chip_h + 4.0)
	_scope_row.alignment = BoxContainer.ALIGNMENT_CENTER
	for id in _scope_chips.keys():
		var btn := _scope_chips[id] as Button
		btn.custom_minimum_size = Vector2(0, chip_h)
		btn.add_theme_font_size_override("font_size", chip_font)
		UiLook.style_chip(btn, id == _selected_scope)
	var drop_h := DROPDOWN_H_TABLET if is_tablet else DROPDOWN_H_PHONE
	var drop_font := DROPDOWN_FONT_TABLET if is_tablet else DROPDOWN_FONT_PHONE
	var popup_font := POPUP_FONT_TABLET if is_tablet else POPUP_FONT_PHONE
	UiLook.style_large_dropdown(_category_select, drop_h, drop_font, popup_font)


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
		var btn := _make_chip(id, id == _selected_scope)
		btn.pressed.connect(_on_scope_chip_pressed.bind(id))
		_scope_row.add_child(btn)
		_scope_chips[id] = btn

	_category_select.clear()
	_category_ids.clear()
	_category_ids.append("All")
	_category_select.add_item("All categories")
	for category in SoundCatalog.categories:
		_category_ids.append(category)
		_category_select.add_item(category)
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
	for child in _grid.get_children():
		child.queue_free()
	var sounds := _filtered_sounds()
	_last_columns = Responsive.grid_columns(get_viewport_rect().size)
	_grid.columns = _last_columns
	var gap := 16 if Responsive.is_tablet(get_viewport_rect().size) else 12
	_grid.add_theme_constant_override("h_separation", gap)
	_grid.add_theme_constant_override("v_separation", gap)

	var empty := sounds.is_empty()
	_empty_state.visible = empty
	_scroll.visible = not empty
	if empty:
		_empty_state.text = _empty_message()
		return

	for sound in sounds:
		var tile: Control = SOUND_TILE_SCENE.instantiate()
		_grid.add_child(tile)
		tile.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		tile.size_flags_stretch_ratio = 1.0
		tile.call("setup", sound)
		tile.pressed.connect(_on_tile_pressed.bind(sound))


func _empty_message() -> String:
	match _selected_scope:
		"Favorites":
			return "No favorites yet.\nTap the heart on a sound to save it here."
		"Recent":
			return "No recent sounds yet.\nPlay something and it will show up here."
		"Free":
			return "No free sounds in this category."
		_:
			return "No sounds in this filter."


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


func _on_tile_pressed(sound: Dictionary) -> void:
	HapticsService.tap()
	get_tree().get_first_node_in_group("main_nav").call("show_player", sound)


func _on_settings_pressed() -> void:
	get_tree().get_first_node_in_group("main_nav").call("show_settings")


func _on_plus_pressed() -> void:
	if Entitlements.has_plus():
		return
	get_tree().get_first_node_in_group("main_nav").call("show_paywall")
