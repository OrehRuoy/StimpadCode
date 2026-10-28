extends Node

const PREFS_PATH := "user://stimpad_prefs.json"

var favorites: Array[String] = []
var recent_sound_ids: Array[String] = [] ## newest first
var last_scope: String = "All" ## All | Free | Favorites | Recent
var last_sound_category: String = "All" ## All | Alarms | Bells | ...
## 0 = play until Stop. Otherwise 15 / 30 / 60 minutes, in seconds.
var session_duration_sec: int = 0

## Head Flossing (bilateral pan) — global listening mode
var head_floss_enabled: bool = false
var head_floss_pan_speed: float = 0.4
var head_floss_pan_depth: float = 0.75

## Playback extras
var haptics_enabled: bool = true
var show_pitch_speed: bool = false
var tap_ripples_enabled: bool = false
var playback_rate: float = 1.0 ## Shared pitch/speed (AudioStreamPlayer.pitch_scale)
var repeat_oneshots: bool = false ## Keep replaying short sounds until Stop
var sfx_volume: float = 1.0 ## 0..1 linear → SFX bus

const RECENT_MAX := 24

## Feature tip carousel (each tip shown at most once)
var feature_tip_index: int = 0 ## legacy
var feature_tip_snooze_until: int = 0
var feature_tips_done: bool = false
var feature_tips_seen: Array[String] = []
var home_features_banner_dismissed: bool = false

## Enjoy / review prompt state
var first_open_unix: int = 0
var app_open_count: int = 0
var enjoy_prompt_completed: bool = false
var enjoy_prompt_snooze_until: int = 0
var enjoy_prompt_last_shown_unix: int = 0
var preview_day: String = ""
var previewed_ids: Array[String] = []
var library_unlock_until_unix: int = 0
var library_unlock_started_unix: int = 0
var library_unlock_last_day: String = ""
## Android ads panel only. When true, ignore Plus and request Google's test units.
var android_test_ads: bool = false
## Last real playback. Restored into the existing controls on the next open.
var last_session: Dictionary = {}
var daily_sound_shown_day: String = ""
var reminder_enabled: bool = false
var reminder_hour: int = 20
var reminder_minute: int = 0
var reminder_decline_count: int = 0
var reminder_prompt_last_unix: int = 0
var reminder_pending_trigger: String = ""
var _restored_session := false


func _ready() -> void:
	load_prefs()
	if _restored_session:
		_apply_last_session()
		save_prefs()
		call_deferred("_log_session_restored")
	## AudioController boots before prefs — re-apply saved volume once disk values are loaded.
	if AudioController != null:
		AudioController.apply_sfx_volume(sfx_volume)


func load_prefs() -> void:
	if not FileAccess.file_exists(PREFS_PATH):
		return
	var file := FileAccess.open(PREFS_PATH, FileAccess.READ)
	if file == null:
		return
	var parsed: Variant = JSON.parse_string(file.get_as_text())
	file.close()
	if typeof(parsed) != TYPE_DICTIONARY:
		return
	favorites = _to_string_array(parsed.get("favorites", []))
	recent_sound_ids = _to_string_array(parsed.get("recent_sound_ids", []))
	session_duration_sec = _migrate_session_duration(int(parsed.get("session_duration_sec", 0)))
	head_floss_enabled = bool(parsed.get("head_floss_enabled", false))
	head_floss_pan_speed = float(parsed.get("head_floss_pan_speed", 0.4))
	## First ship used 1.0 Hz (EMDR click pace) — too busy for continuous sounds.
	if is_equal_approx(head_floss_pan_speed, 1.0):
		head_floss_pan_speed = 0.4
	head_floss_pan_depth = clampf(float(parsed.get("head_floss_pan_depth", 0.75)), 0.0, 1.0)
	haptics_enabled = bool(parsed.get("haptics_enabled", true))
	show_pitch_speed = bool(parsed.get("show_pitch_speed", false))
	tap_ripples_enabled = bool(parsed.get("tap_ripples_enabled", false))
	playback_rate = clampf(float(parsed.get("playback_rate", 1.0)), 0.5, 1.5)
	repeat_oneshots = bool(parsed.get("repeat_oneshots", false))
	sfx_volume = clampf(float(parsed.get("sfx_volume", 1.0)), 0.0, 1.0)
	feature_tip_index = int(parsed.get("feature_tip_index", 0))
	feature_tip_snooze_until = int(parsed.get("feature_tip_snooze_until", 0))
	feature_tips_done = bool(parsed.get("feature_tips_done", false))
	feature_tips_seen = _to_string_array(parsed.get("feature_tips_seen", []))
	## Migrate: if they already advanced the old index, treat those tips as seen.
	if feature_tips_seen.is_empty() and feature_tip_index > 0:
		var legacy_ids := ["head_floss", "haptics", "pitch_speed", "tap_ripples"]
		for i in range(mini(feature_tip_index, legacy_ids.size())):
			feature_tips_seen.append(legacy_ids[i])
		if feature_tips_seen.size() >= legacy_ids.size():
			feature_tips_done = true
	home_features_banner_dismissed = bool(parsed.get("home_features_banner_dismissed", false))
	first_open_unix = int(parsed.get("first_open_unix", 0))
	app_open_count = int(parsed.get("app_open_count", 0))
	enjoy_prompt_completed = bool(parsed.get("enjoy_prompt_completed", false))
	enjoy_prompt_snooze_until = int(parsed.get("enjoy_prompt_snooze_until", 0))
	enjoy_prompt_last_shown_unix = int(parsed.get("enjoy_prompt_last_shown_unix", 0))
	preview_day = str(parsed.get("preview_day", ""))
	previewed_ids = _to_string_array(parsed.get("previewed_ids", []))
	library_unlock_until_unix = int(parsed.get("library_unlock_until_unix", 0))
	library_unlock_started_unix = int(parsed.get("library_unlock_started_unix", 0))
	library_unlock_last_day = str(parsed.get("library_unlock_last_day", ""))
	android_test_ads = bool(parsed.get("android_test_ads", false))
	var session_raw: Variant = parsed.get("last_session", {})
	if typeof(session_raw) == TYPE_DICTIONARY:
		last_session = session_raw
		_restored_session = not str(last_session.get("sound_id", "")).is_empty()
	daily_sound_shown_day = str(parsed.get("daily_sound_shown_day", ""))
	reminder_enabled = bool(parsed.get("reminder_enabled", false))
	reminder_hour = clampi(int(parsed.get("reminder_hour", 20)), 0, 23)
	reminder_minute = clampi(int(parsed.get("reminder_minute", 0)), 0, 59)
	reminder_decline_count = maxi(0, int(parsed.get("reminder_decline_count", 0)))
	reminder_prompt_last_unix = int(parsed.get("reminder_prompt_last_unix", 0))
	reminder_pending_trigger = str(parsed.get("reminder_pending_trigger", ""))
	if parsed.has("last_scope"):
		last_scope = str(parsed.get("last_scope", "All"))
		last_sound_category = str(parsed.get("last_sound_category", "All"))
	else:
		## Migrate older single last_category field.
		var legacy := str(parsed.get("last_category", "All"))
		if legacy in ["All", "Free", "Favorites"]:
			last_scope = legacy
			last_sound_category = "All"
		else:
			last_scope = "All"
			last_sound_category = legacy


func save_prefs() -> void:
	var data := {
		"favorites": favorites,
		"recent_sound_ids": recent_sound_ids,
		"last_scope": last_scope,
		"last_sound_category": last_sound_category,
		"session_duration_sec": session_duration_sec,
		"head_floss_enabled": head_floss_enabled,
		"head_floss_pan_speed": head_floss_pan_speed,
		"head_floss_pan_depth": head_floss_pan_depth,
		"haptics_enabled": haptics_enabled,
		"show_pitch_speed": show_pitch_speed,
		"tap_ripples_enabled": tap_ripples_enabled,
		"playback_rate": playback_rate,
		"repeat_oneshots": repeat_oneshots,
		"sfx_volume": sfx_volume,
		"feature_tip_index": feature_tip_index,
		"feature_tip_snooze_until": feature_tip_snooze_until,
		"feature_tips_done": feature_tips_done,
		"feature_tips_seen": feature_tips_seen,
		"home_features_banner_dismissed": home_features_banner_dismissed,
		"first_open_unix": first_open_unix,
		"app_open_count": app_open_count,
		"enjoy_prompt_completed": enjoy_prompt_completed,
		"enjoy_prompt_snooze_until": enjoy_prompt_snooze_until,
		"enjoy_prompt_last_shown_unix": enjoy_prompt_last_shown_unix,
		"preview_day": preview_day,
		"previewed_ids": previewed_ids,
		"library_unlock_until_unix": library_unlock_until_unix,
		"library_unlock_started_unix": library_unlock_started_unix,
		"library_unlock_last_day": library_unlock_last_day,
		"android_test_ads": android_test_ads,
		"last_session": last_session,
		"daily_sound_shown_day": daily_sound_shown_day,
		"reminder_enabled": reminder_enabled,
		"reminder_hour": reminder_hour,
		"reminder_minute": reminder_minute,
		"reminder_decline_count": reminder_decline_count,
		"reminder_prompt_last_unix": reminder_prompt_last_unix,
		"reminder_pending_trigger": reminder_pending_trigger,
	}
	var file := FileAccess.open(PREFS_PATH, FileAccess.WRITE)
	if file == null:
		return
	file.store_string(JSON.stringify(data, "\t"))
	file.close()


func _today_key() -> String:
	var d := Time.get_date_dict_from_system()
	return "%04d-%02d-%02d" % [int(d.year), int(d.month), int(d.day)]


func can_preview_today(sound_id: String) -> bool:
	if preview_day != _today_key():
		preview_day = _today_key()
		previewed_ids.clear()
		return true
	return not (sound_id in previewed_ids)


func mark_previewed_today(sound_id: String) -> void:
	if preview_day != _today_key():
		preview_day = _today_key()
		previewed_ids.clear()
	if not (sound_id in previewed_ids):
		previewed_ids.append(sound_id)
	save_prefs()


func note_app_open() -> void:
	var now := int(Time.get_unix_time_from_system())
	if first_open_unix <= 0:
		first_open_unix = now
	app_open_count += 1
	save_prefs()


func days_since_first_open() -> int:
	if first_open_unix <= 0:
		return 0
	var elapsed := int(Time.get_unix_time_from_system()) - first_open_unix
	return maxi(0, int(float(elapsed) / 86400.0))


func hours_since_last_session() -> float:
	var unix := int(last_session.get("unix", 0))
	if unix <= 0:
		return 0.0
	var elapsed := float(int(Time.get_unix_time_from_system()) - unix) / 3600.0
	return snappedf(maxf(0.0, elapsed), 0.1)


func capture_playback_session() -> void:
	if AudioController == null or not AudioController.is_playing() or AudioController.is_previewing():
		return
	var sound_id := AudioController.get_current_sound_id()
	if sound_id.is_empty():
		return
	last_session = {
		"sound_id": sound_id,
		"playback_rate": clampf(playback_rate, 0.5, 1.5),
		"head_floss_enabled": head_floss_enabled,
		"session_duration_sec": session_duration_sec,
		"repeat_oneshots": repeat_oneshots,
		"unix": int(Time.get_unix_time_from_system()),
	}
	save_prefs()


func _apply_last_session() -> void:
	if last_session.has("playback_rate"):
		playback_rate = clampf(float(last_session.get("playback_rate", playback_rate)), 0.5, 1.5)
	if last_session.has("head_floss_enabled"):
		head_floss_enabled = bool(last_session.get("head_floss_enabled", head_floss_enabled))
	if last_session.has("session_duration_sec"):
		session_duration_sec = _migrate_session_duration(int(last_session.get("session_duration_sec", 0)))
	if last_session.has("repeat_oneshots"):
		repeat_oneshots = bool(last_session.get("repeat_oneshots", repeat_oneshots))


func _log_session_restored() -> void:
	var sound_id := str(last_session.get("sound_id", ""))
	if sound_id.is_empty():
		return
	AnalyticsService.log_event("session_restored", {
		"sound_id": sound_id,
		"hours_since_last": hours_since_last_session(),
	})


func mark_enjoy_prompt_shown() -> void:
	enjoy_prompt_last_shown_unix = int(Time.get_unix_time_from_system())
	save_prefs()


func mark_enjoy_prompt_completed() -> void:
	enjoy_prompt_completed = true
	enjoy_prompt_snooze_until = 0
	save_prefs()


func snooze_enjoy_prompt(seconds: int) -> void:
	enjoy_prompt_snooze_until = int(Time.get_unix_time_from_system()) + maxi(seconds, 0)
	save_prefs()


func clear_library_unlock() -> void:
	library_unlock_until_unix = 0
	library_unlock_started_unix = 0
	library_unlock_last_day = ""
	save_prefs()


func reset_enjoy_prompt_for_debug() -> void:
	enjoy_prompt_completed = false
	enjoy_prompt_snooze_until = 0
	enjoy_prompt_last_shown_unix = 0
	save_prefs()


func reset_feature_tips_for_debug() -> void:
	feature_tip_index = 0
	feature_tip_snooze_until = 0
	feature_tips_done = false
	feature_tips_seen.clear()
	home_features_banner_dismissed = false
	save_prefs()


func toggle_favorite(sound_id: String) -> void:
	if sound_id in favorites:
		favorites.erase(sound_id)
	else:
		favorites.append(sound_id)
	save_prefs()


func is_favorite(sound_id: String) -> bool:
	return sound_id in favorites


func note_recent_sound(sound_id: String) -> void:
	if sound_id.is_empty():
		return
	recent_sound_ids.erase(sound_id)
	recent_sound_ids.push_front(sound_id)
	while recent_sound_ids.size() > RECENT_MAX:
		recent_sound_ids.pop_back()
	save_prefs()


func _migrate_session_duration(raw: int) -> int:
	## Current chips. Anything else is the old unused second-based default.
	if raw == 15 * 60 or raw == 30 * 60 or raw == 60 * 60:
		return raw
	return 0


func _to_string_array(value: Variant) -> Array[String]:
	var result: Array[String] = []
	if typeof(value) != TYPE_ARRAY:
		return result
	for item in value:
		result.append(str(item))
	return result
