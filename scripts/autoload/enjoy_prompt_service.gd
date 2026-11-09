extends Node
## The one automatic review prompt. It asks the OS to show its own sheet
## (iOS SKStoreReviewController / Android Play In-App Review). It does not
## show a custom "are you enjoying this?" card first.
##
## When:
## - The 3rd app open in which a real sound was played, after that sound stops, or
## - A timer finishes (the sound has already stopped).
## Never while audio is playing, and not in the 45 seconds after a fullscreen ad.
## At most once every 90 days. The OS may still show nothing.

signal prompt_visibility_changed(visible: bool)

## Kept so the old card script still compiles if a debug build opens it.
const SNOOZE_DISMISS_SEC := 60 * 60 * 24 * 5
const SNOOZE_NO_SEC := 60 * 60 * 24 * 7
const MIN_LISTEN_SESSIONS := 3
const MIN_INTERVAL_SEC := 60 * 60 * 24 * 90

var _prompt: Control = null
var _delay_timer: SceneTreeTimer = null
var _counted_this_open := false
var _timer_ready := false
var _retries := 0


func _ready() -> void:
	LocalPrefs.note_app_open()
	AudioController.playback_started.connect(_on_playback_started)
	AudioController.playback_stopped.connect(_on_playback_stopped)
	AudioController.playback_finished.connect(_on_playback_stopped)
	AudioController.timer_finished.connect(_on_timer_finished)


func _on_playback_started(_sound_id: String) -> void:
	if AudioController.is_previewing() or _counted_this_open:
		return
	_counted_this_open = true
	LocalPrefs.note_review_listen_session()


func _on_playback_stopped(_sound_id: String = "") -> void:
	if LocalPrefs.review_listen_sessions >= MIN_LISTEN_SESSIONS:
		_schedule_check(1.2)


func _on_timer_finished(_sound_id: String) -> void:
	_timer_ready = true
	## The interstitial, if any, is decided on this same signal. Wait until that settles.
	_schedule_check(2.0)


func on_returned_home() -> void:
	if _timer_ready or LocalPrefs.review_listen_sessions >= MIN_LISTEN_SESSIONS:
		_schedule_check(1.2)


func is_showing() -> bool:
	return _prompt != null and is_instance_valid(_prompt)


func dismiss() -> void:
	if not is_showing():
		return
	if _prompt.has_method("_on_close"):
		_prompt.call("_on_close")


func force_show_now() -> void:
	## Debug menu. Still the native sheet, not the old Yes/No card.
	var ok: bool = ReviewService.request_review()
	if ok:
		LocalPrefs.mark_review_requested()
	print("[Review] force native request ok=%s" % str(ok))


static func automatic_review_block_reason(
	playing: bool,
	previewing: bool,
	ad_blocking: bool,
	other_prompt: bool,
	sessions: int,
	timer_moment: bool,
	now: float,
	last_request: float,
	min_sessions: int,
	min_interval: float,
) -> String:
	if playing or previewing:
		return "audio"
	if ad_blocking:
		return "ad"
	if other_prompt:
		return "prompt"
	if last_request > 0.0 and now - last_request < min_interval:
		return "cooldown"
	if timer_moment or sessions >= min_sessions:
		return ""
	return "too_soon"


func _schedule_check(delay_sec: float) -> void:
	if _delay_timer != null:
		return
	_delay_timer = get_tree().create_timer(delay_sec)
	_delay_timer.timeout.connect(_on_check, CONNECT_ONE_SHOT)


func _on_check() -> void:
	_delay_timer = null
	var reason := _current_block_reason()
	if reason == "":
		var ok: bool = ReviewService.request_review()
		if ok:
			LocalPrefs.mark_review_requested()
			print("[Review] native request sessions=%d timer=%s" % [
				LocalPrefs.review_listen_sessions, str(_timer_ready),
			])
			_timer_ready = false
			_retries = 0
		else:
			print("[Review] native request unavailable")
		return
	print("[Review] skipped reason=%s sessions=%d" % [reason, LocalPrefs.review_listen_sessions])
	if reason in ["audio", "ad", "prompt"] and _retries < 2:
		_retries += 1
		_schedule_check(50.0 if reason == "ad" else 20.0)


func _current_block_reason() -> String:
	var other := FeatureTipService.is_showing() or ReminderService.is_showing() or is_showing()
	return automatic_review_block_reason(
		AudioController.is_playing(),
		AudioController.is_previewing(),
		AdsService.blocks_review_prompt(),
		other,
		LocalPrefs.review_listen_sessions,
		_timer_ready,
		Time.get_unix_time_from_system(),
		float(LocalPrefs.review_request_unix()),
		MIN_LISTEN_SESSIONS,
		float(MIN_INTERVAL_SEC),
	)
