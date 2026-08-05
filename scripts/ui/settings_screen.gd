extends Control

@onready var _restore_btn: Button = $Margin/VBox/Scroll/Content/RestoreBtn
@onready var _privacy_btn: Button = $Margin/VBox/Scroll/Content/PrivacyBtn
@onready var _ad_privacy_btn: Button = $Margin/VBox/Scroll/Content/AdPrivacyBtn
@onready var _back_btn: Button = $Margin/VBox/Top/BackBtn
@onready var _version: Label = $Margin/VBox/Scroll/Content/VersionLabel
@onready var _plus_status: Label = $Margin/VBox/Scroll/Content/PlusStatus
@onready var _margin: MarginContainer = $Margin
@onready var _hero: TextureRect = $Margin/VBox/Scroll/Content/Hero

const PRIVACY_URL := "https://orehruoy.github.io/StimPad/privacy-policy.html"


func _ready() -> void:
	_restore_btn.pressed.connect(_on_restore)
	_privacy_btn.pressed.connect(_on_privacy)
	_ad_privacy_btn.pressed.connect(_on_ad_privacy)
	AdsService.privacy_choices_availability_changed.connect(_refresh_ad_privacy_btn)
	_back_btn.pressed.connect(_on_back)
	_version.text = "StimPad v%s" % ProjectSettings.get_setting("application/config/version", "1.0.0")
	Entitlements.plus_changed.connect(func(_v): _refresh_plus_status())
	resized.connect(_apply_responsive_layout)
	_style_controls()
	_apply_responsive_layout()
	_refresh_plus_status()
	_refresh_ad_privacy_btn(AdsService.privacy_choices_available())


func _style_controls() -> void:
	UiLook.style_settings_row(_restore_btn)
	UiLook.style_settings_row(_privacy_btn)
	UiLook.style_settings_row(_ad_privacy_btn)
	UiLook.style_back(_back_btn)


func _apply_responsive_layout() -> void:
	var vs := get_viewport_rect().size
	var margins := Responsive.safe_outer_margins(Responsive.content_margins(vs))
	_margin.add_theme_constant_override("margin_left", int(margins.x))
	_margin.add_theme_constant_override("margin_top", int(margins.y))
	_margin.add_theme_constant_override("margin_right", int(margins.z))
	_margin.add_theme_constant_override("margin_bottom", int(margins.w))
	_hero.custom_minimum_size = Vector2(0, 140 if Responsive.is_tablet(vs) else 110)


func _refresh_plus_status() -> void:
	_plus_status.text = "StimPad Plus: Active" if Entitlements.has_plus() else "StimPad Plus: Not purchased"


func _on_restore() -> void:
	IAPService.restore_purchases()


func _refresh_ad_privacy_btn(available: bool) -> void:
	_ad_privacy_btn.visible = available and not Entitlements.has_plus()


func _on_privacy() -> void:
	OS.shell_open(PRIVACY_URL)


func _on_ad_privacy() -> void:
	AdsService.open_privacy_choices_from_settings()


func _on_back() -> void:
	get_tree().get_first_node_in_group("main_nav").call("show_home")
