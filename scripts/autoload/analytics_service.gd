extends Node

var _initialized: bool = false


func _ready() -> void:
	call_deferred("_initialize_analytics")


func log_event(event_name: String, params: Dictionary = {}) -> void:
	if not _initialized and OS.has_feature("editor"):
		print("[Analytics] %s %s" % [event_name, params])
		return
	_log_event_native(event_name, params)


func log_screen(screen_name: String) -> void:
	log_event("screen_view", {"screen_name": screen_name})


func _initialize_analytics() -> void:
	if not OS.has_feature("mobile"):
		_initialized = true
		return
	# Hook: GodotFirebaseiOS / Firebase Android Analytics.
	_initialized = true


func _log_event_native(event_name: String, params: Dictionary) -> void:
	if not _initialized:
		return
	# Hook: FirebaseAnalytics.logEvent(event_name, params)
