extends Node
## One-time feature tips. Each tip is shown at most once; never re-reminded.
## Tips start on the 2nd app open (not first login), and skip features already in use.

signal tip_visibility_changed(visible: bool)

const TIP_SCENE_PATH := "res://scenes/ui/feature_tip.tscn"
const HOME_SETTLE_SEC := 1.8
const MIN_SESSION_SOUND_OPENS := 3
## First launch is for exploring — tips start on the 2nd app open.
const MIN_APP_OPENS := 2
## Long gap between different tips so they never feel spammy.
const SNOOZE_BETWEEN_TIPS_SEC := 60 * 60 * 24 * 7

const TIPS: Array[Dictionary] = [
	{
		"id": "head_floss",
		"title": "Try Head Flossing",
		"body": "In Settings, turn on Head Flossing to gently pan sounds left ↔ right in headphones.",
		"pref_on": "head_floss_enabled",
	},
	{
		"id": "haptics",
		"title": "Feel the taps",
		"body": "Haptic feedback vibrates your phone when you tap sounds. Toggle it anytime in Settings.",
		"pref_on": "haptics_enabled",
	},
	{
		"id": "pitch_speed",
		"title": "Tune pitch & speed",
		"body": "Enable Pitch & Speed in Settings to show a slider on each sound — deepen high clicks or slow loops.",
		"pref_on": "show_pitch_speed",
	},
	{
		"id": "tap_ripples",
		"title": "Tap ripples",
		"body": "Want a soft visual burst when you tap? Turn on Tap Ripples in Settings.",
		"pref_on": "tap_ripples_enabled",
	},
]

var _tip: Control = null
var _delay_timer: SceneTreeTimer = null
var _force_next := false
var _session_sound_opens: int = 0
var _pending_tip_id: String = ""


func note_sound_opened() -> void:
	_session_sound_opens += 1


func notify_feature_used(tip_id: String) -> void:
	## User already found the feature — never show that tip.
	if tip_id.is_empty():
		return
	_mark_tip_seen(tip_id)
	LocalPrefs.save_prefs()


func on_returned_home() -> void:
	if EnjoyPromptService.is_showing():
		return
	if not _should_offer():
		return
	if not _force_next and _session_sound_opens < MIN_SESSION_SOUND_OPENS:
		return
	_cancel_delay()
	_delay_timer = get_tree().create_timer(HOME_SETTLE_SEC)
	_delay_timer.timeout.connect(_on_settle_elapsed, CONNECT_ONE_SHOT)


func force_show_now() -> void:
	_force_next = true
	_cancel_delay()
	_show_tip()


func _should_offer() -> bool:
	if _force_next:
		return true
	if LocalPrefs.feature_tips_done:
		return false
	## Don't interrupt the first session — wait until they've opened the app again.
	if LocalPrefs.app_open_count < MIN_APP_OPENS:
		return false
	var now := int(Time.get_unix_time_from_system())
	if LocalPrefs.feature_tip_snooze_until > now:
		return false
	if EnjoyPromptService.is_showing():
		return false
	return _next_unseen_tip() != null


func _on_settle_elapsed() -> void:
	_delay_timer = null
	if not _should_offer():
		return
	if not _force_next and _session_sound_opens < MIN_SESSION_SOUND_OPENS:
		return
	var nav := get_tree().get_first_node_in_group("main_nav")
	if nav == null:
		return
	if nav.has_method("is_home_visible") and not nav.call("is_home_visible"):
		return
	if EnjoyPromptService.is_showing():
		return
	_show_tip()


func _is_tip_seen(tip_id: String) -> bool:
	return tip_id in LocalPrefs.feature_tips_seen


func _mark_tip_seen(tip_id: String) -> void:
	if tip_id.is_empty() or tip_id in LocalPrefs.feature_tips_seen:
		return
	LocalPrefs.feature_tips_seen.append(tip_id)
	## Once every tip has been shown once, never offer again.
	if LocalPrefs.feature_tips_seen.size() >= TIPS.size():
		LocalPrefs.feature_tips_done = true


func _pref_enabled(pref_key: String) -> bool:
	match pref_key:
		"head_floss_enabled":
			return LocalPrefs.head_floss_enabled
		"haptics_enabled":
			return LocalPrefs.haptics_enabled
		"show_pitch_speed":
			return LocalPrefs.show_pitch_speed
		"tap_ripples_enabled":
			return LocalPrefs.tap_ripples_enabled
		_:
			return false


func _next_unseen_tip() -> Variant:
	var marked_used := false
	for tip in TIPS:
		var tip_id := str(tip.get("id", ""))
		if _is_tip_seen(tip_id):
			continue
		var pref_key := str(tip.get("pref_on", ""))
		## Already using the feature — treat as “seen”, no need to advertise.
		if not pref_key.is_empty() and _pref_enabled(pref_key):
			_mark_tip_seen(tip_id)
			marked_used = true
			continue
		if marked_used:
			LocalPrefs.save_prefs()
		return tip
	LocalPrefs.feature_tips_done = true
	LocalPrefs.save_prefs()
	return null


func _show_tip() -> void:
	if _tip != null and is_instance_valid(_tip):
		return
	var tip: Variant = _next_unseen_tip()
	if tip == null:
		if _force_next:
			tip = TIPS[0]
		else:
			return
	var tip_dict: Dictionary = tip
	var tip_id := str(tip_dict.get("id", ""))
	var host := get_tree().get_first_node_in_group("main_nav")
	if host == null:
		return
	var packed: PackedScene = load(TIP_SCENE_PATH) as PackedScene
	if packed == null:
		push_error("FeatureTipService: missing %s" % TIP_SCENE_PATH)
		return
	_tip = packed.instantiate()
	host.add_child(_tip)
	_tip.z_index = 75
	_pending_tip_id = tip_id
	## Mark seen as soon as we show it — no re-reminders later.
	_mark_tip_seen(tip_id)
	LocalPrefs.feature_tip_snooze_until = int(Time.get_unix_time_from_system()) + SNOOZE_BETWEEN_TIPS_SEC
	LocalPrefs.save_prefs()
	if _tip.has_signal("closed"):
		_tip.closed.connect(_on_tip_closed)
	if _tip.has_method("present"):
		_tip.call("present", tip_dict)
	_force_next = false
	AnalyticsService.log_event("feature_tip_shown", {"tip_id": tip_id})
	tip_visibility_changed.emit(true)


func _on_tip_closed() -> void:
	_tip = null
	_pending_tip_id = ""
	tip_visibility_changed.emit(false)


func _cancel_delay() -> void:
	_delay_timer = null
