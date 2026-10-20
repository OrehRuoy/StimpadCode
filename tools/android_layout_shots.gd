extends SceneTree

## Boots the home screen at phone sizes and checks Android centering.
## iPhone size runs with the Android layout flag off and must match the
## pre-change screenshot at build/layout-shots/iphone-baseline.png.

const OUT_DIR := "res://build/layout-shots"
const BASELINE_NAME := "iphone-baseline.png"
const IPHONE := Vector2i(1206, 2622)
const ANDROID_SIZES: Array[Vector2i] = [
	Vector2i(1080, 2400),
	Vector2i(1080, 2340),
	Vector2i(720, 1600),
	Vector2i(1440, 3200),
	Vector2i(1600, 2560),
]
const SAMPLE_INSETS := Vector4(96, 120, 0, 64)
const POPUP_MARGIN := 12.0
const LOGO_TOLERANCE := 4.0


func _init() -> void:
	process_frame.connect(_run, CONNECT_ONE_SHOT)


func _run() -> void:
	var failures: PackedStringArray = []
	Responsive.force_android_layout = false
	Responsive.test_insets_enabled = false
	Responsive.test_inset_px = Vector4.ZERO
	var iphone_img := await _boot_and_capture(IPHONE, false)
	if iphone_img == null:
		failures.append("iphone capture failed")
	else:
		var iphone_err := _save(iphone_img, "iphone.png")
		if iphone_err != OK:
			failures.append("iphone save err %d" % iphone_err)
		var match_err := _matches_baseline(iphone_img)
		if match_err != "":
			failures.append(match_err)
		else:
			print("IPHONE_MATCH %dx%d" % [iphone_img.get_width(), iphone_img.get_height()])
	for size in ANDROID_SIZES:
		Responsive.force_android_layout = true
		Responsive.test_insets_enabled = true
		Responsive.test_inset_px = SAMPLE_INSETS
		var img := await _boot_and_capture(size, true)
		var tag := "%dx%d" % [size.x, size.y]
		if img == null:
			failures.append("%s capture failed" % tag)
			continue
		var save_err := _save(img, "android-%s.png" % tag)
		if save_err != OK:
			failures.append("%s save err %d" % [tag, save_err])
		var layout_err := _assert_home(tag)
		if layout_err != "":
			failures.append(layout_err)
		var popup_err := await _assert_popups(tag)
		if popup_err != "":
			failures.append(popup_err)
	if failures.is_empty():
		print("LAYOUT_SHOTS_OK")
		quit(0)
	else:
		for line in failures:
			print("LAYOUT_FAIL ", line)
		quit(1)


func _boot_and_capture(size: Vector2i, settle_android: bool) -> Image:
	_apply_size(size)
	change_scene_to_file("res://scenes/main.tscn")
	var home: Node = null
	var boot: CanvasItem = null
	for _i in 600:
		await process_frame
		_apply_size(size)
		if home == null:
			home = root.find_child("HomeScreen", true, false)
		if boot == null:
			boot = root.find_child("BootOverlay", true, false) as CanvasItem
		if home != null and boot != null and not boot.visible:
			break
	for _j in 12:
		await process_frame
		_apply_size(size)
	if settle_android:
		for _k in 6:
			await process_frame
	await RenderingServer.frame_post_draw
	var tex := root.get_texture()
	if tex == null:
		print("NO_TEXTURE ", size, " view=", root.get_visible_rect().size)
		return null
	var img := tex.get_image()
	if img == null:
		print("NO_IMAGE ", size)
		return null
	print("SHOT ", size, " img=", img.get_width(), "x", img.get_height(), " view=", root.get_visible_rect().size)
	return img


func _apply_size(size: Vector2i) -> void:
	root.mode = Window.MODE_WINDOWED
	root.borderless = true
	root.content_scale_mode = Window.CONTENT_SCALE_MODE_DISABLED
	root.position = Vector2i(40, 40)
	root.size = size
	DisplayServer.window_set_size(size)


func _save(img: Image, file_name: String) -> Error:
	var dir := ProjectSettings.globalize_path(OUT_DIR)
	DirAccess.make_dir_recursive_absolute(dir)
	return img.save_png(dir.path_join(file_name))


func _matches_baseline(img: Image) -> String:
	var path := ProjectSettings.globalize_path(OUT_DIR).path_join(BASELINE_NAME)
	if not FileAccess.file_exists(path):
		return "missing baseline %s" % path
	var base := Image.load_from_file(path)
	if base == null:
		return "baseline unreadable"
	var shot := img.duplicate()
	shot.convert(Image.FORMAT_RGBA8)
	base.convert(Image.FORMAT_RGBA8)
	if shot.get_width() != base.get_width() or shot.get_height() != base.get_height():
		return "iphone size %dx%d != baseline %dx%d" % [shot.get_width(), shot.get_height(), base.get_width(), base.get_height()]
	if shot.get_data() == base.get_data():
		return ""
	var mismatch := 0
	var first := Vector2i(-1, -1)
	for y in shot.get_height():
		for x in shot.get_width():
			if shot.get_pixel(x, y) != base.get_pixel(x, y):
				mismatch += 1
				if first.x < 0:
					first = Vector2i(x, y)
				if mismatch > 40:
					break
		if mismatch > 40:
			break
	return "iphone pixels differ (at least %d, first %s)" % [mismatch, str(first)]


func _home() -> Control:
	return root.find_child("HomeScreen", true, false) as Control


func _assert_home(tag: String) -> String:
	var home := _home()
	if home == null:
		return "%s home missing" % tag
	var view := home.get_viewport().get_visible_rect()
	var logo := home.get_node_or_null("Margin/VBox/TopBar/Logo") as Control
	var scope := home.get_node_or_null("Margin/VBox/ScopeRow") as Control
	var scroll := home.get_node_or_null("Margin/VBox/Scroll") as Control
	var grid := home.get_node_or_null("Margin/VBox/Scroll/Grid") as Control
	var empty := home.get_node_or_null("Margin/VBox/EmptyState") as Control
	var problems: PackedStringArray = []
	if logo == null:
		problems.append("logo missing")
	else:
		var dx := absf(logo.get_global_rect().get_center().x - view.get_center().x)
		print("LOGO ", tag, " dx=", dx, " rect=", logo.get_global_rect(), " view=", view)
		if dx > LOGO_TOLERANCE:
			problems.append("logo dx %.2f" % dx)
		var outside := _outside(logo.get_global_rect(), view, 0.0)
		if outside != "":
			problems.append("logo %s" % outside)
	if scope != null:
		var sdx := absf(scope.get_global_rect().get_center().x - view.get_center().x)
		print("SCOPE ", tag, " dx=", sdx, " rect=", scope.get_global_rect())
		if sdx > LOGO_TOLERANCE:
			problems.append("scope dx %.2f" % sdx)
		var scope_out := _outside(scope.get_global_rect(), view, 0.0)
		if scope_out != "":
			problems.append("scope %s" % scope_out)
	else:
		problems.append("scope missing")
	if scroll != null:
		var scroll_out := _outside(scroll.get_global_rect(), view, 0.0)
		if scroll_out != "":
			problems.append("scroll %s" % scroll_out)
	else:
		problems.append("scroll missing")
	if grid != null and grid.get_global_rect().size.x > 1.0:
		var grect := grid.get_global_rect()
		if grect.position.x < view.position.x - 1.0 or grect.end.x > view.end.x + 1.0:
			problems.append("grid x %s view %s" % [str(grect), str(view)])
	if empty != null and empty.visible and empty.get_global_rect().size.y > 1.0:
		var edx := absf(empty.get_global_rect().get_center().x - view.get_center().x)
		if edx > LOGO_TOLERANCE:
			problems.append("empty dx %.2f" % edx)
		var empty_out := _outside(empty.get_global_rect(), view, 0.0)
		if empty_out != "":
			problems.append("empty %s" % empty_out)
	if problems.is_empty():
		return ""
	return "%s %s" % [tag, ", ".join(problems)]


func _assert_popups(tag: String) -> String:
	var home := _home()
	if home == null:
		return "%s home missing for popup" % tag
	var problems: PackedStringArray = []
	for path in ["Margin/VBox/CategorySelect", "Margin/VBox/DevMenu"]:
		var dropdown := home.get_node_or_null(path) as OptionButton
		if dropdown == null or not dropdown.visible:
			continue
		dropdown.show_popup()
		for _i in 4:
			await process_frame
		var popup := dropdown.get_popup()
		var rect := _popup_screen_rect(popup)
		var view := _root_screen_rect()
		var margin := POPUP_MARGIN * _screen_scale()
		print("POPUP ", tag, " ", path.get_file(), " screen=", rect, " root=", view, " embedded=", root.gui_embed_subwindows, " pos=", popup.position, " size=", popup.size)
		var outside := _outside(rect, view, margin)
		if outside != "":
			problems.append("%s %s" % [path.get_file(), outside])
		popup.hide()
		await process_frame
	if problems.is_empty():
		return ""
	return "%s popup %s" % [tag, ", ".join(problems)]


func _screen_scale() -> float:
	var view := root.get_visible_rect().size
	var win := Vector2(DisplayServer.window_get_size())
	if view.x < 1.0 or win.x < 1.0:
		return 1.0
	return win.x / view.x


func _root_screen_rect() -> Rect2:
	var id := root.get_window_id()
	return Rect2(Vector2(DisplayServer.window_get_position(id)), Vector2(DisplayServer.window_get_size(id)))


func _popup_screen_rect(popup: PopupMenu) -> Rect2:
	var id := popup.get_window_id()
	if id == root.get_window_id():
		var scale := _screen_scale()
		var origin := Vector2(DisplayServer.window_get_position())
		return Rect2(origin + Vector2(popup.position) * scale, Vector2(popup.size) * scale)
	return Rect2(Vector2(DisplayServer.window_get_position(id)), Vector2(DisplayServer.window_get_size(id)))


func _outside(rect: Rect2, view: Rect2, margin: float) -> String:
	var limit := Rect2(view.position + Vector2(margin, margin), view.size - Vector2(margin, margin) * 2.0)
	if rect.size.x < 1.0 or rect.size.y < 1.0:
		return "empty rect %s" % str(rect)
	if rect.position.x < limit.position.x - 1.0:
		return "left %.1f < %.1f" % [rect.position.x, limit.position.x]
	if rect.position.y < limit.position.y - 1.0:
		return "top %.1f < %.1f" % [rect.position.y, limit.position.y]
	if rect.end.x > limit.end.x + 1.0:
		return "right %.1f > %.1f" % [rect.end.x, limit.end.x]
	if rect.end.y > limit.end.y + 1.0:
		return "bottom %.1f > %.1f" % [rect.end.y, limit.end.y]
	return ""
