extends Node

## Firebase / Google Analytics bridge (iOS via GodotFirebaseiOS → GA4).
## Popularity: event `sound_play` with param `sound_id` (also `select_content`).

const MAX_QUEUED_EVENTS := 40
const QUEUE_GIVE_UP_SEC := 90.0
const _ANDROID_BRIDGE := "com.godot.game.FirebaseAnalyticsBridge"
## GA4 custom dimensions only store strings. Quote these so they cannot round-trip as numbers.
const _GA4_STRING_DIMENSIONS: Dictionary = {
	"sound_id": true,
	"sound_name": true,
	"category": true,
	"tier": true,
	"mode": true,
	"content_type": true,
	"item_id": true,
	"screen_name": true,
	"product_id": true,
	"source": true,
	"trigger": true,
	"method": true,
	"os": true,
}

var _initialized: bool = false
var _native = null
var _android_bridge = null
var _android_tracking_disabled := false
var _android_started := false
var _queue: Array[Dictionary] = []
var _queue_open := true
var _flushing := false
var _queue_started_msec: int = 0
var _sound_play_strings_logged := false
var _pending_user_props: Dictionary = {}


func _ready() -> void:
	_queue_started_msec = Time.get_ticks_msec()
	## Defer native Firebase Analytics bind — cold-start races with AdMob/home caused TestFlight crashes.
	if OS.has_feature("mobile") and OS.get_name() == "iOS":
		get_tree().create_timer(10.0).timeout.connect(_initialize_analytics, CONNECT_ONE_SHOT)
		_arm_native_retry()
	elif Platform.is_android():
		## Android starts after the boot overlay, via ensure_started().
		return
	else:
		call_deferred("_initialize_analytics")


func ensure_started() -> void:
	if not Platform.is_android() or _android_started:
		return
	_android_started = true
	_initialize_analytics()


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


func log_app_open(source: String = "direct") -> void:
	var open_source := "reminder" if source == "reminder" else "direct"
	log_event("app_open", {
		"app_open_count": LocalPrefs.app_open_count,
		"has_plus": Entitlements.has_plus(),
		"days_since_first_open": LocalPrefs.days_since_first_open(),
		"source": open_source,
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
	if OS.is_debug_build() and not _sound_play_strings_logged:
		_sound_play_strings_logged = true
		print("AnalyticsService sound_play strings sound_id=%s sound_name=%s" % [
			JSON.stringify(str(params["sound_id"])),
			JSON.stringify(str(params["sound_name"])),
		])
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
		if not _android_tracking_disabled:
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
		if Platform.is_android():
			set_user_property("platform", Platform.store_name())
			set_user_property("app_build", AppInfo.build_number())
		_flush_user_props()
		_flush_queue()


func _on_fail_open() -> void:
	if not _initialized:
		_initialized = true
	if _native == null:
		_native = _resolve_native()
	if _native != null:
		_flush_user_props()
		_flush_queue()


func _on_firebase_ready() -> void:
	_native = _resolve_native()
	_initialized = true
	print("AnalyticsService: Firebase initialized")
	if _native != null:
		_flush_user_props()
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
		_flush_user_props()
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


func set_user_property(prop_name: String, prop_value: String) -> void:
	var name_key := prop_name.strip_edges()
	var value_text := prop_value.strip_edges()
	if name_key.is_empty():
		return
	if OS.has_feature("editor") or not OS.has_feature("mobile"):
		print("[Analytics] user_property %s=%s" % [name_key, value_text])
	if Platform.is_android():
		if _android_bridge == null:
			return
		var payload := '{"name":%s,"value":%s}' % [JSON.stringify(name_key), JSON.stringify(value_text)]
		_android_bridge.setUserPropertyJson(payload)
		if JavaClassWrapper.get_exception() != null:
			push_warning("AnalyticsService.set_user_property failed for '%s'" % name_key)
		return
	if OS.has_feature("ios"):
		if _native != null and _native.has_method("set_user_property"):
			_native.set_user_property(name_key, value_text)
		else:
			_pending_user_props[name_key] = value_text


func _flush_user_props() -> void:
	if _native == null or not _native.has_method("set_user_property"):
		return
	for key in _pending_user_props.keys():
		_native.set_user_property(str(key), str(_pending_user_props[key]))
	_pending_user_props.clear()


func _resolve_native():
	if Platform.is_android():
		return _resolve_android_bridge()
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


func _resolve_android_bridge():
	if _android_tracking_disabled:
		return null
	if _android_bridge != null:
		return _android_bridge
	if not ClassDB.class_exists("JavaClassWrapper"):
		return null
	var bridge = JavaClassWrapper.wrap(_ANDROID_BRIDGE)
	if JavaClassWrapper.get_exception() != null or bridge == null:
		return null
	var track: bool = bool(bridge.shouldTrackAnalytics())
	if JavaClassWrapper.get_exception() != null or not track:
		_android_tracking_disabled = true
		_queue.clear()
		_queue_open = false
		return null
	_android_bridge = bridge
	return bridge


func _encode_event_payload(event_name: String, params: Dictionary) -> String:
	return '{"event":%s,"params":%s}' % [JSON.stringify(event_name), _encode_params_json(params)]


func _encode_params_json(params: Dictionary) -> String:
	var parts: PackedStringArray = PackedStringArray()
	for raw_key in params.keys():
		var key := str(raw_key)
		var encoded: String
		if _GA4_STRING_DIMENSIONS.has(key):
			encoded = JSON.stringify(str(params[key]))
		else:
			encoded = JSON.stringify(params[key])
		parts.append("%s:%s" % [JSON.stringify(key), encoded])
	return "{" + ",".join(parts) + "}"


func _log_event_native(event_name: String, params: Dictionary) -> void:
	if _native == null:
		return
	if Platform.is_android():
		_native.logEventJson(_encode_event_payload(event_name, params))
		if JavaClassWrapper.get_exception() != null:
			push_warning("AnalyticsService logEventJson failed for '%s'" % event_name)
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
