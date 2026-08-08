extends Node

const PREFS_PATH := "user://stimpad_prefs.json"

var favorites: Array[String] = []
var recent_sound_ids: Array[String] = [] ## newest first
var last_scope: String = "All" ## All | Free | Favorites | Recent
var last_sound_category: String = "All" ## All | Alarms | Bells | ...
var session_duration_sec: int = 60

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


func _ready() -> void:
	load_prefs()
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
	session_duration_sec = int(parsed.get("session_duration_sec", 60))
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
	}
	var file := FileAccess.open(PREFS_PATH, FileAccess.WRITE)
	if file == null:
		return
	file.store_string(JSON.stringify(data, "\t"))
	file.close()


func note_app_open() -> void:
	var now := int(Time.get_unix_time_from_system())
	if first_open_unix <= 0:
		first_open_unix = now
	app_open_count += 1
	save_prefs()


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


func _to_string_array(value: Variant) -> Array[String]:
	var result: Array[String] = []
	if typeof(value) != TYPE_ARRAY:
		return result
	for item in value:
		result.append(str(item))
	return result
