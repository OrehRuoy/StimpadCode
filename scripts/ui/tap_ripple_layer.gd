extends Control
## Full-screen overlay: soft expanding ripples at tap points (visual stim).

class Ripple:
	var pos: Vector2
	var age: float = 0.0
	var life: float = 0.55
	var max_radius: float = 56.0
	var color: Color = Color(0.37, 0.81, 0.69, 0.55)


var _ripples: Array[Ripple] = []


func _ready() -> void:
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	set_process(true)
	z_index = 40


func spawn_at_global(global_pos: Vector2) -> void:
	if not LocalPrefs.tap_ripples_enabled:
		return
	var r := Ripple.new()
	r.pos = get_global_transform_with_canvas().affine_inverse() * global_pos
	r.max_radius = 72.0
	r.life = 0.7
	_ripples.append(r)
	queue_redraw()


func _process(delta: float) -> void:
	if _ripples.is_empty():
		return
	var i := 0
	while i < _ripples.size():
		_ripples[i].age += delta
		if _ripples[i].age >= _ripples[i].life:
			_ripples.remove_at(i)
		else:
			i += 1
	queue_redraw()


func _draw() -> void:
	for r in _ripples:
		var t := clampf(r.age / r.life, 0.0, 1.0)
		var radius := lerpf(8.0, r.max_radius, t)
		var alpha := (1.0 - t) * r.color.a
		var col := Color(r.color.r, r.color.g, r.color.b, alpha)
		draw_arc(r.pos, radius, 0.0, TAU, 48, col, 2.5, true)
		## Soft inner fill for a little glow without heavy particles.
		var fill := Color(r.color.r, r.color.g, r.color.b, alpha * 0.22)
		draw_circle(r.pos, radius * 0.35, fill)
