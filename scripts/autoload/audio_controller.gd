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


func _ready() -> void:
	_player = AudioStreamPlayer.new()
	_player.name = "MainAudioPlayer"
	add_child(_player)
	_player.finished.connect(_on_player_finished)

	_session_timer = Timer.new()
	_session_timer.one_shot = true
	_session_timer.timeout.connect(_on_session_timer_timeout)
	add_child(_session_timer)


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
	_player.stream = stream
	var mode: String = str(sound.get("mode", "oneshot"))
	if mode == "loop":
		if stream is AudioStreamOggVorbis:
			stream.loop = true
		elif stream is AudioStreamWAV:
			stream.loop_mode = AudioStreamWAV.LOOP_FORWARD
		_stop_after_loop = false
		_loop_pass_pending = false
		_session_timer.start(float(_session_duration_sec))
	else:
		_session_timer.stop()
		_stop_after_loop = false
	_player.play()
	playback_started.emit(str(sound.get("id", "")))
	AnalyticsService.log_event("sound_play", {"sound_id": str(sound.get("id", ""))})


func replay_current() -> void:
	if _current_sound.is_empty():
		return
	play_sound(_current_sound)


func stop() -> void:
	if not is_playing() and _current_sound.is_empty():
		return
	var stopped_id := str(_current_sound.get("id", ""))
	_player.stop()
	_session_timer.stop()
	_stop_after_loop = false
	_loop_pass_pending = false
	_current_sound = {}
	playback_stopped.emit(stopped_id)


func _on_session_timer_timeout() -> void:
	if str(_current_sound.get("mode", "")) == "loop":
		_stop_after_loop = true
		if not _player.playing:
			stop()
	else:
		stop()


func _on_player_finished() -> void:
	var finished_id := str(_current_sound.get("id", ""))
	if _stop_after_loop:
		stop()
		playback_finished.emit(finished_id)
		return
	if str(_current_sound.get("mode", "")) == "oneshot":
		_current_sound = {}
		playback_finished.emit(finished_id)
