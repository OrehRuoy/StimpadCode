shader_type canvas_item;

uniform float radius : hint_range(0.0, 0.5) = 0.18;

void fragment() {
	vec2 p = abs(UV - vec2(0.5));
	vec2 box = vec2(0.5 - radius);
	vec2 d = p - box;
	float outside = length(max(d, vec2(0.0))) + min(max(d.x, d.y), 0.0) - radius;
	if (outside > 0.0) {
		discard;
	}
}
