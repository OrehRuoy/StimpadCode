extends Node
## Native in-app review (Apple SKStoreReview / Google Play In-App Review).
## Uses the InappReview plugin when installed; otherwise tries common singletons,
## then store write-review URLs as a last resort.

signal review_requested(method: String)

## Numeric App Store id. Used for the Settings "Rate" row and the in-app-review fallback.
const IOS_APP_STORE_ID := "6796806236"
const ANDROID_PACKAGE := "com.stimpad.soundboard"

var _inapp_review: InappReview = null
var _android_review_active: bool = false
var _android_fallback_to_store: bool = false


## Settings → Rate StimPad.
## Android uses Play In-App Review and opens the store only if that API errors.
## iOS keeps the App Store write-review page. Apple's sheet is quota-limited
## and must not be tied to a button.
func open_write_review() -> void:
	if OS.has_feature("android"):
		_start_android_review(true)
		return
	print("[ReviewService] path=store_url platform=ios")
	_fallback_store_url()


func request_review() -> bool:
	if OS.has_feature("ios"):
		return _request_ios_sheet()
	if OS.has_feature("android"):
		_start_android_review(false)
		return true
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


func _start_android_review(fallback_to_store: bool) -> void:
	## Play ReviewManager: requestReviewFlow, then launchReviewFlow.
	## A successful launch can still show nothing. That is not an error.
	if _android_review_active:
		print("[ReviewService] path=in_app_review ignored=already_running")
		return
	var node := _ensure_android_review()
	if node == null:
		print("[ReviewService] path=store_fallback reason=plugin_missing")
		if fallback_to_store:
			_fallback_store_url()
		return
	_android_review_active = true
	_android_fallback_to_store = fallback_to_store
	print("[ReviewService] path=requestReviewFlow")
	AnalyticsService.log_event("review_request_attempted", {"method": "requestReviewFlow", "os": "android"})
	node.generate_review_info()
	var timer := get_tree().create_timer(8.0)
	timer.timeout.connect(func() -> void:
		if not _android_review_active:
			return
		_finish_android_review(false, "timeout")
	, CONNECT_ONE_SHOT)


func _ensure_android_review() -> InappReview:
	if _inapp_review != null and is_instance_valid(_inapp_review):
		return _inapp_review
	if not Engine.has_singleton("InappReviewPlugin"):
		return null
	var node := InappReview.new()
	node.name = "InappReview"
	add_child(node)
	_inapp_review = node
	node.review_info_generated.connect(_on_android_review_info_generated)
	node.review_info_generation_failed.connect(_on_android_review_info_failed)
	node.review_flow_launched.connect(_on_android_review_flow_launched)
	node.review_flow_launch_failed.connect(_on_android_review_flow_failed)
	return node


func _on_android_review_info_generated() -> void:
	if not _android_review_active or _inapp_review == null:
		return
	print("[ReviewService] path=launchReviewFlow")
	_inapp_review.launch_review_flow()


func _on_android_review_info_failed() -> void:
	_finish_android_review(false, "requestReviewFlow_failed")


func _on_android_review_flow_launched() -> void:
	_finish_android_review(true, "")


func _on_android_review_flow_failed() -> void:
	_finish_android_review(false, "launchReviewFlow_failed")


func _finish_android_review(launched: bool, reason: String) -> void:
	if not _android_review_active:
		return
	_android_review_active = false
	if launched:
		print("[ReviewService] path=in_app_review result=launched")
		review_requested.emit("in_app_review")
		AnalyticsService.log_event("review_request_attempted", {"method": "launchReviewFlow", "os": "android"})
		return
	print("[ReviewService] path=store_fallback reason=%s" % reason)
	AnalyticsService.log_event("review_request_unavailable", {"reason": reason, "os": "android"})
	if _android_fallback_to_store:
		_fallback_store_url()


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
