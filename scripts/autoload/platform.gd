extends Node
## Cross-platform helpers. Branch new code here; leave existing OS checks alone.

const STORE_PLAY := "play"
const STORE_APP_STORE := "app_store"

const _OS_ANDROID := "Android"
const _OS_IOS := "iOS"


func is_android() -> bool:
	return OS.get_name() == _OS_ANDROID


func is_ios() -> bool:
	return OS.get_name() == _OS_IOS


func is_mobile() -> bool:
	return is_android() or is_ios()


func store_name() -> String:
	if is_ios():
		return STORE_APP_STORE
	if is_android():
		return STORE_PLAY
	return ""


func supports_billing() -> bool:
	return is_android() or is_ios()


func supports_ads() -> bool:
	return is_android() or is_ios()


func supports_analytics() -> bool:
	return is_android() or is_ios()


func supports_in_app_review() -> bool:
	return is_android() or is_ios()


## Settings / paywall disclaimer for the current store.
## StimPad Plus is a one-time purchase, not a subscription.
func billing_disclaimer_text() -> String:
	if is_ios():
		return tr("One-time purchase through the App Store. Restore it on any device signed into the same Apple ID.")
	if is_android():
		return tr("One-time purchase through Google Play. Restore it on any device signed into the same Google account.")
	return ""


func review_prompt_hint() -> String:
	if is_ios():
		return tr("If you have a moment, a quick App Store review helps others discover the app. We'd really appreciate it!")
	if is_android():
		return tr("If you have a moment, a quick review on Google Play helps others discover the app. We'd really appreciate it!")
	return tr("If you have a moment, a quick review helps others discover the app. We'd really appreciate it!")
