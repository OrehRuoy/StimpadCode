extends Control

@onready var _fx_toggle: CheckButton = $Margin/VBox/FxToggle
@onready var _restore_btn: Button = $Margin/VBox/RestoreBtn
@onready var _credits_btn: Button = $Margin/VBox/CreditsBtn
@onready var _privacy_btn: Button = $Margin/VBox/PrivacyBtn
@onready var _back_btn: Button = $Margin/VBox/BackBtn
@onready var _version: Label = $Margin/VBox/VersionLabel
@onready var _plus_status: Label = $Margin/VBox/PlusStatus

const PRIVACY_URL := "https://orehruoy.github.io/StimPad/privacy-policy.html"


func _ready() -> void:
	_fx_toggle.button_pressed = LocalPrefs.visual_effects_enabled
	_fx_toggle.toggled.connect(_on_fx_toggled)
	_restore_btn.pressed.connect(_on_restore)
	_credits_btn.pressed.connect(_on_credits)
	_privacy_btn.pressed.connect(_on_privacy)
	_back_btn.pressed.connect(_on_back)
	_version.text = "StimPad v%s" % ProjectSettings.get_setting("application/config/version", "1.0.0")
	Entitlements.plus_changed.connect(func(_v): _refresh_plus_status())
	_refresh_plus_status()


func _refresh_plus_status() -> void:
	_plus_status.text = "StimPad Plus: Active" if Entitlements.has_plus() else "StimPad Plus: Not purchased"


func _on_fx_toggled(on: bool) -> void:
	LocalPrefs.visual_effects_enabled = on
	LocalPrefs.save_prefs()


func _on_restore() -> void:
	IAPService.restore_purchases()


func _on_credits() -> void:
	$Margin/VBox/CreditsPanel.visible = not $Margin/VBox/CreditsPanel.visible


func _on_privacy() -> void:
	if OS.has_feature("mobile"):
		# Hook: open URL on device.
		pass
	else:
		print("Privacy: ", PRIVACY_URL)


func _on_back() -> void:
	get_tree().get_first_node_in_group("main_nav").call("show_home")
