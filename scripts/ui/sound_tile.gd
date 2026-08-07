extends PanelContainer

signal pressed

@onready var _art: TextureRect = $Root/VBox/ArtFrame/Art
@onready var _name: Label = $Root/VBox/NameRow/NameLabel
@onready var _plus_badge: TextureRect = $Root/VBox/NameRow/PlusBadge
@onready var _name_row: Control = $Root/VBox/NameRow
@onready var _hint: Label = $Root/VBox/HintLabel
@onready var _art_frame: PanelContainer = $Root/VBox/ArtFrame

const DRAG_CANCEL_PX := 10.0

var _sound: Dictionary = {}
var _unlocked: bool = true
var _press_tween: Tween
var _press_pos: Vector2 = Vector2.ZERO
var _pressing: bool = false
var _dragged: bool = false
var _parent_scroll: ScrollContainer


func setup(sound: Dictionary) -> void:
	_sound = sound
	_unlocked = SoundCatalog.is_sound_unlocked(sound)
	_name.text = str(sound.get("name", "Sound"))
	_name.visible = true
	_plus_badge.visible = not _unlocked
	_hint.visible = true
	if _unlocked:
		_hint.text = " "
		_hint.modulate = Color(1, 1, 1, 0)
	else:
		_hint.text = "Tap to unlock"
		_hint.modulate = Color(1, 1, 1, 1)
	modulate = Color.WHITE
	_art.modulate = Color(1, 1, 1, 1) if _unlocked else Color(0.82, 0.84, 0.88, 1)
	_art.texture = null
	_art.rotation_degrees = 0.0
	_art.scale = Vector2.ONE
	_art.position = Vector2.ZERO
	_apply_frame_style()
	_apply_responsive_sizes()
	call_deferred("_layout_name_row")
	## Defer art so grid build doesn't decode every PNG in one frame.
	call_deferred("_load_art")


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
	call_deferred("_cache_parent_scroll")


func _on_resized() -> void:
	_apply_responsive_sizes()
	_layout_name_row()


func _cache_parent_scroll() -> void:
	var node: Node = get_parent()
	while node:
		if node is ScrollContainer:
			_parent_scroll = node
			_parent_scroll.scroll_deadzone = 8
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
				_parent_scroll.scroll_vertical - sd.relative.y
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
					_parent_scroll.scroll_vertical - mm.relative.y
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
