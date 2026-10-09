extends Node

## Firebase / Google Analytics bridge (iOS via GodotFirebaseiOS → GA4).
## Popularity: event `sound_play` with param `sound_id` (also `select_content`).

const MAX_QUEUED_EVENTS := 40
const QUEUE_GIVE_UP_SEC := 90.0

var _initialized: bool = false
var _native = null
var _queue: Array[Dictionary] = []
var _queue_open := true
var _flushing := false
var _queue_started_msec: int = 0


func _ready() -> void:
	_queue_started_msec = Time.get_ticks_msec()
	## Defer native Firebase Analytics bind — cold-start races with AdMob/home caused TestFlight crashes.
	if OS.has_feature("mobile") and OS.get_name() == "iOS":
		get_tree().create_timer(10.0).timeout.connect(_initialize_analytics, CONNECT_ONE_SHOT)
		_arm_native_retry()
	else:
		call_deferred("_initialize_analytics")


func log_event(event_name: String, params: Dictionary = {}) -> void:
	var clean := _stringify_params(params)
	if OS.has_feature("editor") or not OS.has_feature("mobile"):
		print("[Analytics] %s %s" % [event_name, clean])
	if not OS.has_feature("mobile"):
		return
	if _initialized and _native != null:
		_log_event_native(event_name, clean)
		return
	if _queue_open:
		_enqueue(event_name, clean)


func log_app_open() -> void:
	var days := 0
	if LocalPrefs.first_open_unix > 0:
		var elapsed := int(Time.get_unix_time_from_system()) - LocalPrefs.first_open_unix
		days = maxi(0, int(float(elapsed) / 86400.0))
	log_event("app_open", {
		"app_open_count": LocalPrefs.app_open_count,
		"has_plus": Entitlements.has_plus(),
		"days_since_first_open": days,
	})


func log_screen(screen_name: String) -> void:
	## GA4/Firebase screen tracking.
	log_event("screen_view", {"screen_name": screen_name, "firebase_screen": screen_name})


func log_sound_play(sound: Dictionary) -> void:
	## Primary popularity signal — view counts per sound_id in GA4.
	var sound_id := str(sound.get("id", ""))
	if sound_id.is_empty():
		return
	var params := {
		"sound_id": sound_id,
		"sound_name": str(sound.get("name", "")),
		"category": str(sound.get("category", "")),
		"tier": str(sound.get("tier", "")),
		"mode": str(sound.get("mode", "")),
		"content_type": "sound",
		"item_id": sound_id,
	}
	log_event("sound_play", params)
	## GA4 recommended event — shows under Engagement → Events more cleanly.
	log_event("select_content", {
		"content_type": "sound",
		"item_id": sound_id,
		"sound_name": str(sound.get("name", "")),
		"category": str(sound.get("category", "")),
	})


func log_sound_stop(sound: Dictionary, duration_sec: float) -> void:
	var sound_id := str(sound.get("id", ""))
	if sound_id.is_empty():
		return
	log_event("sound_stop", {
		"sound_id": sound_id,
		"sound_name": str(sound.get("name", "")),
		"category": str(sound.get("category", "")),
		"duration_sec": snappedf(maxf(duration_sec, 0.0), 0.1),
	})


func _initialize_analytics() -> void:
	_native = _resolve_native()
	if _native == null and OS.has_feature("mobile"):
		push_warning("AnalyticsService: Firebase Analytics not found — events stay local/print only.")
		_initialized = true
		return
	## Wait for FirebaseIOS core init on device when available.
	if OS.has_feature("ios") and has_node("/root/FirebaseIOS"):
		var ios: Node = get_node("/root/FirebaseIOS")
		if ios.has_signal("firebase_initialized") and not ios.is_connected("firebase_initialized", _on_firebase_ready):
			ios.firebase_initialized.connect(_on_firebase_ready, CONNECT_ONE_SHOT)
			## Fail-open so early plays still queue once native is up.
			get_tree().create_timer(8.0).timeout.connect(_on_fail_open, CONNECT_ONE_SHOT)
			return
	_initialized = true
	if _native != null:
		_flush_queue()


func _on_fail_open() -> void:
	if not _initialized:
		_initialized = true
	if _native == null:
		_native = _resolve_native()
	if _native != null:
		_flush_queue()


func _on_firebase_ready() -> void:
	_native = _resolve_native()
	_initialized = true
	print("AnalyticsService: Firebase initialized")
	if _native != null:
		_flush_queue()


func _arm_native_retry() -> void:
	get_tree().create_timer(2.0).timeout.connect(_retry_native, CONNECT_ONE_SHOT)


func _retry_native() -> void:
	if not _queue_open or _native != null:
		return
	var elapsed := float(Time.get_ticks_msec() - _queue_started_msec) / 1000.0
	if elapsed >= QUEUE_GIVE_UP_SEC:
		_queue.clear()
		_queue_open = false
		return
	var resolved = _resolve_native()
	if resolved != null:
		_native = resolved
		_initialized = true
		_flush_queue()
		return
	_arm_native_retry()


func _enqueue(event_name: String, params: Dictionary) -> void:
	if _queue.size() >= MAX_QUEUED_EVENTS:
		var dropped := false
		for i in _queue.size():
			if str(_queue[i].get("name", "")) == "screen_view":
				_queue.remove_at(i)
				dropped = true
				break
		if not dropped:
			return
	_queue.append({"name": event_name, "params": params})


func _flush_queue() -> void:
	if _flushing or _native == null:
		return
	_flushing = true
	var batch := 0
	while not _queue.is_empty():
		var ev: Dictionary = _queue.pop_front()
		_log_event_native(str(ev.get("name", "")), ev.get("params", {}))
		batch += 1
		if batch >= 8 and not _queue.is_empty():
			batch = 0
			await get_tree().process_frame
	_flushing = false


func _resolve_native():
	## Prefer GodotFirebaseiOS autoload analytics module.
	if has_node("/root/FirebaseIOS"):
		var ios = get_node("/root/FirebaseIOS")
		if ios != null and ios.get("analytics") != null:
			return ios.analytics
	## Fallbacks for alternate plugin names.
	for n in ["GodotxFirebaseAnalytics", "FirebaseAnalytics", "FirebaseIOS"]:
		if Engine.has_singleton(n):
			return Engine.get_singleton(n)
	if has_node("/root/FirebaseAnalytics"):
		return get_node("/root/FirebaseAnalytics")
	return null


func _log_event_native(event_name: String, params: Dictionary) -> void:
	if _native == null:
		return
	## Normalize param values to String/int/float for native bridges.
	var bridge_params := {}
	for k in params.keys():
		var v = params[k]
		if typeof(v) == TYPE_BOOL:
			bridge_params[str(k)] = 1 if v else 0
		elif typeof(v) in [TYPE_INT, TYPE_FLOAT, TYPE_STRING]:
			bridge_params[str(k)] = v
		else:
			bridge_params[str(k)] = str(v)
	if _native.has_method("log_event"):
		_native.log_event(event_name, bridge_params)
	elif _native.has_method("logEvent"):
		_native.logEvent(event_name, bridge_params)


func _stringify_params(params: Dictionary) -> Dictionary:
	var out := {}
	for k in params.keys():
		out[str(k)] = params[k]
	return out
