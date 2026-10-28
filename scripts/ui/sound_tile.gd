extends PanelContainer

signal pressed

@onready var _art: TextureRect = $Root/VBox/ArtFrame/Art
@onready var _name: Label = $Root/VBox/NameRow/NameLabel
@onready var _plus_badge: TextureRect = $Root/VBox/NameRow/PlusBadge
@onready var _name_row: Control = $Root/VBox/NameRow
@onready var _hint: Label = $Root/VBox/HintLabel
@onready var _art_frame: PanelContainer = $Root/VBox/ArtFrame

const DRAG_CANCEL_PX := 28.0
const SCROLL_DAMP := 0.55
const _ROUNDED_THUMB := preload("res://assets/ui/rounded_thumb.gdshader")
const _FRAME_TEX := preload("res://assets/ui/tile_frame.png")
## Matches the outer corner of tile_frame.png so the enlarged icon stays inside it.
const FRAME_CLIP_RADIUS := 0.23

var _sound: Dictionary = {}
var _unlocked: bool = true
var _press_tween: Tween
var _press_pos: Vector2 = Vector2.ZERO
var _pressing: bool = false
var _dragged: bool = false
var _parent_scroll: ScrollContainer
var _daily_badge: Control
var _watch_daily := false
var _art_stack: Control
var _frame: TextureRect


func setup(sound: Dictionary) -> void:
	_sound = sound
	_unlocked = SoundCatalog.is_sound_unlocked(sound)
	_name.text = tr(str(sound.get("name", "Sound")))
	_name.visible = true
	_plus_badge.visible = not _unlocked
	_hint.visible = true
	if _unlocked:
		_hint.text = " "
		_hint.modulate = Color(1, 1, 1, 0)
	else:
		_hint.text = tr("Tap to unlock")
		_hint.modulate = Color(1, 1, 1, 1)
	modulate = Color.WHITE
	_art.texture = null
	_art.rotation_degrees = 0.0
	_art.scale = Vector2.ONE
	_ensure_overlay()
	_apply_frame_style()
	_apply_responsive_sizes()
	_apply_icon_frame()
	call_deferred("_layout_name_row")
	call_deferred("_load_art")
	_apply_daily_badge()


func get_sound_id() -> String:
	return str(_sound.get("id", ""))


func highlight_briefly() -> void:
	modulate = Color.WHITE
	var tw := create_tween()
	tw.tween_property(self, "modulate", Color(0.72, 1.0, 0.9, 1), 0.16)
	tw.tween_property(self, "modulate", Color.WHITE, 0.7)


func _apply_daily_badge() -> void:
	if _daily_badge != null and is_instance_valid(_daily_badge):
		_daily_badge.queue_free()
	_daily_badge = null
	_watch_daily = false
	set_process(false)
	if not DailySound.is_free_today(get_sound_id()) or _art == null:
		return
	_watch_daily = true
	set_process(true)
	if _parent_scroll == null:
		_cache_parent_scroll()
	var badge := PanelContainer.new()
	badge.name = "FreeTodayBadge"
	badge.mouse_filter = Control.MOUSE_FILTER_IGNORE
	badge.clip_contents = true
	var chip := StyleBoxFlat.new()
	chip.bg_color = Color(0.05, 0.1, 0.12, 0.82)
	chip.corner_radius_top_left = 10
	chip.corner_radius_top_right = 10
	chip.corner_radius_bottom_right = 10
	chip.corner_radius_bottom_left = 10
	chip.set_content_margin_all(3)
	badge.add_theme_stylebox_override("panel", chip)
	var row := HBoxContainer.new()
	row.mouse_filter = Control.MOUSE_FILTER_IGNORE
	row.add_theme_constant_override("separation", 3)
	row.alignment = BoxContainer.ALIGNMENT_CENTER
	badge.add_child(row)
	var icon := TextureRect.new()
	icon.name = "Icon"
	icon.mouse_filter = Control.MOUSE_FILTER_IGNORE
	icon.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	icon.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	icon.custom_minimum_size = Vector2(16, 16)
	if ResourceLoader.exists("res://assets/ui/badge_free_today.png"):
		icon.texture = load("res://assets/ui/badge_free_today.png")
	else:
		push_warning("Missing daily badge art at res://assets/ui/badge_free_today.png")
		icon.visible = false
	row.add_child(icon)
	var label := Label.new()
	label.name = "Caption"
	label.mouse_filter = Control.MOUSE_FILTER_IGNORE
	label.text = tr("Free today")
	label.add_theme_font_size_override("font_size", 11)
	label.add_theme_color_override("font_color", Color(0.93, 0.98, 0.96, 1))
	row.add_child(label)
	var host: Node = _art_stack if _art_stack != null else _art
	host.add_child(badge)
	if _art_stack != null:
		_art_stack.move_child(badge, -1)
	_daily_badge = badge
	call_deferred("_layout_daily_badge")


func _layout_daily_badge() -> void:
	if _daily_badge == null or not is_instance_valid(_daily_badge) or _art == null:
		return
	var frame_w := _art.size.x
	if frame_w < 8.0:
		return
	var caption := _daily_badge.find_child("Caption", true, false) as Label
	var icon := _daily_badge.find_child("Icon", true, false) as Control
	var icon_s := 16.0
	var text_w := 0.0
	if caption and caption.get_theme_font("font"):
		text_w = caption.get_theme_font("font").get_string_size(
			caption.text, HORIZONTAL_ALIGNMENT_LEFT, -1, caption.get_theme_font_size("font_size")
		).x
	var show_text := text_w + icon_s + 16.0 <= frame_w - 8.0
	if caption:
		caption.visible = show_text
	var badge_w := icon_s + 10.0
	if show_text:
		badge_w += text_w + 6.0
	var badge_h := 24.0
	_daily_badge.position = Vector2(6.0, maxf(4.0, _art.size.y - badge_h - 6.0))
	_daily_badge.size = Vector2(minf(badge_w, frame_w - 8.0), badge_h)
	if icon:
		icon.custom_minimum_size = Vector2(icon_s, icon_s)


func _process(_delta: float) -> void:
	if not _watch_daily:
		set_process(false)
		return
	_layout_daily_badge()
	if not _daily_badge_on_screen():
		return
	DailySound.note_badge_shown(get_sound_id())
	_watch_daily = false
	set_process(false)


func _daily_badge_on_screen() -> bool:
	if not is_visible_in_tree():
		return false
	var tile_rect := get_global_rect()
	if tile_rect.size.y < 8.0:
		return false
	var view := get_viewport().get_visible_rect()
	if _parent_scroll != null:
		view = _parent_scroll.get_global_rect()
	return tile_rect.intersects(view)


func _load_art() -> void:
	if not is_instance_valid(_art):
		return
	var art_path: String = str(_sound.get("art", ""))
	if art_path != "" and ResourceLoader.exists(art_path):
		_art.texture = load(art_path)
	else:
		_art.texture = null


func _ready() -> void:
	mouse_filter = Control.MOUSE_FILTER_STOP
	focus_mode = Control.FOCUS_NONE
	mouse_default_cursor_shape = Control.CURSOR_POINTING_HAND
	size_flags_horizontal = Control.SIZE_EXPAND_FILL
	size_flags_stretch_ratio = 1.0
	resized.connect(_on_resized)
	if _name_row:
		_name_row.resized.connect(_layout_name_row)
	_apply_frame_style()
	_ensure_overlay()
	call_deferred("_cache_parent_scroll")


func _on_resized() -> void:
	_apply_responsive_sizes()
	_layout_name_row()
	_layout_daily_badge()


func _cache_parent_scroll() -> void:
	var node: Node = get_parent()
	while node:
		if node is ScrollContainer:
			_parent_scroll = node
			_parent_scroll.scroll_deadzone = 24
			return
		node = node.get_parent()


func _gui_input(event: InputEvent) -> void:
	if event is InputEventScreenTouch:
		var st := event as InputEventScreenTouch
		if st.pressed:
			_begin_press(st.position)
		else:
			_end_press()
	elif event is InputEventScreenDrag:
		var sd := event as InputEventScreenDrag
		if not _pressing:
			return
		if sd.position.distance_to(_press_pos) > DRAG_CANCEL_PX:
			_dragged = true
			_play_press_squash(false)
		if _dragged and _parent_scroll:
			_parent_scroll.scroll_vertical = int(
				_parent_scroll.scroll_vertical - sd.relative.y * SCROLL_DAMP
			)
			accept_event()
	elif event is InputEventMouseButton and event.button_index == MOUSE_BUTTON_LEFT:
		var mb := event as InputEventMouseButton
		if mb.pressed:
			_begin_press(mb.position)
		else:
			_end_press()
	elif event is InputEventMouseMotion and _pressing:
		var mm := event as InputEventMouseMotion
		if mm.button_mask & MOUSE_BUTTON_MASK_LEFT:
			if mm.position.distance_to(_press_pos) > DRAG_CANCEL_PX:
				_dragged = true
				_play_press_squash(false)
			if _dragged and _parent_scroll:
				_parent_scroll.scroll_vertical = int(
					_parent_scroll.scroll_vertical - mm.relative.y * SCROLL_DAMP
				)
				accept_event()


func _begin_press(pos: Vector2) -> void:
	_pressing = true
	_dragged = false
	_press_pos = pos
	_play_press_squash(true)


func _end_press() -> void:
	if not _pressing:
		return
	_pressing = false
	_play_press_squash(false)
	if not _dragged:
		_emit_tap_feedback()
		pressed.emit()


func _emit_tap_feedback() -> void:
	var layer := get_tree().get_first_node_in_group("tap_ripple_layer")
	if layer != null and layer.has_method("spawn_at_global"):
		layer.call("spawn_at_global", get_global_transform_with_canvas() * _press_pos)


func _play_press_squash(down: bool) -> void:
	if _press_tween:
		_press_tween.kill()
	_press_tween = create_tween()
	if down:
		_press_tween.tween_property(self, "scale", Vector2(0.96, 0.96), 0.06)
	else:
		_press_tween.tween_property(self, "scale", Vector2.ONE, 0.12).set_trans(Tween.TRANS_BACK)


func _apply_responsive_sizes() -> void:
	var shortest := mini(get_viewport_rect().size.x, get_viewport_rect().size.y)
	var is_tablet := shortest >= 700.0
	var tile_h := 236.0 if is_tablet else 204.0
	var art_h := 140.0 if is_tablet else 112.0
	var font_size := 15 if is_tablet else 13
	var hint_size := 13 if is_tablet else 11
	var plus_s := 18.0 if is_tablet else 14.0

	custom_minimum_size = Vector2(0, tile_h)
	size_flags_horizontal = Control.SIZE_EXPAND_FILL
	size_flags_stretch_ratio = 1.0
	pivot_offset = size * 0.5

	if _art_frame:
		_art_frame.custom_minimum_size = Vector2(0, art_h)
		_art_frame.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		_art_frame.size_flags_vertical = Control.SIZE_EXPAND_FILL

	if _name_row:
		_name_row.custom_minimum_size = Vector2(0, 32.0 if is_tablet else 28.0)
		_name_row.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		_name_row.size_flags_vertical = 0

	if _name:
		_name.add_theme_color_override("font_color", Color(0.96, 0.94, 0.91, 1))
		_name.add_theme_font_size_override("font_size", font_size)
		_name.autowrap_mode = TextServer.AUTOWRAP_OFF
		_name.clip_text = true
		_name.text_overrun_behavior = TextServer.OVERRUN_TRIM_ELLIPSIS
		_name.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		_name.vertical_alignment = VERTICAL_ALIGNMENT_CENTER

	if _plus_badge:
		_plus_badge.custom_minimum_size = Vector2(plus_s, plus_s)
		_plus_badge.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
		_plus_badge.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED

	if _hint:
		_hint.add_theme_font_size_override("font_size", hint_size)
		_hint.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		_hint.custom_minimum_size = Vector2(0, 18.0)


## Center [name][plus] as one group under the art. Does not affect grid column widths.
func _layout_name_row() -> void:
	if _name == null or _name_row == null:
		return
	var row_w := _name_row.size.x
	var row_h := _name_row.size.y
	if row_w < 1.0 or row_h < 1.0:
		return

	var font := _name.get_theme_font("font")
	var font_size := _name.get_theme_font_size("font_size")
	var text_w := 40.0
	if font:
		text_w = font.get_string_size(
			_name.text, HORIZONTAL_ALIGNMENT_LEFT, -1, font_size
		).x

	var plus_s := 0.0
	var sep := 0.0
	if _plus_badge and _plus_badge.visible:
		plus_s = _plus_badge.custom_minimum_size.x
		sep = 4.0

	var name_w := mini(text_w + 2.0, maxf(24.0, row_w - plus_s - sep - 4.0))
	var cluster_w := name_w + sep + plus_s
	var start_x := (row_w - cluster_w) * 0.5
	var name_h := minf(row_h, float(font_size + 10))
	var name_y := (row_h - name_h) * 0.5

	_name.position = Vector2(start_x, name_y)
	_name.size = Vector2(name_w, name_h)

	if _plus_badge and _plus_badge.visible:
		var plus_y := (row_h - plus_s) * 0.5
		_plus_badge.position = Vector2(start_x + name_w + sep, plus_y)
		_plus_badge.size = Vector2(plus_s, plus_s)


func _apply_frame_style() -> void:
	var empty := StyleBoxEmpty.new()
	add_theme_stylebox_override("panel", empty)
	if _art_frame:
		_art_frame.clip_contents = true
		var style := StyleBoxFlat.new()
		style.bg_color = Color(0, 0, 0, 0)
		style.corner_radius_top_left = 22
		style.corner_radius_top_right = 22
		style.corner_radius_bottom_right = 22
		style.corner_radius_bottom_left = 22
		style.set_content_margin_all(0)
		_art_frame.add_theme_stylebox_override("panel", style)
	if _art:
		_art.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
		_art.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
		_art.custom_minimum_size = Vector2.ZERO
		_art.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		_art.size_flags_vertical = Control.SIZE_EXPAND_FILL
		_art.mouse_filter = Control.MOUSE_FILTER_IGNORE


func _ensure_overlay() -> void:
	if _art_frame == null or _art == null:
		return
	if _art_stack != null and is_instance_valid(_art_stack):
		return
	_art_stack = Control.new()
	_art_stack.name = "ArtStack"
	_art_stack.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_art_stack.clip_contents = true
	_art_stack.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_art_stack.size_flags_vertical = Control.SIZE_EXPAND_FILL
	_art_frame.add_child(_art_stack)
	_art.reparent(_art_stack)
	_art.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_art.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	_frame = TextureRect.new()
	_frame.name = "TileFrame"
	_frame.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_frame.texture = _FRAME_TEX
	_frame.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	_frame.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	_frame.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	_art_stack.add_child(_frame)


func _icon_tint() -> Color:
	if _unlocked:
		return Color(1, 1, 1, 1)
	return Color(0.82, 0.84, 0.88, 1)


func _apply_icon_frame() -> void:
	if _art == null:
		return
	_ensure_overlay()
	var tint := _icon_tint()
	_art.modulate = tint
	var mat := ShaderMaterial.new()
	mat.shader = _ROUNDED_THUMB
	mat.set_shader_parameter("radius", FRAME_CLIP_RADIUS)
	mat.set_shader_parameter("zoom", SoundCatalog.icon_scale(_sound))
	mat.set_shader_parameter("icon_tint", tint)
	_art.material = mat
