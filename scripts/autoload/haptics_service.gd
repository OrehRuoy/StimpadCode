extends Node
## Short phone vibration on taps when enabled in Settings.

const TAP_MS := 18
const PLAY_MS := 28


func tap() -> void:
	_vibrate(TAP_MS)


func play() -> void:
	_vibrate(PLAY_MS)


func _vibrate(duration_ms: int) -> void:
	if not LocalPrefs.haptics_enabled:
		return
	## No-op on desktop; works on Android / iOS.
	Input.vibrate_handheld(duration_ms)
