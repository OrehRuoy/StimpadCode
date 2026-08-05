extends Node

const PREFS_PATH := "user://stimpad_prefs.json"

var favorites: Array[String] = []
var last_scope: String = "All" ## All | Free | Favorites
var last_sound_category: String = "All" ## All | Alarms | Bells | ...
var session_duration_sec: int = 60


func _ready() -> void:
	load_prefs()


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
	session_duration_sec = int(parsed.get("session_duration_sec", 60))
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
		"last_scope": last_scope,
		"last_sound_category": last_sound_category,
		"session_duration_sec": session_duration_sec,
	}
	var file := FileAccess.open(PREFS_PATH, FileAccess.WRITE)
	if file == null:
		return
	file.store_string(JSON.stringify(data, "\t"))
	file.close()


func toggle_favorite(sound_id: String) -> void:
	if sound_id in favorites:
		favorites.erase(sound_id)
	else:
		favorites.append(sound_id)
	save_prefs()


func is_favorite(sound_id: String) -> bool:
	return sound_id in favorites


func _to_string_array(value: Variant) -> Array[String]:
	var result: Array[String] = []
	if typeof(value) != TYPE_ARRAY:
		return result
	for item in value:
		result.append(str(item))
	return result
