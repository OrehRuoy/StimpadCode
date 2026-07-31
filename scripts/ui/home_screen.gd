extends Control

const SOUND_TILE_SCENE := preload("res://scenes/ui/sound_tile.tscn")

@onready var _category_row: HBoxContainer = $Margin/VBox/CategoryRow
@onready var _grid: GridContainer = $Margin/VBox/Scroll/Grid
@onready var _favorites_only: CheckButton = $Margin/VBox/TopBar/FavoritesOnly
@onready var _settings_btn: Button = $Margin/VBox/TopBar/SettingsBtn
@onready var _plus_btn: Button = $Margin/VBox/TopBar/PlusBtn
@onready var _logo: TextureRect = $Margin/VBox/TopBar/Logo

var _selected_category: String = "All"
var _category_buttons: Dictionary = {}


func _ready() -> void:
	_selected_category = LocalPrefs.last_category
	_settings_btn.pressed.connect(_on_settings_pressed)
	_plus_btn.pressed.connect(_on_plus_pressed)
	_favorites_only.toggled.connect(_on_favorites_toggled)
	Entitlements.plus_changed.connect(func(_v): _refresh_grid())
	SoundCatalog.catalog_loaded.connect(_build_categories)
	SoundCatalog.catalog_loaded.connect(_refresh_grid)
	if SoundCatalog.sounds.size() > 0:
		_build_categories()
		_refresh_grid()
	if ResourceLoader.exists("res://assets/branding/logo_wordmark.png"):
		_logo.texture = load("res://assets/branding/logo_wordmark.png")


func _build_categories() -> void:
	for child in _category_row.get_children():
		child.queue_free()
	_category_buttons.clear()
	_add_category_button("All")
	_add_category_button("Favorites")
	for category in SoundCatalog.categories:
		_add_category_button(category)


func _add_category_button(label: String) -> void:
	var btn := Button.new()
	btn.text = label
	btn.toggle_mode = true
	btn.button_pressed = label == _selected_category
	btn.pressed.connect(_on_category_selected.bind(label))
	_category_row.add_child(btn)
	_category_buttons[label] = btn


func _on_category_selected(category: String) -> void:
	_selected_category = category
	LocalPrefs.last_category = category
	LocalPrefs.save_prefs()
	for key in _category_buttons:
		_category_buttons[key].button_pressed = key == category
	_favorites_only.button_pressed = category == "Favorites"
	_refresh_grid()


func _on_favorites_toggled(on: bool) -> void:
	if on:
		_on_category_selected("Favorites")
	else:
		_on_category_selected("All")


func _refresh_grid() -> void:
	for child in _grid.get_children():
		child.queue_free()
	var sounds: Array[Dictionary] = []
	if _selected_category == "Favorites":
		sounds = SoundCatalog.get_favorite_sounds(LocalPrefs.favorites)
	elif _selected_category == "All":
		sounds = SoundCatalog.get_all_sounds()
	else:
		sounds = SoundCatalog.get_sounds_for_category(_selected_category)
	var columns := 2 if get_viewport_rect().size.x < 700 else 3
	if get_viewport_rect().size.x >= 1000:
		columns = 4
	_grid.columns = columns
	for sound in sounds:
		var tile: Control = SOUND_TILE_SCENE.instantiate()
		_grid.add_child(tile)
		tile.call("setup", sound)
		tile.pressed.connect(_on_tile_pressed.bind(sound))


func _on_tile_pressed(sound: Dictionary) -> void:
	get_tree().get_first_node_in_group("main_nav").call("show_player", sound)


func _on_settings_pressed() -> void:
	get_tree().get_first_node_in_group("main_nav").call("show_settings")


func _on_plus_pressed() -> void:
	if Entitlements.has_plus():
		return
	get_tree().get_first_node_in_group("main_nav").call("show_paywall")
