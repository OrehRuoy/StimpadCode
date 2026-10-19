extends Node
## Short phone vibration on taps when enabled in Settings.

const TAP_MS := 18
const PLAY_MS := 28
const ANDROID_TAP_MS := 25
const ANDROID_PLAY_MS := 35
const ANDROID_TAP_AMPLITUDE := 0.5
const ANDROID_PLAY_AMPLITUDE := 0.8


func tap() -> void:
	if Platform.is_android():
		_vibrate_android(ANDROID_TAP_MS, ANDROID_TAP_AMPLITUDE)
		return
	_vibrate(TAP_MS)


func play() -> void:
	if Platform.is_android():
		_vibrate_android(ANDROID_PLAY_MS, ANDROID_PLAY_AMPLITUDE)
		return
	_vibrate(PLAY_MS)


func _vibrate(duration_ms: int) -> void:
	if not LocalPrefs.haptics_enabled:
		return
	## No-op on desktop; iOS uses the one-argument duration.
	Input.vibrate_handheld(duration_ms)


func _vibrate_android(duration_ms: int, amplitude: float) -> void:
	if not LocalPrefs.haptics_enabled:
		return
	Input.vibrate_handheld(duration_ms, amplitude)
