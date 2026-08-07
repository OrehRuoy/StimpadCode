extends Node

signal purchase_started(product_id: String)
signal purchase_completed(product_id: String)
signal purchase_failed(product_id: String, reason: String)
signal purchase_restored(product_ids: Array)
signal display_price_updated(price: String)

const PRODUCT_ID := "com.stimpad.soundboard.plus"
const DISPLAY_PRICE := "$4.99"
const _IOS_STORE_SCRIPT := preload("res://scripts/autoload/ios/store_kit_client.gd")
const _IOS_PRODUCT_IDS := {PRODUCT_ID: PRODUCT_ID}

var _ready_to_purchase: bool = false
var _display_price: String = DISPLAY_PRICE
var _ios_store: Node = null
var _ios_store_ready: bool = false
var _pending_purchase: bool = false
var _store_start_requested: bool = false


func _ready() -> void:
	## Delay StoreKit until UI is up / paywall opens — avoids native work during boot spike.
	if OS.has_feature("mobile") and OS.get_name() == "iOS":
		get_tree().create_timer(12.0).timeout.connect(ensure_store_started, CONNECT_ONE_SHOT)
	else:
		call_deferred("_initialize_store")


func ensure_store_started() -> void:
	if _store_start_requested:
		return
	_store_start_requested = true
	_initialize_store()


func get_product_id() -> String:
	return PRODUCT_ID


func get_display_price() -> String:
	return _display_price


func purchase_plus() -> void:
	if Entitlements.has_plus():
		return
	ensure_store_started()
	purchase_started.emit(PRODUCT_ID)
	if not OS.has_feature("mobile"):
		await get_tree().create_timer(0.4).timeout
		purchase_completed.emit(PRODUCT_ID)
		return
	if OS.get_name() == "iOS":
		_purchase_ios()
		return
	_request_purchase_native(PRODUCT_ID)


func restore_purchases() -> void:
	ensure_store_started()
	if not OS.has_feature("mobile"):
		if Entitlements.has_plus():
			purchase_restored.emit([PRODUCT_ID])
		return
	if OS.get_name() == "iOS" and _ios_store != null:
		_ios_store.restore_purchases()
		return
	_restore_purchases_native()


func _initialize_store() -> void:
	if _ios_store != null:
		return
	if not OS.has_feature("mobile"):
		_ready_to_purchase = true
		return
	if OS.get_name() == "iOS":
		_init_ios_store()
		return
	_ready_to_purchase = true


func _init_ios_store() -> void:
	_ios_store = _IOS_STORE_SCRIPT.new()
	_ios_store.name = "StoreKitClient"
	add_child(_ios_store)
	_ios_store.store_ready.connect(_on_ios_store_ready)
	_ios_store.product_prices_updated.connect(_on_ios_product_prices_updated)
	_ios_store.purchase_settled.connect(_on_ios_purchase_settled)
	_ios_store.restore_finished.connect(_on_ios_restore_finished)
	_ios_store.start(_IOS_PRODUCT_IDS)
	if not _ios_store.is_available():
		push_warning("IAPService: StoreKit plugin not installed — iOS purchases disabled in this build")
		_ready_to_purchase = false


func _on_ios_store_ready() -> void:
	_ios_store_ready = true
	_ready_to_purchase = true
	_on_ios_product_prices_updated()
	if _ios_store != null:
		_ios_store.refresh_entitlements()


func _on_ios_product_prices_updated() -> void:
	if _ios_store == null:
		return
	var price := str(_ios_store.get_display_price(PRODUCT_ID))
	if price.is_empty():
		return
	_display_price = price
	display_price_updated.emit(_display_price)


func _purchase_ios() -> void:
	if not _ready_to_purchase or not _ios_store_ready:
		purchase_failed.emit(PRODUCT_ID, "App Store not ready yet")
		return
	_pending_purchase = true
	if not _ios_store.purchase_store_id(PRODUCT_ID):
		_pending_purchase = false
		purchase_failed.emit(PRODUCT_ID, "Product unavailable in App Store")


func _on_ios_purchase_settled(
	internal_product_id: String,
	grant_rewards: bool,
	success: bool,
	reason: String
) -> void:
	if internal_product_id.is_empty():
		if _pending_purchase and not success:
			_pending_purchase = false
			purchase_failed.emit(PRODUCT_ID, reason if not reason.is_empty() else "Purchase failed")
		return
	if internal_product_id != PRODUCT_ID:
		return
	if not success:
		if _pending_purchase:
			_pending_purchase = false
			purchase_failed.emit(PRODUCT_ID, reason if not reason.is_empty() else "Purchase failed")
		return
	if grant_rewards:
		_pending_purchase = false
		purchase_completed.emit(PRODUCT_ID)
	else:
		purchase_restored.emit([PRODUCT_ID])


func _on_ios_restore_finished(success: bool, reason: String) -> void:
	if not success and not reason.is_empty():
		push_warning("IAPService: restore failed: %s" % reason)
	if _ios_store != null:
		_ios_store.refresh_entitlements()


func _request_purchase_native(product_id: String) -> void:
	if not _ready_to_purchase:
		purchase_failed.emit(product_id, "Store not ready")
		return
	purchase_failed.emit(product_id, "IAP not linked for this platform yet")


func _restore_purchases_native() -> void:
	if not _ready_to_purchase:
		purchase_failed.emit(PRODUCT_ID, "Store not ready")
		return
	purchase_restored.emit([])
