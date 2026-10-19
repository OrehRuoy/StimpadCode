extends RefCounted
class_name AppInfo
## Shared app identity helpers for feedback / diagnostics.


static func store_label() -> String:
	var store := Platform.store_name()
	if store == Platform.STORE_APP_STORE:
		return "App Store"
	if store == Platform.STORE_PLAY:
		return "Google Play"
	return ""


static func os_label() -> String:
	if OS.has_feature("ios"):
		return "iOS"
	if OS.has_feature("android"):
		return "Android"
	var name := OS.get_name()
	if name.is_empty():
		return "Unknown"
	return name


static func version_name() -> String:
	return str(ProjectSettings.get_setting("application/config/version", "1.0.0"))


static func build_number() -> String:
	var build := str(ProjectSettings.get_setting("application/config/build", ""))
	if build.is_empty():
		build = version_name()
	return build


static func version_line() -> String:
	var v := version_name()
	var b := build_number()
	if b == v:
		return v
	return "%s (%s)" % [v, b]
