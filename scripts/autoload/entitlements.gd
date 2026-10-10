extends Node

signal plus_changed(is_plus: bool)
signal temp_unlocks_changed
signal library_unlock_ended(reason: String)

const ENTITLEMENTS_PATH := "user://stimpad_entitlements.json"
const PRODUCT_ID := "com.stimpad.soundboard.plus"
const LIBRARY_UNLOCK_SEC := 20 * 60
## Opening the paywall used to replay a StoreKit transaction and save Plus,
## and a stuck 20-minute window hid Watch Ad. Epoch 2 forgets that once.
const ENTITLEMENT_EPOCH := 2

var _has_plus: bool = false


func _ready() -> void:
	load_state()
	IAPService.purchase_restored.connect(_on_purchase_restored)
	IAPService.purchase_completed.connect(_on_purchase_completed)
	if LocalPrefs.library_unlock_until_unix > 0 and int(Time.get_unix_time_from_system()) >= LocalPrefs.library_unlock_until_unix:
		LocalPrefs.library_unlock_until_unix = 0
		LocalPrefs.library_unlock_started_unix = 0
		LocalPrefs.save_prefs()
	elif _window_still_valid():
		set_process(true)


func has_plus() -> bool:
	return _has_plus


func grant_plus() -> void:
	if _has_plus:
		return
	var window_was_active := _window_still_valid()
	_has_plus = true
	save_state()
	plus_changed.emit(true)
	AdsService.set_ads_enabled(false)
	if window_was_active:
		_end_library_unlock("plus_purchased")
	else:
		temp_unlocks_changed.emit()


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
	return not sound_id.is_empty() and is_library_unlocked()


func is_library_unlocked() -> bool:
	if _has_plus:
		return false
	if _clock_changed():
		_end_library_unlock("clock_changed")
		return false
	return LocalPrefs.library_unlock_until_unix > int(Time.get_unix_time_from_system())


func library_unlock_seconds_left() -> int:
	if not is_library_unlocked():
		return 0
	return maxi(0, LocalPrefs.library_unlock_until_unix - int(Time.get_unix_time_from_system()))


func can_start_library_unlock() -> bool:
	return not _has_plus and not is_library_unlocked() and LocalPrefs.library_unlock_last_day != _today_key()


func library_used_today() -> bool:
	return LocalPrefs.library_unlock_last_day == _today_key()


func grant_library_unlock() -> void:
	if _has_plus:
		return
	var now := int(Time.get_unix_time_from_system())
	LocalPrefs.library_unlock_started_unix = now
	LocalPrefs.library_unlock_until_unix = now + LIBRARY_UNLOCK_SEC
	LocalPrefs.library_unlock_last_day = _today_key()
	LocalPrefs.save_prefs()
	set_process(true)
	temp_unlocks_changed.emit()


func _today_key() -> String:
	var d := Time.get_date_dict_from_system()
	return "%04d-%02d-%02d" % [int(d.year), int(d.month), int(d.day)]


func _window_still_valid() -> bool:
	var now := int(Time.get_unix_time_from_system())
	if LocalPrefs.library_unlock_until_unix <= now:
		return false
	if _clock_changed():
		return false
	return true


func _clock_changed() -> bool:
	var now := int(Time.get_unix_time_from_system())
	var started := LocalPrefs.library_unlock_started_unix
	var until := LocalPrefs.library_unlock_until_unix
	if until <= 0:
		return false
	if now < started - 5:
		return true
	if until - now > LIBRARY_UNLOCK_SEC + 5:
		return true
	return false


func _end_library_unlock(reason: String) -> void:
	LocalPrefs.library_unlock_until_unix = 0
	LocalPrefs.library_unlock_started_unix = 0
	LocalPrefs.save_prefs()
	set_process(false)
	temp_unlocks_changed.emit()
	library_unlock_ended.emit(reason)
	AnalyticsService.log_event("library_unlock_ended", {"reason": reason})


func _process(_delta: float) -> void:
	var now := int(Time.get_unix_time_from_system())
	if _clock_changed():
		_end_library_unlock("clock_changed")
	elif now >= LocalPrefs.library_unlock_until_unix:
		_end_library_unlock("expired")


func _notification(what: int) -> void:
	if what == NOTIFICATION_APPLICATION_RESUMED or what == NOTIFICATION_APPLICATION_FOCUS_IN:
		if LocalPrefs.library_unlock_until_unix > 0:
			_process(0.0)


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
	var epoch := int(parsed.get("epoch", 1))
	if epoch < ENTITLEMENT_EPOCH:
		_has_plus = false
		LocalPrefs.clear_library_unlock()
		save_state()
		call_deferred("_enable_ads_after_reset")
		return
	if _has_plus:
		AdsService.set_ads_enabled(false)


func _enable_ads_after_reset() -> void:
	AdsService.set_ads_enabled(true)


func save_state() -> void:
	var file := FileAccess.open(ENTITLEMENTS_PATH, FileAccess.WRITE)
	if file == null:
		return
	file.store_string(JSON.stringify({
		"has_plus": _has_plus,
		"epoch": ENTITLEMENT_EPOCH,
	}))
	file.close()


func _on_purchase_completed(product_id: String) -> void:
	if product_id == PRODUCT_ID:
		grant_plus()
		## GA4 / Google Ads conversion signals (link Firebase ↔ Google Ads in console).
		var purchase := {
			"item_id": PRODUCT_ID,
			"item_name": "StimPad Plus",
		}
		var transaction_id := IAPService.get_last_transaction_id()
		if not transaction_id.is_empty():
			purchase["transaction_id"] = transaction_id
		if IAPService.has_live_price() and IAPService.get_price_value() > 0.0 and not IAPService.get_currency_code().is_empty():
			purchase["value"] = IAPService.get_price_value()
			purchase["currency"] = IAPService.get_currency_code()
		elif IAPService.has_live_price():
			purchase["price_display"] = IAPService.get_display_price()
		AnalyticsService.log_event("purchase", purchase)
		AnalyticsService.log_event("plus_unlocked", {
			"product_id": PRODUCT_ID,
			"source": "purchase",
		})


func _on_purchase_restored(product_ids: Array) -> void:
	for product_id in product_ids:
		if str(product_id) == PRODUCT_ID:
			grant_plus()
			AnalyticsService.log_event("plus_unlocked", {
				"product_id": PRODUCT_ID,
				"source": "restore",
			})
			return
