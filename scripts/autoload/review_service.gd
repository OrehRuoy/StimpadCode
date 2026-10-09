extends Node
## Native in-app review (Apple SKStoreReview / Google Play In-App Review).
## Uses the InappReview plugin when installed; otherwise tries common singletons,
## then store write-review URLs as a last resort.

signal review_requested(method: String)

## Numeric App Store id. Used for the Settings "Rate" row and the in-app-review fallback.
const IOS_APP_STORE_ID := "6796806236"
const ANDROID_PACKAGE := "com.stimpad.soundboard"

var _inapp_review: Node = null


## Explicit Rate action. Always opens the store write-review page.
## Apple's in-app sheet is quota-limited and must not be tied to a button.
func open_write_review() -> void:
	_fallback_store_url()


func request_review() -> bool:
	if OS.has_feature("ios"):
		return _request_ios_sheet()
	if OS.has_feature("android"):
		var ok: bool = await _request_android()
		if not ok:
			_fallback_store_url()
		return ok
	print("[ReviewService] In-app review (editor/desktop stub)")
	review_requested.emit("editor_stub")
	return true


func _request_ios_sheet() -> bool:
	if Engine.has_singleton("InappReviewPlugin"):
		Engine.get_singleton("InappReviewPlugin").launch_review_flow()
		AnalyticsService.log_event("review_request_attempted", {"method": "inapp_plugin"})
		return true
	if ClassDB.class_exists("StoreKitManager"):
		var mgr = ClassDB.instantiate("StoreKitManager")
		if mgr != null and mgr.has_method("request_review"):
			mgr.call("request_review")
			AnalyticsService.log_event("review_request_attempted", {"method": "storekit_manager"})
			return true
	AnalyticsService.log_event("review_request_unavailable", {})
	return false


func _request_android() -> bool:
	if _inapp_review != null:
		return await _launch_inapp_review_plugin()
	if Engine.has_singleton("GodotInAppReview"):
		var s = Engine.get_singleton("GodotInAppReview")
		if s != null and s.has_method("requestReview"):
			s.requestReview()
			review_requested.emit("GodotInAppReview")
			return true
	push_warning("ReviewService: no Android in-app review plugin — using Play Store URL fallback")
	return false


func _launch_inapp_review_plugin() -> bool:
	if _inapp_review == null:
		return false
	## cengiz-pz In-app Review Plugin (iOS + Android unified API).
	if _inapp_review.has_method("generate_review_info") and _inapp_review.has_signal("review_info_generated"):
		_inapp_review.generate_review_info()
		await _inapp_review.review_info_generated
		if _inapp_review.has_method("launch_review_flow"):
			_inapp_review.launch_review_flow()
			review_requested.emit("InappReview")
			return true
	if _inapp_review.has_method("launch_review_flow"):
		_inapp_review.launch_review_flow()
		review_requested.emit("InappReview")
		return true
	if _inapp_review.has_method("request_review"):
		_inapp_review.request_review()
		review_requested.emit("InappReview")
		return true
	return false


func _fallback_store_url() -> void:
	var url := ""
	if OS.has_feature("android"):
		url = "https://play.google.com/store/apps/details?id=%s" % ANDROID_PACKAGE
	elif not IOS_APP_STORE_ID.is_empty():
		url = "https://apps.apple.com/app/id%s?action=write-review" % IOS_APP_STORE_ID
	if url.is_empty():
		print("[ReviewService] No store URL fallback available")
		review_requested.emit("unavailable")
		return
	OS.shell_open(url)
	review_requested.emit("store_url")
	AnalyticsService.log_event("review_store_url_opened", {"url": url})
