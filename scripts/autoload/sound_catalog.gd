extends Node

signal catalog_loaded

const CATALOG_PATH := "res://data/sounds.json"

var sounds: Array[Dictionary] = []
var categories: Array[String] = []


func _ready() -> void:
	load_catalog()


func load_catalog() -> void:
	sounds.clear()
	categories.clear()
	var file := FileAccess.open(CATALOG_PATH, FileAccess.READ)
	if file == null:
		push_error("Failed to open sound catalog: %s" % CATALOG_PATH)
		return
	var parsed: Variant = JSON.parse_string(file.get_as_text())
	file.close()
	if typeof(parsed) != TYPE_DICTIONARY:
		push_error("Invalid sound catalog JSON")
		return
	var entries: Array = parsed.get("sounds", [])
	var preferred := [
		"Alarms", "Bells", "Household", "Clicks", "Vehicles", "Water",
		"Noise", "Nature", "Animals", "Tools", "Retro", "Misc"
	]
	for entry in entries:
		if typeof(entry) != TYPE_DICTIONARY:
			continue
		sounds.append(entry)
		var category: String = str(entry.get("category", "Misc"))
		if category not in categories:
			categories.append(category)
	categories.sort_custom(func(a: String, b: String) -> bool:
		var ia := preferred.find(a)
		var ib := preferred.find(b)
		if ia < 0:
			ia = 100
		if ib < 0:
			ib = 100
		if ia == ib:
			return a < b
		return ia < ib
	)
	catalog_loaded.emit()


func get_all_sounds() -> Array[Dictionary]:
	return _sorted_free_first(sounds)


func get_sound_by_id(sound_id: String) -> Dictionary:
	for sound in sounds:
		if str(sound.get("id", "")) == sound_id:
			return sound
	return {}


func get_sounds_for_category(category: String) -> Array[Dictionary]:
	if category.is_empty() or category == "All":
		return get_all_sounds()
	if category == "Free":
		return get_free_sounds()
	var filtered: Array[Dictionary] = []
	for sound in sounds:
		if str(sound.get("category", "")) == category:
			filtered.append(sound)
	return _sorted_free_first(filtered)


func get_favorite_sounds(favorite_ids: Array) -> Array[Dictionary]:
	var favs: Array[Dictionary] = []
	for sound in sounds:
		if str(sound.get("id", "")) in favorite_ids:
			favs.append(sound)
	return _sorted_free_first(favs)


func is_sound_unlocked(sound: Dictionary) -> bool:
	if str(sound.get("tier", "plus")) == "free" or Entitlements.has_plus():
		return true
	return Entitlements.is_temp_unlocked(str(sound.get("id", "")))


func get_free_sounds() -> Array[Dictionary]:
	var free_list: Array[Dictionary] = []
	for sound in sounds:
		if str(sound.get("tier", "")) == "free":
			free_list.append(sound)
	return free_list


func _sorted_free_first(source: Array) -> Array[Dictionary]:
	var free_list: Array[Dictionary] = []
	var plus_list: Array[Dictionary] = []
	for entry in source:
		if typeof(entry) != TYPE_DICTIONARY:
			continue
		if str(entry.get("tier", "")) == "free":
			free_list.append(entry)
		else:
			plus_list.append(entry)
	var out: Array[Dictionary] = []
	out.append_array(free_list)
	out.append_array(plus_list)
	return out
