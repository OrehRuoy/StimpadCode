extends Node
## Picks a language from the device locale and loads StimPad's translations.
## Uses the phone language (de, es, fr, pt_BR, ja), not the GPS country.
## Anything else stays English.


const MESSAGES_PATH := "res://locale/messages.json"

const _LOCALE_BY_LANGUAGE := {
	"de": "de",
	"es": "es",
	"fr": "fr",
	"pt": "pt_BR",
	"ja": "ja",
	"en": "en",
}


func _ready() -> void:
	_load_messages()
	TranslationServer.set_locale(_locale_for_device())


func _locale_for_device() -> String:
	var raw := OS.get_locale().replace("-", "_")
	var language := raw.split("_")[0].to_lower()
	return str(_LOCALE_BY_LANGUAGE.get(language, "en"))


func _load_messages() -> void:
	var file := FileAccess.open(MESSAGES_PATH, FileAccess.READ)
	if file == null:
		push_error("LocaleService: missing %s" % MESSAGES_PATH)
		return
	var parsed: Variant = JSON.parse_string(file.get_as_text())
	file.close()
	if typeof(parsed) != TYPE_DICTIONARY:
		push_error("LocaleService: messages.json is not an object")
		return
	var by_locale: Dictionary = {}
	for key in parsed.keys():
		var row: Variant = parsed[key]
		if typeof(row) != TYPE_DICTIONARY:
			continue
		for locale in row.keys():
			if not by_locale.has(locale):
				var translation := Translation.new()
				translation.locale = str(locale)
				by_locale[locale] = translation
			(by_locale[locale] as Translation).add_message(str(key), str(row[locale]))
	for locale in by_locale.keys():
		TranslationServer.add_translation(by_locale[locale])
