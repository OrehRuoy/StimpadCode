extends SceneTree
## Home shots with the banner slot, with and without the rewarded chip.
## STIMPAD_SHOT_DIR is the output folder. Prints ROW_METRICS for the fold check.


func _init() -> void:
	process_frame.connect(_run, CONNECT_ONE_SHOT)


func _run() -> void:
	var folder := OS.get_environment("STIMPAD_SHOT_DIR")
	if folder.is_empty():
		folder = "reward-row"
	var specs: Array[Dictionary] = [
		{"name": "iphone-390x844", "logical": Vector2i(390, 844), "window": Vector2i(390, 844), "inset": Vector4(0, 47, 0, 34)},
		{"name": "iphone-1179x2556", "logical": Vector2i(390, 844), "window": Vector2i(1179, 2556), "inset": Vector4(0, 141, 0, 102)},
		{"name": "small-320x568", "logical": Vector2i(320, 568), "window": Vector2i(320, 568), "inset": Vector4(0, 20, 0, 0)},
	]
	var failures: PackedStringArray = []
	for spec in specs:
		var err := await _capture(spec, folder)
		if err != "":
			failures.append(err)
	if failures.is_empty():
		print("REWARD_ROW_OK")
		quit(0)
	else:
		for line in failures:
			print("REWARD_ROW_FAIL ", line)
		quit(1)


func _capture(spec: Dictionary, folder: String) -> String:
	var tag: String = str(spec["name"])
	Responsive.force_android_layout = false
	Responsive.test_insets_enabled = true
	Responsive.test_inset_px = spec["inset"]
	_apply_size(spec["logical"], spec["window"])
	change_scene_to_file("res://scenes/main.tscn")
	var home: Node = null
	var boot: CanvasItem = null
	for _i in 800:
		await process_frame
		_apply_size(spec["logical"], spec["window"])
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
	for _j in 20:
		await process_frame
		_apply_size(spec["logical"], spec["window"])
	_hide_prompts()
	if home.has_method("debug_set_reward_offer"):
		home.call("debug_set_reward_offer", false)
	for _k in 8:
		await process_frame
	var before := _measure(tag, "before")
	var before_err := await _save_view(folder, "%s-before.png" % tag)
	if before_err != "":
		return "%s before %s" % [tag, before_err]
	if home.has_method("debug_set_reward_offer"):
		home.call("debug_set_reward_offer", true)
	for _n in 8:
		await process_frame
	if home.has_method("refit_reward_chip"):
		home.call("refit_reward_chip")
	for _p in 4:
		await process_frame
	var after := _measure(tag, "after")
	var after_err := await _save_view(folder, "%s-after.png" % tag)
	if after_err != "":
		return "%s after %s" % [tag, after_err]
	print(
		"ROW_METRICS ", tag,
		" view=", root.get_visible_rect().size,
		" chip_h=", after["chip_h"],
		" chip_text=", after["chip_text"],
		" header_before=", before["header_h"],
		" header_after=", after["header_h"],
		" tile_y_before=", before["tile_y"],
		" tile_y_after=", after["tile_y"],
		" tile_delta=", after["tile_y"] - before["tile_y"],
		" above_before=", before["above"],
		" above_after=", after["above"],
		" fold_y=", after["fold_y"],
		" banner_h=", after["banner_h"]
	)
	return ""


func _measure(tag: String, phase: String) -> Dictionary:
	var home := root.find_child("HomeScreen", true, false)
	var chip := home.find_child("RewardOffer", true, false) as Control
	var header := home.find_child("TopBar", true, false) as Control
	var grid := home.find_child("Grid", true, false) as Control
	var banner := root.find_child("BannerPlaceholder", true, false) as Control
	var view := root.get_visible_rect().size
	var fold_y := view.y
	var banner_h := 0.0
	if banner != null and banner.visible:
		var br := banner.get_global_rect()
		fold_y = br.position.y
		banner_h = br.size.y
	var tile_y := -1.0
	var above := 0
	if grid != null:
		for child in grid.get_children():
			if not (child is Control):
				continue
			var rect := (child as Control).get_global_rect()
			if rect.size.y < 8.0:
				continue
			if tile_y < 0.0:
				tile_y = rect.position.y
			if rect.position.y < fold_y - 4.0:
				above += 1
	var chip_h := 0.0
	var chip_text := ""
	if chip != null and chip.visible:
		chip_h = chip.get_global_rect().size.y
		if chip is Button:
			chip_text = (chip as Button).text
	print("ROW_PHASE ", tag, " ", phase, " chip_h=", chip_h, " tile_y=", tile_y, " above=", above, " fold=", fold_y)
	return {
		"chip_h": chip_h,
		"chip_text": chip_text,
		"header_h": header.size.y if header else -1.0,
		"tile_y": tile_y,
		"above": above,
		"fold_y": fold_y,
		"banner_h": banner_h,
	}


func _hide_prompts() -> void:
	for name in ["EnjoyPrompt", "FeatureTip", "ReminderPrompt"]:
		var node := root.find_child(name, true, false)
		if node is CanvasItem:
			(node as CanvasItem).visible = false


func _save_view(folder: String, file_name: String) -> String:
	for _draw in 2:
		await process_frame
	RenderingServer.force_draw()
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


func _apply_size(logical: Vector2i, window: Vector2i) -> void:
	root.mode = Window.MODE_WINDOWED
	root.borderless = true
	root.content_scale_mode = Window.CONTENT_SCALE_MODE_CANVAS_ITEMS
	root.content_scale_aspect = Window.CONTENT_SCALE_ASPECT_EXPAND
	root.content_scale_size = logical
	root.position = Vector2i(20, 20)
	root.size = window
	DisplayServer.window_set_size(window)
