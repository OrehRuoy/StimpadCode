extends Node

signal plus_changed(is_plus: bool)
signal temp_unlocks_changed

const ENTITLEMENTS_PATH := "user://stimpad_entitlements.json"
const PRODUCT_ID := "com.stimpad.soundboard.plus"

var _has_plus: bool = false
## sound_id -> local calendar day key "YYYY-MM-DD" (unlock lasts for that day).
var _temp_unlocks: Dictionary = {}


func _ready() -> void:
	load_state()
	IAPService.purchase_restored.connect(_on_purchase_restored)
	IAPService.purchase_completed.connect(_on_purchase_completed)


func has_plus() -> bool:
	return _has_plus


func grant_plus() -> void:
	if _has_plus:
		return
	_has_plus = true
	_temp_unlocks.clear()
	save_state()
	plus_changed.emit(true)
	temp_unlocks_changed.emit()
	AdsService.set_ads_enabled(false)


func revoke_plus_for_debug() -> void:
	_has_plus = false
	save_state()
	plus_changed.emit(false)
	AdsService.set_ads_enabled(true)


## Desktop / debug helper: flip Plus on or off without going through the store.
func set_plus_for_debug(enabled: bool) -> void:
	if enabled:
		grant_plus()
	else:
		revoke_plus_for_debug()


func is_temp_unlocked(sound_id: String) -> bool:
	if sound_id.is_empty() or _has_plus:
		return false
	_prune_expired_temp_unlocks()
	return str(_temp_unlocks.get(sound_id, "")) == _today_key()


func grant_temp_unlock(sound_id: String) -> void:
	if sound_id.is_empty() or _has_plus:
		return
	_temp_unlocks[sound_id] = _today_key()
	save_state()
	temp_unlocks_changed.emit()


func _today_key() -> String:
	var d := Time.get_date_dict_from_system()
	return "%04d-%02d-%02d" % [int(d.year), int(d.month), int(d.day)]


func _prune_expired_temp_unlocks() -> void:
	var today := _today_key()
	var changed := false
	var keep: Dictionary = {}
	for sound_id in _temp_unlocks.keys():
		if str(_temp_unlocks[sound_id]) == today:
			keep[sound_id] = _temp_unlocks[sound_id]
		else:
			changed = true
	if changed:
		_temp_unlocks = keep
		save_state()
		temp_unlocks_changed.emit()


func load_state() -> void:
	if not FileAccess.file_exists(ENTITLEMENTS_PATH):
		return
	var file := FileAccess.open(ENTITLEMENTS_PATH, FileAccess.READ)
	if file == null:
		return
	var parsed: Variant = JSON.parse_string(file.get_as_text())
	file.close()
	if typeof(parsed) != TYPE_DICTIONARY:
		return
	_has_plus = bool(parsed.get("has_plus", false))
	var temps: Variant = parsed.get("temp_unlocks", {})
	if typeof(temps) == TYPE_DICTIONARY:
		_temp_unlocks = temps
	_prune_expired_temp_unlocks()
	if _has_plus:
		AdsService.set_ads_enabled(false)


func save_state() -> void:
	var file := FileAccess.open(ENTITLEMENTS_PATH, FileAccess.WRITE)
	if file == null:
		return
	file.store_string(
		JSON.stringify({"has_plus": _has_plus, "temp_unlocks": _temp_unlocks})
	)
	file.close()


func _on_purchase_completed(product_id: String) -> void:
	if product_id == PRODUCT_ID:
		grant_plus()


func _on_purchase_restored(product_ids: Array) -> void:
	for product_id in product_ids:
		if str(product_id) == PRODUCT_ID:
			grant_plus()
			return
