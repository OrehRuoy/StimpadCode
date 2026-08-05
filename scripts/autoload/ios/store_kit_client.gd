extends Node
## StoreKit 2 adapter for GodotApplePlugins (StoreKitManager).
## Safe no-op when the extension is not installed (Windows editor / Android builds).

signal store_ready
signal product_prices_updated
signal purchase_settled(internal_product_id: String, grant_rewards: bool, success: bool, reason: String)
signal restore_finished(success: bool, reason: String)

const _MANAGER_CLASS := "StoreKitManager"
const _STATUS_OK := 0
const _STATUS_CANCELLED := 2
const _STATUS_USER_CANCELLED := 4

var _manager: RefCounted = null
var _products_by_store_id: Dictionary = {}
var _internal_for_store_id: Dictionary = {}
var _ready := false


func is_available() -> bool:
	return ClassDB.class_exists(_MANAGER_CLASS)


func is_ready() -> bool:
	return _ready


func start(store_product_ids: Dictionary) -> void:
	if not OS.has_feature("ios") or Engine.is_editor_hint():
		return
	if not is_available():
		push_warning("StoreKitClient: %s not found — install GodotApplePlugins on Mac export." % _MANAGER_CLASS)
		return
	_internal_for_store_id.clear()
	for internal_id in store_product_ids:
		var store_id := str(store_product_ids[internal_id]).strip_edges()
		if store_id.is_empty():
			continue
		_internal_for_store_id[store_id] = str(internal_id)
	_manager = ClassDB.instantiate(_MANAGER_CLASS)
	if _manager == null:
		push_warning("StoreKitClient: failed to instantiate %s" % _MANAGER_CLASS)
		return
	if _manager.has_signal("products_request_completed"):
		_manager.products_request_completed.connect(_on_products_request_completed)
	if _manager.has_signal("purchase_completed"):
		_manager.purchase_completed.connect(_on_purchase_completed)
	if _manager.has_signal("transaction_updated"):
		_manager.transaction_updated.connect(_on_transaction_updated)
	if _manager.has_signal("restore_completed"):
		_manager.restore_completed.connect(_on_restore_completed)
	if _manager.has_method("start"):
		_manager.start()
	var ids := PackedStringArray()
	for store_id in _internal_for_store_id:
		ids.append(store_id)
	if ids.is_empty():
		return
	_manager.request_products(ids)


func get_display_price(internal_product_id: String) -> String:
	for store_id in _products_by_store_id:
		if _internal_for_store_id.get(store_id, "") == internal_product_id:
			var product: Variant = _products_by_store_id[store_id]
			if product != null and product.has_method("get_display_price"):
				return str(product.get_display_price())
			if product != null and "display_price" in product:
				return str(product.display_price)
	return ""


func purchase_store_id(store_product_id: String) -> bool:
	if _manager == null or not _ready:
		return false
	var product: Variant = _products_by_store_id.get(store_product_id, null)
	if product == null:
		return false
	if _manager.has_method("purchase"):
		_manager.purchase(product)
		return true
	return false


func restore_purchases() -> void:
	if _manager == null:
		restore_finished.emit(false, "Store not available")
		return
	if _manager.has_method("restore_purchases"):
		_manager.restore_purchases()
		return
	if _manager.has_method("fetch_current_entitlements"):
		_manager.fetch_current_entitlements()
		restore_finished.emit(true, "")
		return
	restore_finished.emit(false, "Restore not supported")


func refresh_entitlements() -> void:
	if _manager != null and _manager.has_method("fetch_current_entitlements"):
		_manager.fetch_current_entitlements()


func _on_products_request_completed(products: Array, status: int) -> void:
	if status != _STATUS_OK:
		push_warning("StoreKitClient: product request failed (status %d)" % status)
		return
	_products_by_store_id.clear()
	for entry in products:
		if entry == null:
			continue
		var store_id := ""
		if entry.has_method("get_product_id"):
			store_id = str(entry.get_product_id())
		elif "product_id" in entry:
			store_id = str(entry.product_id)
		if store_id.is_empty():
			continue
		_products_by_store_id[store_id] = entry
	_ready = true
	store_ready.emit()
	product_prices_updated.emit()
	if _manager.has_method("fetch_current_entitlements"):
		_manager.fetch_current_entitlements()


func _on_purchase_completed(_transaction: Variant, status: int, error_message: String) -> void:
	var internal_id := _internal_id_from_transaction(_transaction)
	var grant := status == _STATUS_OK
	var reason := error_message
	if status == _STATUS_CANCELLED or status == _STATUS_USER_CANCELLED:
		reason = "Purchase canceled"
	if internal_id.is_empty():
		purchase_settled.emit("", false, false, reason if not reason.is_empty() else "Unknown product")
		return
	purchase_settled.emit(internal_id, grant, grant, reason)
	if grant:
		_finish_transaction(_transaction)


func _on_transaction_updated(transaction: Variant) -> void:
	var internal_id := _internal_id_from_transaction(transaction)
	if internal_id.is_empty():
		_finish_transaction(transaction)
		return
	purchase_settled.emit(internal_id, false, true, "")
	_finish_transaction(transaction)


func _on_restore_completed(status: int, error_message: String) -> void:
	var ok := status == _STATUS_OK
	restore_finished.emit(ok, error_message)
	if _manager != null and _manager.has_method("fetch_current_entitlements"):
		_manager.fetch_current_entitlements()


func _internal_id_from_transaction(transaction: Variant) -> String:
	if transaction == null:
		return ""
	var store_id := ""
	if transaction.has_method("get_product_id"):
		store_id = str(transaction.get_product_id())
	elif "product_id" in transaction:
		store_id = str(transaction.product_id)
	if store_id.is_empty():
		return ""
	return str(_internal_for_store_id.get(store_id, ""))


func _finish_transaction(transaction: Variant) -> void:
	if transaction != null and transaction.has_method("finish"):
		transaction.finish()
