extends Control

@onready var _buy_btn: Button = $Margin/VBox/BuyBtn
@onready var _restore_btn: Button = $Margin/VBox/RestoreBtn
@onready var _back_btn: Button = $Margin/VBox/BackBtn
@onready var _status: Label = $Margin/VBox/StatusLabel


func _ready() -> void:
	_buy_btn.text = "Unlock StimPad Plus — %s" % IAPService.DISPLAY_PRICE
	_buy_btn.pressed.connect(_on_buy)
	_restore_btn.pressed.connect(_on_restore)
	_back_btn.pressed.connect(_on_back)
	IAPService.purchase_completed.connect(_on_purchase_done)
	IAPService.purchase_restored.connect(_on_restored)
	IAPService.purchase_failed.connect(_on_failed)
	Entitlements.plus_changed.connect(func(_v): _refresh())
	_refresh()


func _refresh() -> void:
	if Entitlements.has_plus():
		_status.text = "You have StimPad Plus. All sounds unlocked, ads removed."
		_buy_btn.disabled = true
	else:
		_status.text = "Unlock 40+ stim sounds and remove ads."
		_buy_btn.disabled = false


func _on_buy() -> void:
	IAPService.purchase_plus()


func _on_restore() -> void:
	IAPService.restore_purchases()


func _on_purchase_done(_product_id: String) -> void:
	_refresh()
	get_tree().get_first_node_in_group("main_nav").call("show_home")


func _on_restored(product_ids: Array) -> void:
	if product_ids.is_empty():
		_status.text = "No purchases found to restore."
	else:
		_status.text = "Purchase restored."
		_refresh()


func _on_failed(_product_id: String, reason: String) -> void:
	_status.text = "Purchase failed: %s" % reason


func _on_back() -> void:
	get_tree().get_first_node_in_group("main_nav").call("show_home")
