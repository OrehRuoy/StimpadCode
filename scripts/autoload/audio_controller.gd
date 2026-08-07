extends Node

signal playback_started(sound_id: String)
signal playback_stopped(sound_id: String)
signal playback_finished(sound_id: String)

const DURATION_PRESETS := [30, 60, 300]

var _player: AudioStreamPlayer
var _current_sound: Dictionary = {}
var _session_duration_sec: int = 60
var _session_timer: Timer
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
	apply_sfx_volume(LocalPrefs.sfx_volume)


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
	if seconds in DURATION_PRESETS:
		_session_duration_sec = seconds


func get_session_duration() -> int:
	return _session_duration_sec


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
		## Loops / repeat play until the user hits Stop (no duration chips).
		_session_timer.stop()
	else:
		_session_timer.stop()
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
	_session_timer.stop()
	_stop_after_loop = false
	_loop_pass_pending = false
	_play_started_msec = 0
	_current_sound = {}
	if not stopped_id.is_empty():
		AnalyticsService.log_sound_stop(stopped, duration_sec)
	playback_stopped.emit(stopped_id)


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
