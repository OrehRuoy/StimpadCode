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
	## Room under the art for the stop-timer chips.
	if is_tablet(viewport_size):
		return maxf(340.0, viewport_size.y * 0.42)
	return maxf(200.0, viewport_size.y * 0.32)


static func title_font_size(viewport_size: Vector2) -> int:
	return 30 if is_tablet(viewport_size) else 24


static func px_to_viewport(px: float, window_axis: float, view_axis: float) -> float:
	## Safe area and window size are screen pixels. Layout margins are viewport units.
	if px <= 0.0:
		return 0.0
	if window_axis <= 1.0 or view_axis <= 1.0:
		return px
	if window_axis <= view_axis * 1.15:
		return px
	return px * view_axis / window_axis


static func viewport_size() -> Vector2:
	var tree := Engine.get_main_loop()
	if tree is SceneTree:
		return (tree as SceneTree).root.get_visible_rect().size
	return Vector2.ZERO


static func safe_outer_margins(base: Vector4) -> Vector4:
	var sa := DisplayServer.get_display_safe_area()
	var win := DisplayServer.window_get_size()
	var view := viewport_size()
	var win_x := float(win.x)
	var win_y := float(win.y)
	var left := maxf(base.x, px_to_viewport(float(sa.position.x), win_x, view.x) + 8.0)
	var top := maxf(base.y, px_to_viewport(float(sa.position.y), win_y, view.y) + 8.0)
	var right_px := float(win.x - sa.position.x - sa.size.x)
	var bottom_px := float(win.y - sa.position.y - sa.size.y)
	var right := maxf(base.z, px_to_viewport(right_px, win_x, view.x) + 8.0)
	var bottom := maxf(base.w, px_to_viewport(bottom_px, win_y, view.y) + 8.0)
	## Keep chrome clear of status bar / notch (esp. player Back).
	if OS.has_feature("mobile") and top < 40.0:
		top = 40.0
	## The banner strip already sits in the home-indicator area. Adding that
	## inset again inside the screen pushes content up and then the player
	## controls spill back down over the ad.
	var ads = tree_ads()
	if ads != null and ads.has_method("banner_reserved_height") and ads.banner_reserved_height() > 1.0:
		bottom = base.w
	return Vector4(left, top, right, bottom)


static func tree_ads() -> Node:
	var tree := Engine.get_main_loop()
	if tree is SceneTree:
		return (tree as SceneTree).root.get_node_or_null("AdsService")
	return null
