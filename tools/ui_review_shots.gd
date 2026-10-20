extends SceneTree

## Review shots for the home screen with a sound playing.
## STIMPAD_SHOT_DIR selects the output folder under res://build/ui-review/.

const SIZES: Array[Dictionary] = [
	{"name": "ios-1179x2556", "size": Vector2i(1179, 2556), "android": false, "inset": Vector4(0, 132, 0, 102)},
	{"name": "ios-750x1334", "size": Vector2i(750, 1334), "android": false, "inset": Vector4(0, 40, 0, 0)},
	{"name": "android-1080x2400", "size": Vector2i(1080, 2400), "android": true, "inset": Vector4(96, 120, 0, 64)},
	{"name": "android-720x1680", "size": Vector2i(720, 1680), "android": true, "inset": Vector4(72, 96, 0, 144)},
]


func _init() -> void:
	process_frame.connect(_run, CONNECT_ONE_SHOT)


func _run() -> void:
	var folder := OS.get_environment("STIMPAD_SHOT_DIR")
	if folder.is_empty():
		folder = "before"
	var prefs := root.get_node("LocalPrefs")
	prefs.session_duration_sec = 0
	prefs.last_scope = "All"
	var existing: Array = prefs.favorites.duplicate()
	for fav_id in existing:
		prefs.call("toggle_favorite", str(fav_id))
	for fav_id in ["fire_whistle", "police_siren", "school_bell"]:
		if not bool(prefs.call("is_favorite", fav_id)):
			prefs.call("toggle_favorite", fav_id)
	for recent_id in ["school_bell", "police_siren", "fire_whistle", "fan_hum"]:
		prefs.call("note_recent_sound", recent_id)
	var failures: PackedStringArray = []
	for spec in SIZES:
		var err := await _capture_size(spec, folder)
		if err != "":
			failures.append(err)
	if failures.is_empty():
		print("UI_REVIEW_OK ", folder)
		quit(0)
	else:
		for line in failures:
			print("UI_REVIEW_FAIL ", line)
		quit(1)


func _capture_size(spec: Dictionary, folder: String) -> String:
	var size: Vector2i = spec["size"]
	var tag: String = str(spec["name"])
	var prefs := root.get_node("LocalPrefs")
	prefs.last_scope = "All"
	prefs.last_sound_category = "All"
	Responsive.force_android_layout = bool(spec["android"])
	Responsive.test_insets_enabled = true
	Responsive.test_inset_px = spec["inset"]
	_apply_size(size)
	change_scene_to_file("res://scenes/main.tscn")
	var home: Node = null
	var boot: CanvasItem = null
	for _i in 800:
		await process_frame
		_apply_size(size)
		if home == null:
			home = root.find_child("HomeScreen", true, false)
		if boot == null:
			boot = root.find_child("BootOverlay", true, false) as CanvasItem
		if home != null and boot != null and not boot.visible:
			break
	if home == null or boot == null or boot.visible:
		return "%s boot failed" % tag
	var dev := home.get_node_or_null("Margin/VBox/DevMenu")
	if dev is CanvasItem:
		(dev as CanvasItem).visible = false
	for _j in 8:
		await process_frame
		_apply_size(size)
	var catalog := root.get_node("SoundCatalog")
	var audio := root.get_node("AudioController")
	var sound: Dictionary = catalog.call("get_sound_by_id", "fan_hum")
	if sound.is_empty():
		return "%s missing fan_hum" % tag
	audio.call("set_session_duration", 0)
	audio.call("play_sound", sound)
	for _k in 45:
		await process_frame
	if not bool(audio.call("is_playing")):
		return "%s sound did not stay playing" % tag
	var all_err := await _save_view(folder, "%s-all.png" % tag)
	if all_err != "":
		return "%s all %s" % [tag, all_err]
	_print_layout(tag, "all")
	if home.has_method("_on_scope_chip_pressed"):
		home.call("_on_scope_chip_pressed", "Favorites")
	for _n in 30:
		await process_frame
	var fav_err := await _save_view(folder, "%s-favorites.png" % tag)
	if fav_err != "":
		return "%s favorites %s" % [tag, fav_err]
	_print_layout(tag, "favorites")
	root.get_node("AudioController").call("stop")
	return ""


func _print_layout(tag: String, scope: String) -> void:
	var home := root.find_child("HomeScreen", true, false)
	var view := root.get_visible_rect().size
	var plus := home.get_node_or_null("PlusBtn") as Control
	var gear := home.get_node_or_null("SettingsBtn") as Control
	var logo := home.find_child("Logo", true, false) as Control
	var caption := home.find_child("PlayAgainCaption", true, false) as Control
	var now := root.find_child("NowPlaying", true, false) as Control
	var logo_cx := -1.0
	if logo != null:
		logo_cx = logo.get_global_rect().get_center().x
	var cap := ""
	if caption is Label:
		cap = (caption as Label).text
	print(
		"LAYOUT ", tag, " ", scope,
		" view=", view,
		" plus_l=", plus.position.x if plus else -1,
		" gear_r=", (gear.position.x + gear.size.x) if gear else -1,
		" logo_cx=", snappedf(logo_cx, 0.1),
		" mid=", snappedf(view.x * 0.5, 0.1),
		" caption=", cap,
		" caption_w=", caption.size.x if caption else -1,
		" now=", now.get_global_rect() if now else Rect2(),
		" now_vis=", now.visible if now else false
	)


func _save_view(folder: String, file_name: String) -> String:
	await RenderingServer.frame_post_draw
	var tex := root.get_texture()
	if tex == null:
		return "no texture"
	var img := tex.get_image()
	if img == null:
		return "no image"
	var dir := ProjectSettings.globalize_path("res://build/ui-review/%s" % folder)
	DirAccess.make_dir_recursive_absolute(dir)
	var err := img.save_png(dir.path_join(file_name))
	if err != OK:
		return "save %d" % err
	print("SHOT ", folder, "/", file_name, " ", img.get_width(), "x", img.get_height())
	return ""


func _apply_size(size: Vector2i) -> void:
	root.mode = Window.MODE_WINDOWED
	root.borderless = true
	root.content_scale_mode = Window.CONTENT_SCALE_MODE_CANVAS_ITEMS
	root.content_scale_aspect = Window.CONTENT_SCALE_ASPECT_EXPAND
	root.position = Vector2i(20, 20)
	root.size = size
	DisplayServer.window_set_size(size)
