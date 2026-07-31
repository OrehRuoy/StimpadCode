extends Button

var _sound: Dictionary = {}


func setup(sound: Dictionary) -> void:
	_sound = sound
	text = str(sound.get("name", "Sound"))
	custom_minimum_size = Vector2(150, 150)
	var unlocked := SoundCatalog.is_sound_unlocked(sound)
	if not unlocked:
		modulate = Color(0.75, 0.75, 0.8, 1.0)
		text = "%s 🔒" % str(sound.get("name", ""))
	var art_path: String = str(sound.get("art", ""))
	if art_path != "" and ResourceLoader.exists(art_path):
		icon = load(art_path)
		expand_icon = true
		icon_alignment = HORIZONTAL_ALIGNMENT_CENTER
