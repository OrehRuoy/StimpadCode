extends Node

signal purchase_started(product_id: String)
signal purchase_completed(product_id: String)
signal purchase_failed(product_id: String, reason: String)
signal purchase_restored(product_ids: Array)

const PRODUCT_ID := "com.stimpad.soundboard.plus"
const DISPLAY_PRICE := "$4.99"

var _ready_to_purchase: bool = false


func _ready() -> void:
	call_deferred("_initialize_store")


func get_product_id() -> String:
	return PRODUCT_ID


func purchase_plus() -> void:
	if Entitlements.has_plus():
		return
	purchase_started.emit(PRODUCT_ID)
	if not OS.has_feature("mobile"):
		# Editor/desktop simulation for testing.
		await get_tree().create_timer(0.4).timeout
		purchase_completed.emit(PRODUCT_ID)
		return
	_request_purchase_native(PRODUCT_ID)


func restore_purchases() -> void:
	if not OS.has_feature("mobile"):
		if Entitlements.has_plus():
			purchase_restored.emit([PRODUCT_ID])
		return
	_restore_purchases_native()


func _initialize_store() -> void:
	if not OS.has_feature("mobile"):
		_ready_to_purchase = true
		return
	# Hook: GodotApplePlugins StoreKit (iOS) / Play Billing (Android).
	_ready_to_purchase = true


func _request_purchase_native(product_id: String) -> void:
	if not _ready_to_purchase:
		purchase_failed.emit(product_id, "Store not ready")
		return
	# Hook: IAP plugin request_purchase(product_id)
	purchase_failed.emit(product_id, "IAP plugin not linked in this build")


func _restore_purchases_native() -> void:
	if not _ready_to_purchase:
		purchase_failed.emit(PRODUCT_ID, "Store not ready")
		return
	# Hook: IAP plugin restore / get_available_purchases
	purchase_restored.emit([])
