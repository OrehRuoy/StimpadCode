#
# © 2024-present https://github.com/cengiz-pz
#

class_name UserConsent extends RefCounted

## Plugin-side names. Numeric values here do NOT match Google UMP integers —
## always parse with from_ump() / _from_google_int(). Native get_consent_status()
## returns Google's ConsentStatus: UNKNOWN=0, REQUIRED=1, NOT_REQUIRED=2, OBTAINED=3.
enum Status {
	UNKNOWN,
	NOT_REQUIRED,
	REQUIRED,
	OBTAINED
}

var status: Status


func _init(a_status_string: String = "") -> void:
	status = parse_ump(a_status_string)


func to_status_string() -> String:
	return Status.keys()[status]


static func status_to_string(a_status: Status) -> String:
	return Status.keys()[a_status]


static func string_to_status(a_string: String) -> Status:
	return parse_ump(a_string)


static func from_ump(value: Variant) -> UserConsent:
	var consent := UserConsent.new()
	consent.status = parse_ump(value)
	return consent


## Accepts Google's integer, the integer as a string, or a Status name.
static func parse_ump(value: Variant) -> Status:
	if value == null:
		return Status.UNKNOWN
	if value is int or value is float:
		return _from_google_int(int(value))
	if value is String:
		var text: String = (value as String).strip_edges()
		if text.is_empty():
			return Status.UNKNOWN
		if text.is_valid_int():
			return _from_google_int(int(text))
		var named: Variant = Status.get(text.to_upper())
		if named == null:
			return Status.UNKNOWN
		return named
	return Status.UNKNOWN


static func _from_google_int(code: int) -> Status:
	match code:
		0:
			return Status.UNKNOWN
		1:
			return Status.REQUIRED
		2:
			return Status.NOT_REQUIRED
		3:
			return Status.OBTAINED
		_:
			return Status.UNKNOWN
