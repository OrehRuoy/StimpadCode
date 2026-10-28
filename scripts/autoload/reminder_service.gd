extends Node

## Opt-in daily local notification. iOS only. Never on the first launch.
## The prompt is a dialog, not a Home card.

signal reminder_state_changed

const PROMPT_WEEK_SEC := 60 * 60 * 24 * 7
const SCHEDULE_DAYS := 7
const BRIDGE_DIR := "user://local_notifications"
const LAUNCH_WAIT_SEC := 0.6

var _prompt: Control
var _command_id := 0
var _pending_trigger := ""
var _launch_source := "direct"
var _highlight_pending := false
var _opened_token := 0
var _delay_timer: SceneTreeTimer
var _prompt_retries := 0
var _last_skip := ""

const PROMPT_RETRY_MAX := 40


func _ready() -> void:
	AudioController.listened_enough.connect(func(_id: String) -> void: _arm_trigger("listen_45s"))
	AudioController.timer_finished.connect(func(_id: String) -> void: _arm_trigger("timer_finished"))
	_pending_trigger = LocalPrefs.reminder_pending_trigger
	call_deferred("_push_user_property")
	get_tree().create_timer(12.0).timeout.connect(_push_user_property, CONNECT_ONE_SHOT)
	if Platform.is_ios() and LocalPrefs.reminder_enabled:
		get_tree().create_timer(0.5).timeout.connect(_reschedule_if_allowed, CONNECT_ONE_SHOT)


func prepare_launch_source() -> String:
	_launch_source = "direct"
	if not Platform.is_ios():
		return _launch_source
	var opened := _read_opened()
	if opened.is_empty():
		await get_tree().create_timer(LAUNCH_WAIT_SEC).timeout
		opened = _read_opened()
	if not opened.is_empty():
		_consume_open(opened)
	return _launch_source


func on_home_settled() -> void:
	_schedule_prompt()


func is_showing() -> bool:
	return _prompt != null and is_instance_valid(_prompt)


func take_highlight() -> bool:
	var pending := _highlight_pending
	_highlight_pending = false
	return pending


func format_time(hour: int, minute: int) -> String:
	var h12 := hour % 12
	if h12 == 0:
		h12 = 12
	var suffix := "AM" if hour < 12 else "PM"
	return "%d:%02d %s" % [h12, minute, suffix]


func dismiss() -> void:
	_clear_prompt()


func disable_from_settings() -> void:
	var was_on := LocalPrefs.reminder_enabled
	LocalPrefs.reminder_enabled = false
	LocalPrefs.save_prefs()
	if Platform.is_ios():
		await _cancel_native()
	if was_on:
		AnalyticsService.log_event("reminder_disabled", {})
	_push_user_property()
	reminder_state_changed.emit()


func enable_from_settings() -> void:
	var status := await _ensure_permission()
	if status != "authorized":
		if status == "denied":
			AnalyticsService.log_event("reminder_permission_denied", {})
		LocalPrefs.reminder_enabled = false
		LocalPrefs.save_prefs()
		_push_user_property()
		reminder_state_changed.emit()
		return
	LocalPrefs.reminder_enabled = true
	LocalPrefs.save_prefs()
	AnalyticsService.log_event("reminder_opt_in", {"hour": LocalPrefs.reminder_hour})
	_push_user_property()
	await _schedule_week()
	reminder_state_changed.emit()


func pick_time_from_settings() -> void:
	if is_showing():
		return
	var host := get_tree().get_first_node_in_group("main_nav")
	if host == null:
		return
	_prompt = _make_prompt()
	host.add_child(_prompt)
	_prompt.z_index = 85
	_prompt.time_chosen.connect(_on_settings_time)
	_prompt.cancelled.connect(_clear_prompt)
	_prompt.present_time(LocalPrefs.reminder_hour, LocalPrefs.reminder_minute)


func _on_settings_time(hour: int, minute: int) -> void:
	_clear_prompt()
	LocalPrefs.reminder_hour = clampi(hour, 0, 23)
	LocalPrefs.reminder_minute = clampi(minute, 0, 59)
	LocalPrefs.save_prefs()
	if LocalPrefs.reminder_enabled:
		await _schedule_week()
	reminder_state_changed.emit()


func _notification(what: int) -> void:
	if what != NOTIFICATION_APPLICATION_RESUMED and what != NOTIFICATION_APPLICATION_FOCUS_IN:
		return
	if not Platform.is_ios():
		return
	var opened := _read_opened()
	if opened.is_empty():
		return
	_consume_open(opened)
	_go_to_daily_sound()


func _arm_trigger(trigger: String) -> void:
	_debug("trigger %s opens=%d" % [trigger, LocalPrefs.app_open_count])
	_pending_trigger = trigger
	_prompt_retries = 0
	_last_skip = ""
	LocalPrefs.reminder_pending_trigger = trigger
	LocalPrefs.save_prefs()
	_schedule_prompt()


func _schedule_prompt() -> void:
	if not _can_prompt():
		return
	if _delay_timer != null:
		return
	_delay_timer = get_tree().create_timer(1.6)
	_delay_timer.timeout.connect(_on_prompt_delay, CONNECT_ONE_SHOT)


func _on_prompt_delay() -> void:
	_delay_timer = null
	if not _can_prompt():
		return
	var block := _block_reason()
	if not block.is_empty():
		_debug("wait: %s" % block)
		_prompt_retries += 1
		if _prompt_retries <= PROMPT_RETRY_MAX:
			_schedule_prompt()
		else:
			_debug("gave up while blocked: %s" % block)
		return
	_prompt_retries = 0
	_show_prompt()


func _can_prompt() -> bool:
	if Platform.is_android():
		_debug("skip: android")
		return false
	## Editor play does not set the "editor" feature tag. Debug builds cover that.
	if not Platform.is_ios() and not OS.has_feature("editor") and not OS.is_debug_build():
		_debug("skip: not ios")
		return false
	if LocalPrefs.app_open_count < 2:
		_debug("skip: first launch opens=%d" % LocalPrefs.app_open_count)
		return false
	if LocalPrefs.reminder_enabled:
		_debug("skip: already on")
		return false
	if LocalPrefs.reminder_decline_count >= 2:
		_debug("skip: declined %d" % LocalPrefs.reminder_decline_count)
		return false
	if _pending_trigger != "listen_45s" and _pending_trigger != "timer_finished":
		_debug("skip: no trigger")
		return false
	var now := int(Time.get_unix_time_from_system())
	if LocalPrefs.reminder_prompt_last_unix > 0 and now - LocalPrefs.reminder_prompt_last_unix < PROMPT_WEEK_SEC:
		_debug("skip: cooldown")
		return false
	return true


func _blocked() -> bool:
	return not _block_reason().is_empty()


## Empty when the dialog may show over the current screen. Home is not required.
func _block_reason() -> String:
	if is_showing():
		return "already showing"
	if EnjoyPromptService.is_showing():
		return "enjoy prompt"
	if FeatureTipService.is_showing():
		return "feature tip"
	if AdsService.is_fullscreen_ad_showing():
		return "fullscreen ad"
	var nav := get_tree().get_first_node_in_group("main_nav")
	if nav == null:
		return "no main"
	var paywall := nav.get_node_or_null("Screens/PaywallScreen")
	if paywall != null and paywall.visible:
		return "paywall"
	return ""


func _show_prompt() -> void:
	if is_showing():
		return
	var host := get_tree().get_first_node_in_group("main_nav")
	if host == null:
		return
	var trigger := _pending_trigger
	_prompt = _make_prompt()
	host.add_child(_prompt)
	_prompt.z_index = 85
	_prompt.declined.connect(_on_declined)
	_prompt.time_chosen.connect(_on_opt_in_time)
	_prompt.present_opt_in()
	LocalPrefs.reminder_prompt_last_unix = int(Time.get_unix_time_from_system())
	LocalPrefs.save_prefs()
	_debug("show %s" % trigger)
	AnalyticsService.log_event("reminder_prompt_shown", {"trigger": trigger})


func _debug(msg: String) -> void:
	if not OS.is_debug_build():
		return
	if msg == _last_skip:
		return
	_last_skip = msg
	print("[Reminder] ", msg)


func _on_declined() -> void:
	_clear_prompt()
	LocalPrefs.reminder_decline_count += 1
	LocalPrefs.reminder_pending_trigger = ""
	_pending_trigger = ""
	LocalPrefs.save_prefs()
	AnalyticsService.log_event("reminder_declined", {})


func _on_opt_in_time(hour: int, minute: int) -> void:
	_clear_prompt()
	LocalPrefs.reminder_hour = clampi(hour, 0, 23)
	LocalPrefs.reminder_minute = clampi(minute, 0, 59)
	LocalPrefs.reminder_pending_trigger = ""
	_pending_trigger = ""
	LocalPrefs.save_prefs()
	var status := await _ensure_permission()
	if status != "authorized":
		if status == "denied":
			AnalyticsService.log_event("reminder_permission_denied", {})
		reminder_state_changed.emit()
		return
	LocalPrefs.reminder_enabled = true
	LocalPrefs.save_prefs()
	AnalyticsService.log_event("reminder_opt_in", {"hour": LocalPrefs.reminder_hour})
	_push_user_property()
	await _schedule_week()
	reminder_state_changed.emit()


func _make_prompt() -> Control:
	var prompt := Control.new()
	prompt.set_script(load("res://scripts/ui/reminder_prompt.gd"))
	return prompt


func _clear_prompt() -> void:
	if _prompt != null and is_instance_valid(_prompt):
		_prompt.queue_free()
	_prompt = null


func _reschedule_if_allowed() -> void:
	var status := await _native_status()
	if status == "denied":
		if LocalPrefs.reminder_enabled:
			LocalPrefs.reminder_enabled = false
			LocalPrefs.save_prefs()
			AnalyticsService.log_event("reminder_disabled", {})
			_push_user_property()
			reminder_state_changed.emit()
		return
	if status == "authorized" and LocalPrefs.reminder_enabled:
		await _schedule_week()


func _ensure_permission() -> String:
	if not Platform.is_ios():
		if OS.has_feature("editor"):
			return "authorized"
		return "unsupported"
	var current := await _native_status()
	if current == "authorized" or current == "denied":
		return current
	return await _native_request()


func _schedule_week() -> void:
	if not LocalPrefs.reminder_enabled:
		return
	var items: Array = []
	var now := Time.get_datetime_dict_from_system()
	var now_minutes := int(now.hour) * 60 + int(now.minute)
	var target_minutes := LocalPrefs.reminder_hour * 60 + LocalPrefs.reminder_minute
	var added := 0
	for offset in range(0, SCHEDULE_DAYS + 2):
		if added >= SCHEDULE_DAYS:
			break
		if offset == 0 and now_minutes >= target_minutes:
			continue
		var date: Dictionary = DailySound.add_days(int(now.year), int(now.month), int(now.day), offset)
		var sound := DailySound.sound_on(int(date.year), int(date.month), int(date.day))
		if sound.is_empty():
			continue
		var name := tr(str(sound.get("name", "")))
		items.append({
			"identifier": "stimpad-daily-%d" % added,
			"title": "StimPad",
			"body": tr("Today's sound: %s") % name,
			"year": int(date.year),
			"month": int(date.month),
			"day": int(date.day),
			"hour": LocalPrefs.reminder_hour,
			"minute": LocalPrefs.reminder_minute,
		})
		added += 1
	if items.is_empty():
		return
	if not Platform.is_ios():
		print("[Reminder] schedule ", items.size(), " editor/non-iOS")
		return
	await _native_call("schedule", {"items": items}, 4.0)


func _cancel_native() -> void:
	if not Platform.is_ios():
		return
	await _native_call("cancel_all", {}, 3.0)


func _native_status() -> String:
	var result := await _native_call("status", {}, 4.0)
	return str(result.get("status", ""))


func _native_request() -> String:
	var result := await _native_call("request_permission", {}, 40.0)
	return str(result.get("status", ""))


func _native_call(op: String, extra: Dictionary, timeout_sec: float) -> Dictionary:
	_command_id += 1
	var cmd := {"id": _command_id, "op": op}
	for key in extra.keys():
		cmd[key] = extra[key]
	_write_json("command.json", cmd)
	var deadline := Time.get_ticks_msec() + int(timeout_sec * 1000.0)
	while Time.get_ticks_msec() < deadline:
		var result := _read_json("result.json")
		if int(result.get("id", -1)) == _command_id:
			return result
		await get_tree().process_frame
	return {}


func _read_opened() -> Dictionary:
	var parsed := _read_json("opened.json")
	var token := int(parsed.get("token", 0))
	if token <= 0 or token == _opened_token:
		return {}
	return parsed


func _consume_open(opened: Dictionary) -> void:
	var token := int(opened.get("token", 0))
	if token <= 0 or token == _opened_token:
		return
	_opened_token = token
	_launch_source = "reminder"
	_highlight_pending = true
	var hour := int(opened.get("hour", LocalPrefs.reminder_hour))
	AnalyticsService.log_event("reminder_open", {"hour": hour})
	_remove_file("opened.json")


func _go_to_daily_sound() -> void:
	var nav := get_tree().get_first_node_in_group("main_nav")
	if nav != null and nav.has_method("open_from_reminder"):
		nav.call("open_from_reminder")


func _push_user_property() -> void:
	AnalyticsService.set_user_property("reminder_on", "1" if LocalPrefs.reminder_enabled else "0")


func _write_json(file_name: String, data: Dictionary) -> void:
	DirAccess.make_dir_recursive_absolute(BRIDGE_DIR)
	var path := BRIDGE_DIR.path_join(file_name)
	var file := FileAccess.open(path, FileAccess.WRITE)
	if file == null:
		return
	file.store_string(JSON.stringify(data))
	file.close()


func _read_json(file_name: String) -> Dictionary:
	var path := BRIDGE_DIR.path_join(file_name)
	if not FileAccess.file_exists(path):
		return {}
	var file := FileAccess.open(path, FileAccess.READ)
	if file == null:
		return {}
	var parsed: Variant = JSON.parse_string(file.get_as_text())
	file.close()
	if typeof(parsed) != TYPE_DICTIONARY:
		return {}
	return parsed


func _remove_file(file_name: String) -> void:
	var path := ProjectSettings.globalize_path(BRIDGE_DIR.path_join(file_name))
	if FileAccess.file_exists(BRIDGE_DIR.path_join(file_name)):
		DirAccess.remove_absolute(path)
