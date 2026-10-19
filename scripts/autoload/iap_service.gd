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
var _has_live_price: bool = false
var _ios_store: Node = null
var _ios_store_ready: bool = false
var _pending_purchase: bool = false
var _store_start_requested: bool = false
var _purchase_requested: bool = false
var _restore_requested: bool = false
var _billing: BillingClient = null
var _billing_ready: bool = false
var _billing_setup_running: bool = false
var _android_restore_after_setup: bool = false
var _android_price_value: float = 0.0
var _android_currency: String = ""
var _android_order_id: String = ""
var _pending_android_purchase: bool = false
var _android_purchase_pending: bool = false
var _android_purchase_timed_out: bool = false
var _purchase_query_lock: bool = false
var _ack_lock: bool = false


func _ready() -> void:
	## iOS: only start StoreKit when paywall/restore is used — auto-init at 12s coincided with post-home crashes.
	if OS.has_feature("mobile") and OS.get_name() == "iOS":
		return
	## Android billing waits until the boot overlay is gone.
	if Platform.is_android():
		return
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


func has_live_price() -> bool:
	return _has_live_price


func get_price_value() -> float:
	if Platform.is_android():
		return _android_price_value
	if _ios_store != null and _ios_store_ready:
		return float(_ios_store.get_price_value(PRODUCT_ID))
	return 0.0


func get_currency_code() -> String:
	if Platform.is_android():
		return _android_currency
	if _ios_store != null and _ios_store_ready:
		return str(_ios_store.get_currency_code(PRODUCT_ID))
	return ""


func get_last_transaction_id() -> String:
	if Platform.is_android():
		return _android_order_id
	if _ios_store != null and _ios_store_ready:
		return str(_ios_store.get_last_transaction_id())
	return ""


func purchase_plus() -> void:
	if Entitlements.has_plus():
		return
	ensure_store_started()
	_purchase_requested = true
	purchase_started.emit(PRODUCT_ID)
	if not OS.has_feature("mobile"):
		await get_tree().create_timer(0.4).timeout
		purchase_completed.emit(PRODUCT_ID)
		return
	if OS.get_name() == "iOS":
		_purchase_ios()
		return
	if Platform.is_android():
		_purchase_android()
		return
	_request_purchase_native(PRODUCT_ID)


func restore_purchases() -> void:
	ensure_store_started()
	_restore_requested = true
	if not OS.has_feature("mobile"):
		if Entitlements.has_plus():
			purchase_restored.emit([PRODUCT_ID])
		return
	if OS.get_name() == "iOS" and _ios_store != null:
		_ios_store.restore_purchases()
		return
	if Platform.is_android():
		_restore_android()
		return
	_restore_purchases_native()


func _initialize_store() -> void:
	if _ios_store != null or _billing != null:
		return
	if not OS.has_feature("mobile"):
		_ready_to_purchase = true
		return
	if OS.get_name() == "iOS":
		_init_ios_store()
		return
	if Platform.is_android():
		_init_android_billing()
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


func _on_ios_product_prices_updated() -> void:
	if _ios_store == null:
		return
	var price := str(_ios_store.get_display_price(PRODUCT_ID))
	if price.is_empty():
		return
	_display_price = price
	_has_live_price = true
	display_price_updated.emit(_display_price)


func _purchase_ios() -> void:
	if not _ready_to_purchase or not _ios_store_ready:
		purchase_failed.emit(PRODUCT_ID, tr("App Store not ready yet"))
		return
	_pending_purchase = true
	if not _ios_store.purchase_store_id(PRODUCT_ID):
		_pending_purchase = false
		purchase_failed.emit(PRODUCT_ID, tr("Product unavailable in App Store"))


func _on_ios_purchase_settled(
	internal_product_id: String,
	grant_rewards: bool,
	success: bool,
	reason: String
) -> void:
	if internal_product_id.is_empty():
		if _pending_purchase and not success:
			_pending_purchase = false
			purchase_failed.emit(PRODUCT_ID, reason if not reason.is_empty() else tr("Purchase failed"))
		return
	if internal_product_id != PRODUCT_ID:
		return
	if not success:
		if _pending_purchase:
			_pending_purchase = false
			purchase_failed.emit(PRODUCT_ID, reason if not reason.is_empty() else tr("Purchase failed"))
		return
	if grant_rewards:
		_pending_purchase = false
		_purchase_requested = false
		purchase_completed.emit(PRODUCT_ID)
	elif _restore_requested or _purchase_requested:
		## A paywall visit starts StoreKit, which can replay an old transaction.
		## That is not a purchase. Only Restore, or a buy the user just started,
		## may turn Plus on.
		purchase_restored.emit([PRODUCT_ID])


func _on_ios_restore_finished(success: bool, reason: String) -> void:
	if not success and not reason.is_empty():
		push_warning("IAPService: restore failed: %s" % reason)
	if _ios_store != null:
		_ios_store.refresh_entitlements()
	## Entitlement replay can arrive just after restore_finished.
	get_tree().create_timer(2.0).timeout.connect(func() -> void:
		_restore_requested = false
	, CONNECT_ONE_SHOT)


func _init_android_billing() -> void:
	_billing = BillingClient.new()
	_billing.name = "BillingClient"
	add_child(_billing)
	_billing.connected.connect(_on_billing_connected)
	_billing.connect_error.connect(_on_billing_connect_error)
	_billing.on_purchase_updated.connect(_on_android_purchase_updated)
	_billing.start_connection()


func _on_billing_connect_error(_response_code: int, debug_message: String) -> void:
	_billing_ready = false
	push_warning("IAPService billing connect error: %s" % debug_message)


func _on_billing_connected() -> void:
	if _billing_setup_running:
		return
	_billing_setup_running = true
	_run_billing_setup()


func _run_billing_setup() -> void:
	var owned := await _query_owned_purchases(false)
	if _billing == null:
		_billing_setup_running = false
		return
	var play_ids := PackedStringArray([PRODUCT_ID])
	_billing.query_product_details(play_ids, BillingClient.ProductType.INAPP)
	var details_result: Dictionary = await _billing.query_product_details_response
	if int(details_result.get("response_code", BillingClient.BillingResponseCode.ERROR)) == BillingClient.BillingResponseCode.OK:
		_billing_ready = true
		_cache_android_price(details_result.get("product_details", []))
	else:
		push_warning(
			"IAPService: product details query failed: %s"
			% str(details_result.get("debug_message", "unknown error"))
		)
	_billing_setup_running = false
	if _android_restore_after_setup:
		_android_restore_after_setup = false
		if not owned:
			await _query_owned_purchases(true)


func _purchase_android() -> void:
	if _billing == null or not _billing_ready:
		purchase_failed.emit(PRODUCT_ID, tr("Google Play not ready yet"))
		return
	_pending_android_purchase = true
	_android_purchase_pending = false
	_android_purchase_timed_out = false
	var result: Dictionary = _billing.purchase(PRODUCT_ID)
	var code := int(result.get("response_code", BillingClient.BillingResponseCode.ERROR))
	if code != BillingClient.BillingResponseCode.OK:
		_pending_android_purchase = false
		purchase_failed.emit(PRODUCT_ID, str(result.get("debug_message", tr("Purchase failed"))))
		return
	_monitor_android_purchase_timeout()


func _monitor_android_purchase_timeout() -> void:
	await get_tree().create_timer(90.0).timeout
	if not _pending_android_purchase or _android_purchase_pending:
		return
	_pending_android_purchase = false
	_android_purchase_timed_out = true
	purchase_failed.emit(PRODUCT_ID, tr("Purchase timed out"))


func _restore_android() -> void:
	if _billing == null or not _billing_ready:
		if _billing_setup_running:
			_android_restore_after_setup = true
			return
		purchase_failed.emit(PRODUCT_ID, tr("Google Play not ready yet"))
		return
	await _query_owned_purchases(true)


func _query_owned_purchases(report_empty: bool) -> bool:
	while _purchase_query_lock:
		await get_tree().process_frame
	_purchase_query_lock = true
	var owned := false
	if _billing == null:
		if report_empty:
			purchase_restored.emit([])
		_purchase_query_lock = false
		return false
	_billing.query_purchases(BillingClient.ProductType.INAPP)
	var result: Dictionary = await _billing.query_purchases_response
	if int(result.get("response_code", BillingClient.BillingResponseCode.ERROR)) == BillingClient.BillingResponseCode.OK:
		for purchase in result.get("purchases", []):
			if typeof(purchase) != TYPE_DICTIONARY:
				continue
			if await _apply_owned_purchase(purchase):
				owned = true
	if report_empty and not owned:
		purchase_restored.emit([])
	_purchase_query_lock = false
	return owned


func _apply_owned_purchase(purchase: Dictionary) -> bool:
	if not _purchase_contains_plus(purchase):
		return false
	var state := int(purchase.get("purchase_state", BillingClient.PurchaseState.UNSPECIFIED_STATE))
	if state != BillingClient.PurchaseState.PURCHASED:
		return false
	_remember_order_id(purchase)
	if not bool(purchase.get("is_acknowledged", false)):
		if not await _acknowledge_purchase(purchase):
			return false
	purchase_restored.emit([PRODUCT_ID])
	return true


func _on_android_purchase_updated(result: Dictionary) -> void:
	var code := int(result.get("response_code", BillingClient.BillingResponseCode.ERROR))
	if code == BillingClient.BillingResponseCode.USER_CANCELED:
		_pending_android_purchase = false
		_android_purchase_pending = false
		purchase_failed.emit(PRODUCT_ID, tr("Purchase canceled"))
		return
	if code == BillingClient.BillingResponseCode.ITEM_ALREADY_OWNED:
		_pending_android_purchase = false
		_android_purchase_pending = false
		_query_owned_purchases(true)
		return
	if code != BillingClient.BillingResponseCode.OK:
		if _purchase_list_has_pending(result.get("purchases", [])):
			_android_purchase_pending = true
			purchase_failed.emit(PRODUCT_ID, tr("Payment pending — Plus unlocks when Google Play confirms it"))
			return
		if _pending_android_purchase:
			_pending_android_purchase = false
			purchase_failed.emit(PRODUCT_ID, str(result.get("debug_message", tr("Purchase failed"))))
		return
	for purchase in result.get("purchases", []):
		if typeof(purchase) != TYPE_DICTIONARY:
			continue
		if not _purchase_contains_plus(purchase):
			continue
		var state := int(purchase.get("purchase_state", BillingClient.PurchaseState.UNSPECIFIED_STATE))
		if state == BillingClient.PurchaseState.PENDING:
			_android_purchase_pending = true
			purchase_failed.emit(PRODUCT_ID, tr("Payment pending — Plus unlocks when Google Play confirms it"))
			continue
		if state != BillingClient.PurchaseState.PURCHASED:
			continue
		_finish_android_purchase(purchase)


func _finish_android_purchase(purchase: Dictionary) -> void:
	_remember_order_id(purchase)
	if not bool(purchase.get("is_acknowledged", false)):
		if not await _acknowledge_purchase(purchase):
			if _pending_android_purchase and not _android_purchase_timed_out:
				_pending_android_purchase = false
				purchase_failed.emit(PRODUCT_ID, tr("Purchase failed"))
			return
	if _android_purchase_timed_out:
		return
	_pending_android_purchase = false
	_android_purchase_pending = false
	purchase_completed.emit(PRODUCT_ID)


func _acknowledge_purchase(purchase: Dictionary) -> bool:
	var token := str(purchase.get("purchase_token", ""))
	if token.is_empty() or _billing == null:
		return false
	while _ack_lock:
		await get_tree().process_frame
	_ack_lock = true
	_billing.acknowledge_purchase(token)
	var result: Dictionary = await _billing.acknowledge_purchase_response
	var ok := int(result.get("response_code", BillingClient.BillingResponseCode.ERROR)) == BillingClient.BillingResponseCode.OK
	_ack_lock = false
	return ok


func _purchase_contains_plus(purchase: Dictionary) -> bool:
	var ids: Variant = purchase.get("product_ids", [])
	if ids is Array or ids is PackedStringArray:
		for product_id in ids:
			if str(product_id) == PRODUCT_ID:
				return true
	return str(purchase.get("product_id", "")) == PRODUCT_ID


func _purchase_list_has_pending(purchases: Variant) -> bool:
	if not (purchases is Array):
		return false
	for purchase in purchases:
		if typeof(purchase) != TYPE_DICTIONARY:
			continue
		if not _purchase_contains_plus(purchase):
			continue
		if int(purchase.get("purchase_state", -1)) == BillingClient.PurchaseState.PENDING:
			return true
	return false


func _remember_order_id(purchase: Dictionary) -> void:
	var order := str(purchase.get("order_id", ""))
	if not order.is_empty():
		_android_order_id = order


func _cache_android_price(product_details: Variant) -> void:
	if not (product_details is Array):
		return
	for entry in product_details:
		if typeof(entry) != TYPE_DICTIONARY:
			continue
		var detail: Dictionary = entry
		var play_id := str(detail.get("product_id", detail.get("id", "")))
		if not play_id.is_empty() and play_id != PRODUCT_ID:
			continue
		var price := _extract_formatted_price(detail)
		if price.is_empty():
			continue
		_display_price = price
		_has_live_price = true
		var offer: Variant = detail.get("one_time_purchase_offer_details", null)
		if offer is Dictionary:
			var micros := float((offer as Dictionary).get("price_amount_micros", 0))
			_android_price_value = micros / 1000000.0
			_android_currency = str((offer as Dictionary).get("price_currency_code", ""))
		display_price_updated.emit(_display_price)
		return


func _extract_formatted_price(detail: Dictionary) -> String:
	var offer: Variant = detail.get("one_time_purchase_offer_details", null)
	if offer is Dictionary:
		var price := str((offer as Dictionary).get("formatted_price", ""))
		if not price.is_empty():
			return price
	var offer_list: Variant = detail.get("one_time_purchase_offer_details_list", null)
	if offer_list is Array:
		for item in offer_list:
			if item is Dictionary:
				var list_price := str((item as Dictionary).get("formatted_price", ""))
				if not list_price.is_empty():
					return list_price
	return str(detail.get("formatted_price", detail.get("price", "")))


func _request_purchase_native(product_id: String) -> void:
	if not _ready_to_purchase:
		purchase_failed.emit(product_id, tr("Store not ready"))
		return
	purchase_failed.emit(product_id, tr("IAP not linked for this platform yet"))


func _restore_purchases_native() -> void:
	if not _ready_to_purchase:
		purchase_failed.emit(PRODUCT_ID, tr("Store not ready"))
		return
	purchase_restored.emit([])
