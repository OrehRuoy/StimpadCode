extends Node
## Native in-app review (Apple SKStoreReview / Google Play In-App Review).
## Uses the InappReview plugin when installed; otherwise tries common singletons,
## then store write-review URLs as a last resort.

signal review_requested(method: String)

## Set once the App Store listing exists (numeric id). Empty = skip URL fallback.
const IOS_APP_STORE_ID := ""
const ANDROID_PACKAGE := "com.stimpad.soundboard"

var _inapp_review: Node = null
var _busy := false


func _ready() -> void:
	call_deferred("_try_bind_plugin")


func request_review() -> void:
	if _busy:
		return
	_busy = true
	AnalyticsService.log_event("review_request_attempted", {"os": AppInfo.os_label()})
	var ok := false
	if OS.has_feature("ios"):
		ok = await _request_ios()
	elif OS.has_feature("android"):
		ok = await _request_android()
	else:
		print("[ReviewService] In-app review (editor/desktop stub)")
		ok = true
		review_requested.emit("editor_stub")
	if not ok:
		_fallback_store_url()
	_busy = false


func _try_bind_plugin() -> void:
	if ClassDB.class_exists("InappReview"):
		_inapp_review = ClassDB.instantiate("InappReview")
		if _inapp_review:
			add_child(_inapp_review)
			print("[ReviewService] Bound InappReview plugin")
			return
	## Some builds expose an autoload / singleton instead of a class.
	if Engine.has_singleton("InappReview"):
		_inapp_review = Engine.get_singleton("InappReview")
		print("[ReviewService] Bound InappReview singleton")


func _request_ios() -> bool:
	if _inapp_review != null:
		return await _launch_inapp_review_plugin()
	if Engine.has_singleton("RequestReview"):
		var s = Engine.get_singleton("RequestReview")
		if s != null and s.has_method("requestReview"):
			s.requestReview()
			review_requested.emit("RequestReview")
			return true
		if s != null and s.has_method("request_review"):
			s.request_review()
			review_requested.emit("RequestReview")
			return true
	## StoreKitManager from GodotApplePlugins — method name varies by version.
	if ClassDB.class_exists("StoreKitManager"):
		var mgr = ClassDB.instantiate("StoreKitManager")
		if mgr != null:
			for method_name in ["request_review", "requestReview", "request_app_review"]:
				if mgr.has_method(method_name):
					mgr.call(method_name)
					review_requested.emit(method_name)
					return true
	push_warning("ReviewService: no iOS in-app review plugin — using store URL fallback if configured")
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
	if OS.has_feature("ios") and not IOS_APP_STORE_ID.is_empty():
		url = "https://apps.apple.com/app/id%s?action=write-review" % IOS_APP_STORE_ID
	elif OS.has_feature("android"):
		url = "market://details?id=%s" % ANDROID_PACKAGE
	if url.is_empty():
		print("[ReviewService] No store URL fallback available")
		review_requested.emit("unavailable")
		return
	OS.shell_open(url)
	review_requested.emit("store_url")
	AnalyticsService.log_event("review_store_url_opened", {"url": url})
