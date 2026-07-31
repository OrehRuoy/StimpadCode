extends Node

signal plus_changed(is_plus: bool)

const ENTITLEMENTS_PATH := "user://stimpad_entitlements.json"
const PRODUCT_ID := "com.stimpad.soundboard.plus"

var _has_plus: bool = false


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
	save_state()
	plus_changed.emit(true)
	AdsService.set_ads_enabled(false)


func revoke_plus_for_debug() -> void:
	_has_plus = false
	save_state()
	plus_changed.emit(false)
	AdsService.set_ads_enabled(true)


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
	if _has_plus:
		AdsService.set_ads_enabled(false)


func save_state() -> void:
	var file := FileAccess.open(ENTITLEMENTS_PATH, FileAccess.WRITE)
	if file == null:
		return
	file.store_string(JSON.stringify({"has_plus": _has_plus}))
	file.close()


func _on_purchase_completed(product_id: String) -> void:
	if product_id == PRODUCT_ID:
		grant_plus()


func _on_purchase_restored(product_ids: Array) -> void:
	for product_id in product_ids:
		if str(product_id) == PRODUCT_ID:
			grant_plus()
			return
