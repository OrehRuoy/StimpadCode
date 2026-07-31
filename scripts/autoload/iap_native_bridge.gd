extends Node
## IAP native bridge — wire GodotApplePlugins StoreKit (iOS) and Play Billing (Android).
## Product: com.stimpad.soundboard.plus ($4.99 non-consumable)
##
## iOS: install GodotApplePlugins StoreKit from CircuitSortCode release pin.
## Android: install compatible Play Billing GDExtension / AAR per PLUGIN_SETUP.md.
##
## Replace stub methods in iap_service.gd with calls into this bridge when plugins are linked.

const PRODUCT_ID := "com.stimpad.soundboard.plus"


func is_store_available() -> bool:
	return OS.has_feature("mobile") and (
		Engine.has_singleton("GodotApplePluginsStoreKit")
		or Engine.has_singleton("GodotIapPlugin")
	)


func request_plus_purchase() -> void:
	if Engine.has_singleton("GodotApplePluginsStoreKit"):
		# StoreKit 2 purchase flow (see CircuitSortCode scripts)
		pass
	elif Engine.has_singleton("GodotIapPlugin"):
		# Play Billing / cross-platform IAP
		pass


func restore_plus_purchase() -> Array:
	return []
