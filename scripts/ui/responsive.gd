extends Control
class_name Responsive

## Shared responsive layout helpers for phone vs tablet (iOS + Android).

const PHONE_SHORTEST := 700.0


static func is_tablet(viewport_size: Vector2) -> bool:
	return mini(viewport_size.x, viewport_size.y) >= PHONE_SHORTEST


static func grid_columns(viewport_size: Vector2) -> int:
	var w := viewport_size.x
	var h := viewport_size.y
	var shortest := mini(w, h)
	var is_tab := shortest >= PHONE_SHORTEST
	# Phone portrait
	if not is_tab:
		if w >= 500.0:
			return 3
		return 2
	# Tablet
	if w >= 1100.0:
		return 4
	return 3


static func content_margins(viewport_size: Vector2) -> Vector4:
	# left, top, right, bottom
	if is_tablet(viewport_size):
		return Vector4(28, 20, 28, 18)
	return Vector4(16, 12, 16, 10)


static func logo_min_size(viewport_size: Vector2) -> Vector2:
	if is_tablet(viewport_size):
		return Vector2(280, 72)
	return Vector2(180, 52)


static func top_button_min_height(viewport_size: Vector2) -> float:
	return 52.0 if is_tablet(viewport_size) else 44.0


static func player_art_min_height(viewport_size: Vector2) -> float:
	if is_tablet(viewport_size):
		return maxf(400.0, viewport_size.y * 0.48)
	return maxf(280.0, viewport_size.y * 0.40)


static func title_font_size(viewport_size: Vector2) -> int:
	return 30 if is_tablet(viewport_size) else 24


static func safe_outer_margins(base: Vector4) -> Vector4:
	var sa := DisplayServer.get_display_safe_area()
	var win := DisplayServer.window_get_size()
	var left := maxf(base.x, float(sa.position.x) + 8.0)
	var top := maxf(base.y, float(sa.position.y) + 8.0)
	var right := maxf(base.z, float(win.x - sa.position.x - sa.size.x) + 8.0)
	var bottom := maxf(base.w, float(win.y - sa.position.y - sa.size.y) + 8.0)
	## Keep chrome clear of status bar / notch (esp. player Back).
	if OS.has_feature("mobile") and top < 40.0:
		top = 40.0
	return Vector4(left, top, right, bottom)
