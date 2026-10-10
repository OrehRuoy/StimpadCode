extends Node
## Schedules the “Are you enjoying StimPad?” prompt and owns the overlay instance.
##
## Timing:
## - Eligible from the 2nd app open (never the first)
## - Never on cold launch / idle home wait
## - After one sound has been listened to for 45 seconds, then the user returns Home
## Apple still rate-limits the actual review sheet.
##
## IMPORTANT: do not preload enjoy_prompt.tscn here — that scene’s script
## references this autoload and would create a circular load failure.

signal prompt_visibility_changed(visible: bool)

const PROMPT_SCENE_PATH := "res://scenes/ui/enjoy_prompt.tscn"
## Brief beat after returning home so the grid settles (and ads can clear).
const HOME_SETTLE_SEC := 1.4
## Ask from the 2nd launch. Never the first. Apple still limits the sheet.
const MIN_APP_OPENS := 2
## After dismissing with X, wait before asking again.
const SNOOZE_DISMISS_SEC := 60 * 60 * 24 * 5
## After “No” (+ feedback), wait a week — they may change their mind.
const SNOOZE_NO_SEC := 60 * 60 * 24 * 7

var _prompt: Control = null
var _delay_timer: SceneTreeTimer = null
var _force_next := false
var _qualified_listen := false


func _ready() -> void:
	LocalPrefs.note_app_open()
	AudioController.listened_enough.connect(_on_listened_enough)


func _on_listened_enough(_sound_id: String) -> void:
	_qualified_listen = true
	## Listening often finishes on the player, or on Home after they already
	## came back. Either way, try again once the 45 seconds are real.
	_schedule_prompt()


## Call when navigating back to Home — may show the prompt after settle delay.
func on_returned_home() -> void:
	_schedule_prompt()


func _schedule_prompt() -> void:
	if not _should_offer():
		return
	if not _force_next and not _qualified_listen:
		return
	_cancel_delay()
	_delay_timer = get_tree().create_timer(HOME_SETTLE_SEC)
	_delay_timer.timeout.connect(_on_settle_elapsed, CONNECT_ONE_SHOT)


func is_showing() -> bool:
	return _prompt != null and is_instance_valid(_prompt)


func force_show_now() -> void:
	_force_next = true
	_cancel_delay()
	_show_prompt()


func _should_offer() -> bool:
	if _force_next:
		return true
	## Yes / review path only — permanent.
	if LocalPrefs.enjoy_prompt_completed:
		return false
	var now := Time.get_unix_time_from_system()
	if LocalPrefs.enjoy_prompt_snooze_until > now:
		return false
	if LocalPrefs.app_open_count < MIN_APP_OPENS:
		return false
	return true


func _on_settle_elapsed() -> void:
	_delay_timer = null
	if not _should_offer():
		return
	if not _force_next and not _qualified_listen:
		return
	var nav := get_tree().get_first_node_in_group("main_nav")
	if nav == null:
		return
	if nav.has_method("is_home_visible") and not nav.call("is_home_visible"):
		return
	var paywall := nav.get_node_or_null("Screens/PaywallScreen")
	var blocked: bool = (
		AdsService.is_fullscreen_ad_showing()
		or FeatureTipService.is_showing()
		or (paywall != null and paywall.visible)
	)
	if blocked:
		## Don't drop this chance because an ad or tip was still up.
		_schedule_prompt()
		return
	_show_prompt()


func _show_prompt() -> void:
	if _prompt != null and is_instance_valid(_prompt):
		return
	var host := get_tree().get_first_node_in_group("main_nav")
	if host == null:
		return
	var packed: PackedScene = load(PROMPT_SCENE_PATH) as PackedScene
	if packed == null:
		push_error("EnjoyPromptService: missing %s" % PROMPT_SCENE_PATH)
		return
	_prompt = packed.instantiate()
	host.add_child(_prompt)
	_prompt.z_index = 80
	if _prompt.has_signal("closed"):
		_prompt.closed.connect(_on_prompt_closed)
	if _prompt.has_method("present"):
		_prompt.call("present")
	_force_next = false
	LocalPrefs.mark_enjoy_prompt_shown()
	AnalyticsService.log_event("enjoy_prompt_shown", {
		"qualified_listen": true,
	})
	prompt_visibility_changed.emit(true)


func _on_prompt_closed() -> void:
	_prompt = null
	prompt_visibility_changed.emit(false)


func _cancel_delay() -> void:
	_delay_timer = null
