@tool
extends EditorPlugin

const AUTOLOAD_NAME := "FirebaseIOS"
const AUTOLOAD_PATH := "res://addons/GodotFirebaseiOS/FirebaseIOS.gd"

var export_plugin: iOSExportPlugin

func _enable_plugin() -> void:
	add_autoload_singleton(AUTOLOAD_NAME, AUTOLOAD_PATH)

func _disable_plugin() -> void:
	remove_autoload_singleton(AUTOLOAD_NAME)

func _enter_tree() -> void:
	export_plugin = iOSExportPlugin.new()
	add_export_plugin(export_plugin)

func _exit_tree() -> void:
	remove_export_plugin(export_plugin)
	export_plugin = null


class iOSExportPlugin extends EditorExportPlugin:
	const FRAMEWORKS_DIR := "res://addons/GodotFirebaseiOS/frameworks"

	var _export_path := ""

	const FIREBASE_FRAMEWORKS: PackedStringArray = [
		"AppAuth.xcframework",
		"AppCheckCore.xcframework",
		"FBLPromises.xcframework",
		"FirebaseABTesting.xcframework",
		"FirebaseAnalytics.xcframework",
		"FirebaseAppCheckInterop.xcframework",
		"FirebaseAuth.xcframework",
		"FirebaseAuthInterop.xcframework",
		"FirebaseCore.xcframework",
		"FirebaseCoreExtension.xcframework",
		"FirebaseCoreInternal.xcframework",
		"FirebaseDatabase.xcframework",
		"FirebaseFirestore.xcframework",
		"FirebaseFirestoreInternal.xcframework",
		"FirebaseInstallations.xcframework",
		"FirebaseMessaging.xcframework",
		"FirebaseMessagingInterop.xcframework",
		"FirebaseRemoteConfig.xcframework",
		"FirebaseRemoteConfigInterop.xcframework",
		"FirebaseSharedSwift.xcframework",
		"GTMAppAuth.xcframework",
		"GTMSessionFetcher.xcframework",
		"GoogleAppMeasurement.xcframework",
		"GoogleAppMeasurementIdentitySupport.xcframework",
		"GoogleDataTransport.xcframework",
		"GoogleSignIn.xcframework",
		"GoogleUtilities.xcframework",
		"RecaptchaInterop.xcframework",
		"absl.xcframework",
		"grpc.xcframework",
		"grpcpp.xcframework",
		"leveldb.xcframework",
		"nanopb.xcframework",
		"openssl_grpc.xcframework",
	]

	func _get_name() -> String:
		return "GodotFirebaseiOS"

	func _supports_platform(platform: EditorExportPlatform) -> bool:
		return platform is EditorExportPlatformIOS

	func _export_begin(features: PackedStringArray, _is_debug: bool, path: String, _flags: int) -> void:
		_export_path = path
		print("EXPORT FEATURES: ", features)
		if not features.has("ios"):
			return
		const PLIST_PATH := "res://addons/GodotFirebaseiOS/GoogleService-Info.plist"
		if not FileAccess.file_exists(PLIST_PATH):
			push_warning("GodotFirebaseiOS: GoogleService-Info.plist not found at " + PLIST_PATH + ". Firebase will fail to initialize. Place your GoogleService-Info.plist from the Firebase console into res://addons/GodotFirebaseiOS/")
			return
		add_ios_bundle_file(PLIST_PATH)
		# Circuit Sort uses Analytics only — OAuth / Google Sign-In client IDs are optional.
		# Upstream returned early without REVERSED_CLIENT_ID and skipped -ObjC, which breaks Firebase.
		var reversed_client_id := _extract_reversed_client_id(PLIST_PATH)
		if not reversed_client_id.is_empty():
			add_ios_plist_content(_make_url_scheme_plist(reversed_client_id))
		else:
			push_warning("GodotFirebaseiOS: REVERSED_CLIENT_ID not found — skipping Google Sign-In URL scheme (Analytics still works).")
		add_ios_linker_flags("-ObjC")

	func _extract_reversed_client_id(plist_path: String) -> String:
		var parser := XMLParser.new()
		if parser.open(plist_path) != OK:
			return ""
		var found_key := false
		while parser.read() == OK:
			if parser.get_node_type() != XMLParser.NODE_TEXT:
				continue
			var text := parser.get_node_data().strip_edges()
			if text.is_empty():
				continue
			if text == "REVERSED_CLIENT_ID":
				found_key = true
			elif found_key:
				return text
		return ""

	func _make_url_scheme_plist(reversed_client_id: String) -> String:
		return """<key>CFBundleURLTypes</key>
<array>
	<dict>
		<key>CFBundleTypeRole</key>
		<string>Editor</string>
		<key>CFBundleURLSchemes</key>
		<array>
			<string>%s</string>
		</array>
	</dict>
</array>""" % reversed_client_id

	func _make_fcm_plist() -> String:
		return """<key>FirebaseAppDelegateProxyEnabled</key>
<false/>
<key>UIBackgroundModes</key>
<array>
	<string>remote-notification</string>
</array>
<key>FirebaseMessagingAutoInitEnabled</key>
<false/>"""

	func _export_end() -> void:
		if _export_path.is_empty():
			return
		
		var project_name := _export_path.get_file().get_basename()
		var parent_dir := _export_path.get_base_dir()
		var dest_dir := parent_dir.path_join(project_name).path_join("frameworks")
		
		var src_abs := ProjectSettings.globalize_path(FRAMEWORKS_DIR)
		var dest_abs := ProjectSettings.globalize_path(dest_dir)
		
		# Ensure destination parent folder exists
		DirAccess.make_dir_recursive_absolute(dest_abs.get_base_dir())
		
		# Clean previous frameworks folder if exists to avoid nested copies
		if DirAccess.dir_exists_absolute(dest_abs):
			OS.execute("rm", ["-rf", dest_abs])

		var output := []
		var exit_code := OS.execute("cp", ["-R", src_abs, dest_abs], output, true)
		if exit_code != 0:
			push_warning("GodotFirebaseiOS: Failed to copy frameworks directory. Exit code: %d" % exit_code)
			return
		else:
			print("GodotFirebaseiOS: Copied frameworks to: ", dest_abs)

		# Godot passes the .ipa path even for project-only exports. The pbxproj lives in the sibling .xcodeproj.
		var xcodeproj_path := parent_dir.path_join(project_name + ".xcodeproj")
		_modify_pbxproj(xcodeproj_path, project_name)
		_export_path = ""

	func _modify_pbxproj(xcodeproj_path: String, project_name: String) -> void:
		var pbxproj_path := xcodeproj_path.path_join("project.pbxproj")
		if not FileAccess.file_exists(pbxproj_path):
			push_warning("GodotFirebaseiOS: project.pbxproj not found at " + pbxproj_path)
			return

		var file := FileAccess.open(pbxproj_path, FileAccess.READ)
		if not file:
			push_warning("GodotFirebaseiOS: Failed to open project.pbxproj for reading")
			return
		var content := file.get_as_text()
		file.close()

		var device_flags := ""
		var simulator_flags := ""

		for fw in FIREBASE_FRAMEWORKS:
			var fw_name_no_ext := fw.replace(".xcframework", "")
			device_flags += " -force_load \\\"$(PROJECT_DIR)/%s/frameworks/%s/ios-arm64/%s.framework/%s\\\"" % [project_name, fw, fw_name_no_ext, fw_name_no_ext]
			simulator_flags += " -force_load \\\"$(PROJECT_DIR)/%s/frameworks/%s/ios-arm64_x86_64-simulator/%s.framework/%s\\\"" % [project_name, fw, fw_name_no_ext, fw_name_no_ext]

		# Balanced parse: naive ([^\)]*) breaks on $(inherited) after CocoaPods.
		var search_from := 0
		var replacements := 0
		while true:
			var key_pos := content.find("OTHER_LDFLAGS", search_from)
			if key_pos == -1:
				break
			# Godot String.rfind() only accepts (what, from) — not a Python-style end index.
			var line_start := content.substr(0, key_pos).rfind("\n") + 1
			var line_prefix := content.substr(line_start, key_pos - line_start)
			if line_prefix.contains("OTHER_LDFLAGS[sdk="):
				search_from = key_pos + 13
				continue
			var eq_pos := content.find("=", key_pos)
			if eq_pos == -1:
				break
			var value_start := eq_pos + 1
			while value_start < content.length() and content[value_start] in [" ", "\t", "\r", "\n"]:
				value_start += 1
			if value_start >= content.length():
				break
			var value_end := value_start
			if content[value_start] == "(":
				var depth := 0
				var j := value_start
				while j < content.length():
					if content[j] == "(":
						depth += 1
					elif content[j] == ")":
						depth -= 1
						if depth == 0:
							j += 1
							break
					j += 1
				value_end = j
			elif content[value_start] == "\"":
				var j := value_start + 1
				while j < content.length() and content[j] != "\"":
					if content[j] == "\\":
						j += 2
						continue
					j += 1
				value_end = mini(j + 1, content.length())
			else:
				search_from = key_pos + 13
				continue
			while value_end < content.length() and content[value_end] in [" ", "\t", "\r", "\n"]:
				value_end += 1
			if value_end >= content.length() or content[value_end] != ";":
				search_from = key_pos + 13
				continue
			value_end += 1
			var raw_flags := content.substr(value_start, value_end - value_start - 1).strip_edges()
			var original_flags: PackedStringArray = []
			if raw_flags.begins_with("("):
				for line in raw_flags.substr(1, raw_flags.length() - 2).split("\n"):
					# Only strip a trailing list comma — NEVER replace(",", ""), which
					# destroys -Wl,-U,_swift_entry_point into -Wl-U_swift_entry_point and
					# crashes the app on launch (broken ApplePlugins/SwiftGodot undefined symbols).
					var flag := line.strip_edges().trim_suffix(",").strip_edges()
					if flag.begins_with("\"") and flag.ends_with("\"") and flag.length() >= 2:
						flag = flag.substr(1, flag.length() - 2)
					if flag.is_empty() or flag == "-force_load" or flag.contains("/frameworks/"):
						continue
					original_flags.append(flag)
			else:
				# Quoted string form: keep -Wl,... tokens intact (commas are significant).
				var unquoted := raw_flags
				if unquoted.begins_with("\"") and unquoted.ends_with("\"") and unquoted.length() >= 2:
					unquoted = unquoted.substr(1, unquoted.length() - 2)
				for flag in unquoted.split(" "):
					var trimmed := flag.strip_edges()
					if trimmed.is_empty() or trimmed == "-force_load" or trimmed.contains("/frameworks/"):
						continue
					original_flags.append(trimmed)
			var original_flags_str := " ".join(original_flags)
			# GodotFirebaseiOS.framework resolves its Firebase symbols by flat (dynamic)
			# lookup against the main executable, so the app MUST export them. Bare
			# -rdynamic is not reliably honored here; use the explicit linker form.
			var replacement_str := "\"OTHER_LDFLAGS[sdk=iphoneos*]\" = \"%s -Wl,-export_dynamic %s\";\n\t\t\t\t\"OTHER_LDFLAGS[sdk=iphonesimulator*]\" = \"%s -Wl,-export_dynamic %s\";" % [original_flags_str, device_flags, original_flags_str, simulator_flags]
			content = content.substr(0, key_pos) + replacement_str + content.substr(value_end)
			replacements += 1
			search_from = key_pos + replacement_str.length()

		if replacements == 0:
			push_warning("GodotFirebaseiOS: Could not find any OTHER_LDFLAGS pattern in project.pbxproj")
			return

		var write_file := FileAccess.open(pbxproj_path, FileAccess.WRITE)
		if write_file:
			write_file.store_string(content)
			write_file.close()
			print("GodotFirebaseiOS: Successfully injected conditional force_load settings in project.pbxproj (%d site(s))" % replacements)
		else:
			push_warning("GodotFirebaseiOS: Failed to open project.pbxproj for writing")
