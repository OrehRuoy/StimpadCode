extends Control

@onready var _buy_btn: Button = $Margin/VBox/BuyWrap/BuyBtn
@onready var _buy_wrap: Control = $Margin/VBox/BuyWrap
@onready var _buy_bg: TextureRect = $Margin/VBox/BuyWrap/BuyBg
@onready var _price_label: Label = $Margin/VBox/PriceLabel
@onready var _watch_wrap: Control = $Margin/VBox/WatchWrap
@onready var _watch_bg: TextureRect = $Margin/VBox/WatchWrap/WatchBg
@onready var _watch_btn: Button = $Margin/VBox/WatchWrap/WatchAdBtn
@onready var _watch_meta: HBoxContainer = $Margin/VBox/WatchMeta
@onready var _watch_hint: Label = $Margin/VBox/WatchMeta/WatchHint
@onready var _restore_wrap: Control = $Margin/VBox/RestoreWrap
@onready var _restore_bg: TextureRect = $Margin/VBox/RestoreWrap/RestoreBg
@onready var _restore_btn: Button = $Margin/VBox/RestoreWrap/RestoreBtn
@onready var _back_btn: Button = $TopBar/BackBtn
@onready var _status: Label = $Margin/VBox/StatusLabel
@onready var _margin: MarginContainer = $Margin
@onready var _top_bar: MarginContainer = $TopBar
@onready var _hero: TextureRect = $Margin/VBox/HeroFrame/Hero
@onready var _hero_frame: PanelContainer = $Margin/VBox/HeroFrame
@onready var _perks: TextureRect = $Margin/VBox/Perks
@onready var _subtitle: Label = $Margin/VBox/Subtitle
@onready var _title: Label = $Margin/VBox/Title
@onready var _title_art: TextureRect = $Margin/VBox/TitleArt
@onready var _perk_labels: HBoxContainer = $Margin/VBox/PerkLabels
@onready var _vbox: VBoxContainer = $Margin/VBox

var _focus_sound: Dictionary = {}


func _ready() -> void:
	_buy_btn.pressed.connect(_on_buy)
	_watch_btn.pressed.connect(_on_watch_ad)
	_restore_btn.pressed.connect(_on_restore)
	_back_btn.pressed.connect(_on_back)
	IAPService.purchase_completed.connect(_on_purchase_done)
	IAPService.purchase_restored.connect(_on_restored)
	IAPService.purchase_failed.connect(_on_failed)
	IAPService.display_price_updated.connect(_on_display_price_updated)
	Entitlements.plus_changed.connect(func(_v): _refresh())
	AdsService.rewarded_unlock_completed.connect(_on_rewarded_done)
	AdsService.rewarded_unlock_failed.connect(_on_rewarded_failed)
	resized.connect(_apply_responsive_layout)
	_style_controls()
	_apply_responsive_layout()
	_refresh()


func open_for_sound(sound: Dictionary = {}) -> void:
	_focus_sound = sound
	## Kick AdMob only when a locked sound needs the Watch Ad button — not on cold start.
	if not sound.is_empty() and not Entitlements.has_plus():
		AdsService.ensure_initialized_for_rewarded()
	_refresh()


func _style_controls() -> void:
	UiLook.style_back(_back_btn)
	_style_buy_cta()
	_style_watch_cta()
	_style_restore_cta()
	_style_hero()


func _style_flat_hit(btn: Button) -> void:
	btn.flat = true
	btn.text = ""
	var empty := StyleBoxEmpty.new()
	btn.add_theme_stylebox_override("normal", empty)
	btn.add_theme_stylebox_override("hover", empty)
	btn.add_theme_stylebox_override("pressed", empty)
	btn.add_theme_stylebox_override("disabled", empty)
	btn.add_theme_stylebox_override("focus", empty)


func _style_buy_cta() -> void:
	_buy_bg.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	_buy_bg.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	_buy_bg.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_style_flat_hit(_buy_btn)


func _style_watch_cta() -> void:
	_watch_bg.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	_watch_bg.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	_watch_bg.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_style_flat_hit(_watch_btn)


func _style_restore_cta() -> void:
	_restore_bg.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	_restore_bg.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	_restore_bg.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_style_flat_hit(_restore_btn)


func _style_hero() -> void:
	## Borderless Plus hero — same art for Plus menu and locked-sound offer.
	var empty := StyleBoxEmpty.new()
	_hero_frame.add_theme_stylebox_override("panel", empty)
	_hero_frame.clip_contents = false
	_hero.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	_hero.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	if ResourceLoader.exists("res://assets/ui/paywall_hero.png"):
		_hero.texture = load("res://assets/ui/paywall_hero.png")


func _apply_responsive_layout() -> void:
	var vs := get_viewport_rect().size
	var margins := Responsive.safe_outer_margins(Responsive.content_margins(vs))
	var tablet := Responsive.is_tablet(vs)
	var watch_on := _watch_wrap.visible
	## Tighter packing when Watch Ad is shown so Restore stays on-screen.
	_margin.add_theme_constant_override("margin_left", int(margins.x))
	_margin.add_theme_constant_override("margin_top", int(maxf(margins.y, 6.0) + (44.0 if watch_on else 52.0)))
	_margin.add_theme_constant_override("margin_right", int(margins.z))
	_margin.add_theme_constant_override("margin_bottom", int(maxf(margins.w, 6.0)))
	_top_bar.add_theme_constant_override("margin_left", int(margins.x))
	_top_bar.add_theme_constant_override("margin_top", int(maxf(margins.y * 0.45, 6.0)))
	_top_bar.add_theme_constant_override("margin_right", int(margins.z))
	_vbox.add_theme_constant_override("separation", (6 if watch_on else 10) if tablet else (4 if watch_on else 7))
	_hero.custom_minimum_size = Vector2(0, (120 if watch_on else 150) if tablet else (88 if watch_on else 118))
	_hero_frame.custom_minimum_size = Vector2(0, (120 if watch_on else 150) if tablet else (88 if watch_on else 118))
	_title_art.custom_minimum_size = Vector2(0, (58 if watch_on else 72) if tablet else (42 if watch_on else 52))
	_perks.custom_minimum_size = Vector2(0, (70 if watch_on else 92) if tablet else (52 if watch_on else 68))
	_perk_labels.visible = not watch_on
	_buy_wrap.custom_minimum_size = Vector2(0, (104 if watch_on else 120) if tablet else (86 if watch_on else 100))
	_watch_wrap.custom_minimum_size = Vector2(0, 92 if tablet else 78)
	_restore_wrap.custom_minimum_size = Vector2(0, 76 if tablet else 64)
	_title.add_theme_font_size_override("font_size", 34 if tablet else 28)
	_subtitle.add_theme_font_size_override("font_size", 17 if tablet else 14)
	_status.add_theme_font_size_override("font_size", 15 if tablet else 12)
	_price_label.add_theme_font_size_override("font_size", 17 if tablet else 14)
	_watch_hint.add_theme_font_size_override("font_size", 14 if tablet else 12)
	for child in _perk_labels.get_children():
		if child is Label:
			(child as Label).add_theme_font_size_override("font_size", 14 if tablet else 12)


func _set_plus_title(_use_art: bool = true, _fallback_text: String = "StimPad Plus") -> void:
	## Always keep Plus branding (hero + title art) on this screen.
	_title_art.visible = true
	_title.visible = false


func _set_watch_visible(on: bool) -> void:
	_watch_wrap.visible = on
	_watch_meta.visible = on
	_apply_responsive_layout()


func _price_copy() -> String:
	return "%s · one-time" % IAPService.get_display_price()


func _on_display_price_updated(_price: String) -> void:
	_price_label.text = _price_copy()


func _refresh() -> void:
	var sound_id := str(_focus_sound.get("id", ""))
	var sound_name := str(_focus_sound.get("name", "this sound"))
	var has_focus := not sound_id.is_empty()
	var offer_rewarded := has_focus and AdsService.can_offer_rewarded()

	_set_plus_title(true)

	if Entitlements.has_plus():
		_subtitle.text = "You're all set"
		_status.text = "You have StimPad Plus. All sounds unlocked, ads removed."
		_buy_btn.disabled = true
		_buy_wrap.modulate = Color(1, 1, 1, 0.45)
		_price_label.text = "Owned"
		_set_watch_visible(false)
		return

	_buy_btn.disabled = false
	_buy_wrap.modulate = Color.WHITE
	_price_label.text = _price_copy()
	_set_watch_visible(offer_rewarded)

	if offer_rewarded:
		_subtitle.text = "Unlock \"%s\" or go Plus" % sound_name
		if Entitlements.is_temp_unlocked(sound_id):
			_status.text = (
				"%s unlocked until midnight. Buy Plus for everything, no ads."
			) % sound_name
			_set_watch_visible(false)
		else:
			_status.text = "Watch an ad for today, or unlock everything with Plus."
			_watch_hint.text = "Unlock until midnight"
	else:
		_subtitle.text = "All sounds · No ads · One purchase"
		_status.text = "Unlock 70+ stim sounds and remove ads."


func _on_watch_ad() -> void:
	var sound_id := str(_focus_sound.get("id", ""))
	if sound_id.is_empty():
		return
	_status.text = "Loading ad…"
	AnalyticsService.log_event("paywall_watch_ad_tap", {"sound_id": sound_id})
	AdsService.try_show_rewarded_for_sound(sound_id)


func _on_rewarded_done(sound_id: String) -> void:
	if str(_focus_sound.get("id", "")) != sound_id:
		return
	_refresh()
	_nav_call("show_player", [_focus_sound])


func _on_rewarded_failed(reason: String) -> void:
	_status.text = reason


func _on_buy() -> void:
	AnalyticsService.log_event("paywall_buy_tap", {"price": IAPService.get_display_price()})
	IAPService.purchase_plus()


func _on_restore() -> void:
	AnalyticsService.log_event("paywall_restore_tap", {})
	IAPService.restore_purchases()


func _on_purchase_done(_product_id: String) -> void:
	AnalyticsService.log_event("plus_purchase_success", {"product_id": str(_product_id)})
	_refresh()
	_nav_call("show_home")


func _on_restored(product_ids: Array) -> void:
	if product_ids.is_empty():
		_status.text = "No purchases found to restore."
	else:
		_status.text = "Purchase restored."
		_refresh()


func _on_failed(_product_id: String, reason: String) -> void:
	_status.text = "Purchase failed: %s" % reason


func _on_back() -> void:
	AnalyticsService.log_event("paywall_back_tap", {})
	if not _nav_call("show_home"):
		visible = false


func _nav_call(method_name: String, args: Array = []) -> bool:
	var nav := get_tree().get_first_node_in_group("main_nav")
	if nav == null:
		push_warning("PaywallScreen: main_nav missing for %s" % method_name)
		return false
	if not nav.has_method(method_name):
		push_warning("PaywallScreen: main_nav missing method %s" % method_name)
		return false
	nav.callv(method_name, args)
	return true
