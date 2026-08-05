extends Control

const SOUND_TILE_SCENE := preload("res://scenes/ui/sound_tile.tscn")
const PLUS_ICON := "res://assets/ui/icon_plus_badge.png"
const SETTINGS_ICON := "res://assets/ui/icon_settings_gear.png"

## Large touch targets for motor / accessibility needs (44pt min; we use 56–64).
const DROPDOWN_H_PHONE := 58.0
const DROPDOWN_H_TABLET := 68.0
const DROPDOWN_FONT_PHONE := 18
const DROPDOWN_FONT_TABLET := 22
const POPUP_FONT_PHONE := 20
const POPUP_FONT_TABLET := 24

@onready var _margin: MarginContainer = $Margin
@onready var _grid: GridContainer = $Margin/VBox/Scroll/Grid
@onready var _scroll: ScrollContainer = $Margin/VBox/Scroll
@onready var _settings_btn: Button = $Margin/VBox/TopBar/SettingsBtn
@onready var _plus_btn: Button = $Margin/VBox/TopBar/PlusBtn
@onready var _logo: TextureRect = $Margin/VBox/TopBar/Logo
@onready var _top_bar: HBoxContainer = $Margin/VBox/TopBar
@onready var _scope_select: OptionButton = $Margin/VBox/ScopeSelect
@onready var _category_select: OptionButton = $Margin/VBox/CategorySelect
@onready var _dev_plus_toggle: CheckButton = $Margin/VBox/DevPlusToggle

var _selected_scope: String = "All"
var _selected_sound_category: String = "All"
var _last_columns: int = -1
var _scope_ids: Array[String] = ["All", "Free", "Favorites"]
var _category_ids: Array[String] = []
var _syncing_dev_toggle: bool = false


func _ready() -> void:
	_selected_scope = LocalPrefs.last_scope
	_selected_sound_category = LocalPrefs.last_sound_category
	_settings_btn.pressed.connect(_on_settings_pressed)
	_plus_btn.pressed.connect(_on_plus_pressed)
	_scope_select.item_selected.connect(_on_scope_item_selected)
	_category_select.item_selected.connect(_on_category_item_selected)
	Entitlements.plus_changed.connect(func(_v): _refresh_grid())
	Entitlements.temp_unlocks_changed.connect(_refresh_grid)
	SoundCatalog.catalog_loaded.connect(_rebuild_dropdowns)
	SoundCatalog.catalog_loaded.connect(_refresh_grid)
	resized.connect(_apply_responsive_layout)
	get_viewport().size_changed.connect(_apply_responsive_layout)
	if ResourceLoader.exists("res://assets/branding/logo_wordmark.png"):
		_logo.texture = load("res://assets/branding/logo_wordmark.png")
	_style_top_buttons()
	_setup_dev_plus_toggle()
	_scroll.scroll_deadzone = 8
	_rebuild_dropdowns()
	_apply_responsive_layout()
	if SoundCatalog.sounds.size() > 0:
		_refresh_grid()


func _setup_dev_plus_toggle() -> void:
	## Editor / debug builds only — hide from release store builds.
	var show_toggle := OS.is_debug_build()
	_dev_plus_toggle.visible = show_toggle
	if not show_toggle:
		return
	_dev_plus_toggle.button_pressed = Entitlements.has_plus()
	_dev_plus_toggle.toggled.connect(_on_dev_plus_toggled)
	Entitlements.plus_changed.connect(_sync_dev_plus_toggle)
	UiLook.style_secondary_slate(_dev_plus_toggle)
	_dev_plus_toggle.add_theme_font_size_override("font_size", 15)


func _sync_dev_plus_toggle(is_plus: bool) -> void:
	if not _dev_plus_toggle.visible:
		return
	_syncing_dev_toggle = true
	_dev_plus_toggle.button_pressed = is_plus
	_syncing_dev_toggle = false


func _on_dev_plus_toggled(enabled: bool) -> void:
	if _syncing_dev_toggle:
		return
	Entitlements.set_plus_for_debug(enabled)


func _style_top_buttons() -> void:
	UiLook.style_icon_button(_plus_btn, PLUS_ICON, true)
	UiLook.style_icon_button(_settings_btn, SETTINGS_ICON, true)
	_plus_btn.visible = not Entitlements.has_plus()
	Entitlements.plus_changed.connect(func(is_plus: bool): _plus_btn.visible = not is_plus)


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
	_style_large_dropdowns(vs)
	var columns := Responsive.grid_columns(vs)
	if columns != _last_columns and _grid.get_child_count() > 0:
		_refresh_grid()
	elif _last_columns < 0:
		_last_columns = columns


func _style_large_dropdowns(vs: Vector2) -> void:
	var is_tablet := Responsive.is_tablet(vs)
	var h := DROPDOWN_H_TABLET if is_tablet else DROPDOWN_H_PHONE
	var font_size := DROPDOWN_FONT_TABLET if is_tablet else DROPDOWN_FONT_PHONE
	var popup_font := POPUP_FONT_TABLET if is_tablet else POPUP_FONT_PHONE
	for dropdown in [_scope_select, _category_select]:
		UiLook.style_large_dropdown(dropdown, h, font_size, popup_font)


func _rebuild_dropdowns() -> void:
	_scope_select.clear()
	_scope_select.add_item("Show: All")
	_scope_select.add_item("Show: Free")
	_scope_select.add_item("Show: Favorites")
	var scope_idx := _scope_ids.find(_selected_scope)
	if scope_idx < 0:
		scope_idx = 0
		_selected_scope = "All"
	_scope_select.select(scope_idx)

	_category_select.clear()
	_category_ids.clear()
	_category_ids.append("All")
	_category_select.add_item("Category: All")
	for category in SoundCatalog.categories:
		_category_ids.append(category)
		_category_select.add_item("Category: %s" % category)
	var cat_idx := _category_ids.find(_selected_sound_category)
	if cat_idx < 0:
		cat_idx = 0
		_selected_sound_category = "All"
	_category_select.select(cat_idx)
	_style_large_dropdowns(get_viewport_rect().size)


func _on_scope_item_selected(index: int) -> void:
	if index < 0 or index >= _scope_ids.size():
		return
	_selected_scope = _scope_ids[index]
	LocalPrefs.last_scope = _selected_scope
	LocalPrefs.save_prefs()
	_refresh_grid()


func _on_category_item_selected(index: int) -> void:
	if index < 0 or index >= _category_ids.size():
		return
	_selected_sound_category = _category_ids[index]
	LocalPrefs.last_sound_category = _selected_sound_category
	LocalPrefs.save_prefs()
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
	for sound in sounds:
		var tile: Control = SOUND_TILE_SCENE.instantiate()
		_grid.add_child(tile)
		tile.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		tile.size_flags_stretch_ratio = 1.0
		tile.call("setup", sound)
		tile.pressed.connect(_on_tile_pressed.bind(sound))


func _filtered_sounds() -> Array[Dictionary]:
	var sounds: Array[Dictionary] = []
	match _selected_scope:
		"Favorites":
			sounds = SoundCatalog.get_favorite_sounds(LocalPrefs.favorites)
		"Free":
			sounds = SoundCatalog.get_free_sounds()
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
	get_tree().get_first_node_in_group("main_nav").call("show_player", sound)


func _on_settings_pressed() -> void:
	get_tree().get_first_node_in_group("main_nav").call("show_settings")


func _on_plus_pressed() -> void:
	if Entitlements.has_plus():
		return
	get_tree().get_first_node_in_group("main_nav").call("show_paywall")
