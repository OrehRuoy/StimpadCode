extends Node

signal playback_started(sound_id: String)
signal playback_stopped(sound_id: String)
signal playback_finished(sound_id: String)
signal session_duration_changed(seconds: int)

## 0 = until the user hits Stop. Other values are minutes, stored in seconds.
const DURATION_UNTIL_STOP := 0
const DURATION_PRESETS := [0, 15 * 60, 30 * 60, 60 * 60]

var _player: AudioStreamPlayer
var _current_sound: Dictionary = {}
var _session_duration_sec: int = 0
var _session_timer: Timer
## Wall-clock deadline so a lock/unlock still ends the session if the Timer was paused.
var _stop_at_unix: int = 0
var _stop_after_loop: bool = false
var _loop_pass_pending: bool = false
var _play_started_msec: int = 0


func _ready() -> void:
	_player = AudioStreamPlayer.new()
	_player.name = "MainAudioPlayer"
	## HeadFlossService pans this bus; falls back to Master if SFX is missing.
	_player.bus = "SFX" if AudioServer.get_bus_index("SFX") >= 0 else "Master"
	add_child(_player)
	_player.finished.connect(_on_player_finished)

	_session_timer = Timer.new()
	_session_timer.one_shot = true
	_session_timer.timeout.connect(_on_session_timer_timeout)
	add_child(_session_timer)
	set_process(true)
	apply_sfx_volume(LocalPrefs.sfx_volume)


func _process(_delta: float) -> void:
	_check_stop_deadline()


func _notification(what: int) -> void:
	if what == NOTIFICATION_APPLICATION_RESUMED or what == NOTIFICATION_APPLICATION_FOCUS_IN:
		_check_stop_deadline()


func apply_sfx_volume(linear_01: float) -> void:
	var v := clampf(linear_01, 0.0, 1.0)
	LocalPrefs.sfx_volume = v
	var bus_name := "SFX"
	if _player != null and not str(_player.bus).is_empty():
		bus_name = str(_player.bus)
	var bus := AudioServer.get_bus_index(bus_name)
	if bus < 0:
		bus = AudioServer.get_bus_index("Master")
	if bus < 0:
		return
	## 0 → -40 dB (near mute), 1 → 0 dB
	var db := -40.0 if v <= 0.001 else (20.0 * log(v) / log(10.0))
	AudioServer.set_bus_volume_db(bus, db)


func set_session_duration(seconds: int) -> void:
	if not (seconds in DURATION_PRESETS):
		seconds = DURATION_UNTIL_STOP
	_session_duration_sec = seconds
	if LocalPrefs.session_duration_sec != seconds:
		LocalPrefs.session_duration_sec = seconds
		LocalPrefs.save_prefs()
	if is_playing() and _sound_holds_open():
		_arm_stop_timer()
	else:
		_clear_stop_timer()
	session_duration_changed.emit(seconds)


func get_session_duration() -> int:
	return _session_duration_sec


## Seconds until the stop timer fires, or -1 when the sound plays until Stop.
func get_stop_seconds_left() -> int:
	if _stop_at_unix <= 0 or not is_playing():
		return -1
	return maxi(0, _stop_at_unix - int(Time.get_unix_time_from_system()))


func is_playing() -> bool:
	return _player.playing


func get_current_sound_id() -> String:
	return str(_current_sound.get("id", ""))


func get_current_sound() -> Dictionary:
	return _current_sound


func play_sound(sound: Dictionary) -> void:
	if sound.is_empty():
		return
	if is_playing() and str(_current_sound.get("id", "")) != str(sound.get("id", "")):
		stop()
	_current_sound = sound
	var path: String = str(sound.get("path", ""))
	if path.is_empty() or not ResourceLoader.exists(path):
		push_warning("Missing audio for %s" % sound.get("id", ""))
		return
	var stream: AudioStream = load(path)
	if stream == null:
		return
	## Important: load() returns a shared cached resource — duplicate before mutating loop flags.
	if stream.has_method("duplicate"):
		stream = stream.duplicate()
	_player.stream = stream
	var mode: String = str(sound.get("mode", "oneshot"))
	var force_repeat := LocalPrefs.repeat_oneshots and mode != "loop"
	if mode == "loop" or force_repeat:
		_enable_stream_loop(stream)
		_stop_after_loop = false
		_loop_pass_pending = false
		_arm_stop_timer()
	else:
		_clear_stop_timer()
		_stop_after_loop = false
	_player.play()
	_player.pitch_scale = clampf(LocalPrefs.playback_rate, 0.5, 1.5)
	_play_started_msec = Time.get_ticks_msec()
	playback_started.emit(str(sound.get("id", "")))
	LocalPrefs.note_recent_sound(str(sound.get("id", "")))
	AnalyticsService.log_sound_play(sound)


func set_playback_rate(rate: float) -> void:
	LocalPrefs.playback_rate = clampf(rate, 0.5, 1.5)
	if _player != null:
		_player.pitch_scale = LocalPrefs.playback_rate


func get_playback_rate() -> float:
	return clampf(LocalPrefs.playback_rate, 0.5, 1.5)


func _enable_stream_loop(stream: AudioStream) -> void:
	## Godot 4: MP3/OGG use `.loop`; WAV uses loop_mode + sample points.
	if stream is AudioStreamMP3:
		(stream as AudioStreamMP3).loop = true
	elif stream is AudioStreamOggVorbis:
		(stream as AudioStreamOggVorbis).loop = true
	elif stream is AudioStreamWAV:
		var wav := stream as AudioStreamWAV
		wav.loop_mode = AudioStreamWAV.LOOP_FORWARD
		wav.loop_begin = 0
		var frames := int(round(wav.get_length() * float(wav.mix_rate)))
		if frames > 0:
			wav.loop_end = frames


func replay_current() -> void:
	if _current_sound.is_empty():
		return
	play_sound(_current_sound)


func stop() -> void:
	if not is_playing() and _current_sound.is_empty():
		return
	var stopped := _current_sound.duplicate()
	var stopped_id := str(stopped.get("id", ""))
	var duration_sec := 0.0
	if _play_started_msec > 0:
		duration_sec = float(Time.get_ticks_msec() - _play_started_msec) / 1000.0
	_player.stop()
	_clear_stop_timer()
	_stop_after_loop = false
	_loop_pass_pending = false
	_play_started_msec = 0
	_current_sound = {}
	if not stopped_id.is_empty():
		AnalyticsService.log_sound_stop(stopped, duration_sec)
	playback_stopped.emit(stopped_id)


func _sound_holds_open() -> bool:
	var mode := str(_current_sound.get("mode", ""))
	return mode == "loop" or LocalPrefs.repeat_oneshots


func _arm_stop_timer() -> void:
	_clear_stop_timer()
	if _session_duration_sec <= 0:
		return
	_stop_at_unix = int(Time.get_unix_time_from_system()) + _session_duration_sec
	_session_timer.wait_time = float(_session_duration_sec)
	_session_timer.start()


func _clear_stop_timer() -> void:
	_session_timer.stop()
	_stop_at_unix = 0


func _check_stop_deadline() -> void:
	if _stop_at_unix <= 0 or not is_playing():
		return
	if int(Time.get_unix_time_from_system()) >= _stop_at_unix:
		_stop_at_unix = 0
		_session_timer.stop()
		_on_session_timer_timeout()


func _on_session_timer_timeout() -> void:
	## Looping streams (esp. MP3 with loop=true) often never emit `finished`,
	## so end the session on the timer itself.
	var finished_id := str(_current_sound.get("id", ""))
	stop()
	if not finished_id.is_empty():
		playback_finished.emit(finished_id)


func _on_player_finished() -> void:
	var finished_id := str(_current_sound.get("id", ""))
	if finished_id.is_empty():
		return
	if _stop_after_loop:
		stop()
		playback_finished.emit(finished_id)
		return
	## Fallback: if native loop didn't engage, keep replaying until Stop.
	var mode := str(_current_sound.get("mode", ""))
	if mode == "loop" or LocalPrefs.repeat_oneshots:
		_player.play()
		return
	## Oneshot finished.
	var finished_sound := _current_sound.duplicate()
	var duration_sec := 0.0
	if _play_started_msec > 0:
		duration_sec = float(Time.get_ticks_msec() - _play_started_msec) / 1000.0
	_play_started_msec = 0
	_current_sound = {}
	AnalyticsService.log_sound_stop(finished_sound, duration_sec)
	playback_finished.emit(finished_id)
