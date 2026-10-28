extends Node

## One Plus-tier sound, the same for everyone on the same local date.
## index = days since 2026-01-01, modulo the Plus catalog, in catalog order.

const EPOCH_YEAR := 2026
const EPOCH_MONTH := 1
const EPOCH_DAY := 1


func plus_sounds() -> Array[Dictionary]:
	var out: Array[Dictionary] = []
	for sound in SoundCatalog.sounds:
		if str(sound.get("tier", "")).to_lower() == "plus":
			out.append(sound)
	return out


func today_parts() -> Dictionary:
	var now := Time.get_date_dict_from_system()
	return {"year": int(now.year), "month": int(now.month), "day": int(now.day)}


func days_since_epoch(year: int, month: int, day: int) -> int:
	return _days_from_civil(year, month, day) - _days_from_civil(EPOCH_YEAR, EPOCH_MONTH, EPOCH_DAY)


func sound_on(year: int, month: int, day: int) -> Dictionary:
	var list := plus_sounds()
	if list.is_empty():
		return {}
	var days := days_since_epoch(year, month, day)
	if days < 0:
		days = 0
	return list[days % list.size()]


func today_sound() -> Dictionary:
	var today := today_parts()
	return sound_on(int(today.year), int(today.month), int(today.day))


func today_id() -> String:
	return str(today_sound().get("id", ""))


func is_free_today(sound_id: String) -> bool:
	return not sound_id.is_empty() and sound_id == today_id()


func add_days(year: int, month: int, day: int, delta: int) -> Dictionary:
	return _civil_from_days(_days_from_civil(year, month, day) + delta)


func note_badge_shown(sound_id: String) -> void:
	if sound_id.is_empty() or not is_free_today(sound_id):
		return
	var today := _today_key()
	if LocalPrefs.daily_sound_shown_day == today:
		return
	LocalPrefs.daily_sound_shown_day = today
	LocalPrefs.save_prefs()
	AnalyticsService.log_event("daily_sound_shown", {
		"sound_id": sound_id,
		"days_since_first_open": LocalPrefs.days_since_first_open(),
	})


func _today_key() -> String:
	var today := today_parts()
	return "%04d-%02d-%02d" % [int(today.year), int(today.month), int(today.day)]


func _days_from_civil(year: int, month: int, day: int) -> int:
	var y := year
	var m := month
	if m <= 2:
		y -= 1
	var era := y / 400
	var yoe := y - era * 400
	var doy := (153 * (m + (-3 if m > 2 else 9)) + 2) / 5 + day - 1
	var doe := yoe * 365 + yoe / 4 - yoe / 100 + doy
	return era * 146097 + doe - 719468


func _civil_from_days(z: int) -> Dictionary:
	z += 719468
	var era := z / 146097
	var doe := z - era * 146097
	var yoe := (doe - doe / 1460 + doe / 36524 - doe / 146096) / 365
	var y := yoe + era * 400
	var doy := doe - (365 * yoe + yoe / 4 - yoe / 100)
	var mp := (5 * doy + 2) / 153
	var d := doy - (153 * mp + 2) / 5 + 1
	var m := mp + (3 if mp < 10 else -9)
	if m <= 2:
		y += 1
	return {"year": y, "month": m, "day": d}
