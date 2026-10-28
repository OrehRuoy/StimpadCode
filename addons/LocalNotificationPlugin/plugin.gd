@tool
extends EditorPlugin

var _ios_export: EditorExportPlugin


func _enter_tree() -> void:
	_ios_export = IosExport.new()
	add_export_plugin(_ios_export)


func _exit_tree() -> void:
	if _ios_export != null:
		remove_export_plugin(_ios_export)
		_ios_export = null


class IosExport extends EditorExportPlugin:
	func _supports_platform(platform: EditorExportPlatform) -> bool:
		return platform is EditorExportPlatformIOS

	func _get_name() -> String:
		return "LocalNotificationPlugin"

	func _export_begin(features: PackedStringArray, _is_debug: bool, _path: String, _flags: int) -> void:
		if not features.has("ios"):
			return
		add_apple_embedded_platform_framework("UserNotifications.framework")
		add_apple_embedded_platform_linker_flags("-ObjC")
