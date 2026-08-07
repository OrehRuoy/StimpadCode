extends Node
## Head Flossing — bilateral LFO panning via AudioEffectPanner on the SFX bus.
## Global listening mode (Settings); applies to all sounds routed through SFX.

const BUS_NAME := "SFX"
const RESET_LERP_SPEED := 6.0 ## How fast pan returns to center when disabled.

@export var head_floss_enabled: bool = false:
	set(value):
		head_floss_enabled = value
		if not value:
			_phase = 0.0
		## Prefer not writing prefs from the setter during load; use set_enabled().

@export var pan_speed: float = 0.4 ## Cycles/sec. ~0.25–0.5 feels calm for continuous audio; 1 Hz is EMDR “click” pace.
@export var pan_depth: float = 0.75 ## Max |pan|, clamped 0..1.

var _bus_idx: int = -1
var _panner: AudioEffectPanner
var _phase: float = 0.0
var _current_pan: float = 0.0


func _ready() -> void:
	_ensure_bus_and_panner()
	_route_audio_controller()
	## Restore preference after LocalPrefs has loaded (same frame / earlier autoload).
	head_floss_enabled = LocalPrefs.head_floss_enabled
	pan_speed = LocalPrefs.head_floss_pan_speed
	pan_depth = clampf(LocalPrefs.head_floss_pan_depth, 0.0, 1.0)
	set_process(true)


func _exit_tree() -> void:
	_reset_panner_hard()


func set_enabled(enabled: bool, persist: bool = true) -> void:
	head_floss_enabled = enabled
	if persist:
		LocalPrefs.head_floss_enabled = enabled
		LocalPrefs.save_prefs()


func is_enabled() -> bool:
	return head_floss_enabled


func _process(delta: float) -> void:
	if _panner == null:
		return
	var depth := clampf(pan_depth, 0.0, 1.0)
	if head_floss_enabled:
		_phase += delta * maxf(pan_speed, 0.0) * TAU
		## sin → −1..1; depth scales stereo width.
		_current_pan = sin(_phase) * depth
		_panner.pan = _current_pan
	else:
		## Smoothly return to center so audio isn't left hard-panned.
		if absf(_current_pan) < 0.001:
			_current_pan = 0.0
			_panner.pan = 0.0
			return
		_current_pan = lerpf(_current_pan, 0.0, clampf(RESET_LERP_SPEED * delta, 0.0, 1.0))
		_panner.pan = _current_pan


func _ensure_bus_and_panner() -> void:
	_bus_idx = AudioServer.get_bus_index(BUS_NAME)
	if _bus_idx < 0:
		## Insert SFX just after Master (index 1) so Master stays the final mix.
		AudioServer.add_bus(1)
		_bus_idx = 1
		AudioServer.set_bus_name(_bus_idx, BUS_NAME)
		AudioServer.set_bus_send(_bus_idx, "Master")

	_panner = _find_panner_on_bus(_bus_idx)
	if _panner == null:
		_panner = AudioEffectPanner.new()
		_panner.pan = 0.0
		AudioServer.add_bus_effect(_bus_idx, _panner)
	else:
		_panner.pan = 0.0


func _find_panner_on_bus(bus_idx: int) -> AudioEffectPanner:
	var count := AudioServer.get_bus_effect_count(bus_idx)
	for i in range(count):
		var fx := AudioServer.get_bus_effect(bus_idx, i)
		if fx is AudioEffectPanner:
			return fx as AudioEffectPanner
	return null


func _route_audio_controller() -> void:
	## All StimPad playback goes through SFX so flossing affects every sound.
	if AudioController == null:
		return
	var player: AudioStreamPlayer = AudioController.get_node_or_null("MainAudioPlayer") as AudioStreamPlayer
	if player != null:
		player.bus = BUS_NAME


func _reset_panner_hard() -> void:
	_current_pan = 0.0
	_phase = 0.0
	if _panner != null:
		_panner.pan = 0.0
