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
	for entry in entries:
		if typeof(entry) != TYPE_DICTIONARY:
			continue
		sounds.append(entry)
		var category: String = str(entry.get("category", "Misc"))
		if category not in categories:
			categories.append(category)
	categories.sort()
	catalog_loaded.emit()


func get_all_sounds() -> Array[Dictionary]:
	return sounds


func get_sound_by_id(sound_id: String) -> Dictionary:
	for sound in sounds:
		if str(sound.get("id", "")) == sound_id:
			return sound
	return {}


func get_sounds_for_category(category: String) -> Array[Dictionary]:
	if category.is_empty() or category == "All":
		return sounds
	var filtered: Array[Dictionary] = []
	for sound in sounds:
		if str(sound.get("category", "")) == category:
			filtered.append(sound)
	return filtered


func get_favorite_sounds(favorite_ids: Array) -> Array[Dictionary]:
	var favs: Array[Dictionary] = []
	for sound in sounds:
		if str(sound.get("id", "")) in favorite_ids:
			favs.append(sound)
	return favs


func is_sound_unlocked(sound: Dictionary) -> bool:
	return str(sound.get("tier", "plus")) == "free" or Entitlements.has_plus()


func get_free_sounds() -> Array[Dictionary]:
	var free_list: Array[Dictionary] = []
	for sound in sounds:
		if str(sound.get("tier", "")) == "free":
			free_list.append(sound)
	return free_list
