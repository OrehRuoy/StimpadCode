class_name HouseAds
extends RefCounted
## Cross-promo banners for an empty AdMob slot.
## StimPad never promotes itself. An app is included only on a store where it is published.

const APPS := {
	"circuit_sort": {
		"banner": "res://assets/house_ads/circuit_sort_banner_1280x200.png",
		"ios_app_id": "6789962999",
		"android_package": "com.circuitsort.screwpuzzle",
	},
	"whats_4_dinner": {
		"banner": "res://assets/house_ads/whats_4_dinner_banner_1280x200.png",
		"ios_app_id": "6794008104",
		"android_package": "com.whats4dinner.whats4dinner",
	},
	"spectrum_sync": {
		"banner": "res://assets/house_ads/spectrum_sync_banner_1280x200.png",
		"ios_app_id": "6794476571",
		"android_package": "com.spectrumsync.keyboard",
	},
	"taptico": {
		"banner": "res://assets/house_ads/taptico_banner_1280x200.png",
		"ios_app_id": "6803560086",
		"android_package": "",
	},
	"oil_due": {
		"banner": "res://assets/house_ads/oil_due_banner_1280x200.png",
		"ios_app_id": "6805591903",
		"android_package": "",
	},
	"fork_it": {
		"banner": "res://assets/house_ads/fork_it_banner_1280x200.png",
		"ios_app_id": "",
		"android_package": "com.forkit.randomrestaurant",
	},
	"sensorfit": {
		"banner": "res://assets/house_ads/sensorfit_banner_1280x200.png",
		"ios_app_id": "",
		"android_package": "com.sensorfit.pushupcounter",
	},
}


static func for_platform() -> Array[Dictionary]:
	var on_ios := OS.has_feature("ios")
	var ads: Array[Dictionary] = []
	for app_id in APPS.keys():
		var app: Dictionary = APPS[app_id]
		var banner := str(app.get("banner", ""))
		if banner.is_empty() or not ResourceLoader.exists(banner):
			continue
		if on_ios:
			var apple_id := str(app.get("ios_app_id", "")).strip_edges()
			if apple_id.is_empty():
				continue
			ads.append({
				"id": str(app_id),
				"banner": banner,
				"url": "https://apps.apple.com/app/id%s?ct=stimpad" % apple_id,
			})
		else:
			var package_name := str(app.get("android_package", "")).strip_edges()
			if package_name.is_empty():
				continue
			ads.append({
				"id": str(app_id),
				"banner": banner,
				"url": "https://play.google.com/store/apps/details?id=%s&utm_source=stimpad&utm_medium=houseads" % package_name,
			})
	return ads
