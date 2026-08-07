extends Node
## Submits feedback via Web3Forms (same approach as the StimPad website forms).

signal submit_finished(ok: bool, message: String)

const ENDPOINT := "https://api.web3forms.com/submit"
const ACCESS_KEY := "cc353871-e449-4f07-8f0d-cd5a168481de"

var _http: HTTPRequest
var _pending := false


func _ready() -> void:
	_http = HTTPRequest.new()
	_http.name = "Web3FormsHTTP"
	add_child(_http)
	_http.request_completed.connect(_on_request_completed)


func is_busy() -> bool:
	return _pending


func submit(feedback: String, email: String = "", requested_sounds: String = "") -> void:
	if _pending:
		submit_finished.emit(false, "Already sending…")
		return
	var message := feedback.strip_edges()
	if message.is_empty():
		submit_finished.emit(false, "Please enter some feedback.")
		return

	var payload := {
		"access_key": ACCESS_KEY,
		"subject": "StimPad App Feedback",
		"from_name": "StimPad App",
		"os": AppInfo.os_label(),
		"version": AppInfo.version_name(),
		"build": AppInfo.build_number(),
		"version_line": AppInfo.version_line(),
		"feedback": message,
		"email": email.strip_edges(),
		"requested_sounds": requested_sounds.strip_edges(),
		"source": "stimpad_app",
	}
	## Web3Forms also reads a combined message body for the email.
	payload["message"] = _format_body(payload)

	var body := JSON.stringify(payload)
	var headers := PackedStringArray([
		"Content-Type: application/json",
		"Accept: application/json",
	])
	_pending = true
	var err := _http.request(ENDPOINT, headers, HTTPClient.METHOD_POST, body)
	if err != OK:
		_pending = false
		submit_finished.emit(false, "Could not start request (%s)." % error_string(err))
		AnalyticsService.log_event("feedback_submit_fail", {"reason": "request_start"})


func _format_body(data: Dictionary) -> String:
	var lines: PackedStringArray = []
	lines.append("OS: %s" % data.get("os", ""))
	lines.append("Version: %s" % data.get("version_line", ""))
	lines.append("")
	lines.append("Feedback:")
	lines.append(str(data.get("feedback", "")))
	var email := str(data.get("email", "")).strip_edges()
	if not email.is_empty():
		lines.append("")
		lines.append("Reply email: %s" % email)
	var sounds := str(data.get("requested_sounds", "")).strip_edges()
	if not sounds.is_empty():
		lines.append("")
		lines.append("Sound requests:")
		lines.append(sounds)
	return "\n".join(lines)


func _on_request_completed(result: int, response_code: int, _headers: PackedStringArray, body: PackedByteArray) -> void:
	_pending = false
	var text := body.get_string_from_utf8()
	var parsed: Variant = JSON.parse_string(text) if not text.is_empty() else null
	var success := false
	var msg := "Something went wrong. Please try again."
	if result == HTTPRequest.RESULT_SUCCESS and response_code >= 200 and response_code < 300:
		if typeof(parsed) == TYPE_DICTIONARY:
			success = bool(parsed.get("success", true))
			if parsed.has("message"):
				msg = str(parsed.get("message"))
			elif success:
				msg = "Thanks — your feedback was sent."
		else:
			success = true
			msg = "Thanks — your feedback was sent."
	elif typeof(parsed) == TYPE_DICTIONARY and parsed.has("message"):
		msg = str(parsed.get("message"))
	elif response_code > 0:
		msg = "Send failed (HTTP %d)." % response_code

	if success:
		AnalyticsService.log_event("feedback_submit_ok", {"os": AppInfo.os_label()})
	else:
		AnalyticsService.log_event("feedback_submit_fail", {
			"os": AppInfo.os_label(),
			"code": response_code,
		})
	submit_finished.emit(success, msg)
