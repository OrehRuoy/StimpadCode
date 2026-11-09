extends SceneTree
## Headless checks for interstitial caps and rewarded freshness.
## Run: godot --headless --path . -s tools/ad_policy_check.gd


const Ads := preload("res://scripts/ad_policy.gd")


func _init() -> void:
	var failed := 0
	failed += _expect("plus blocks", "Plus", Ads.interstitial_block_reason_for(
		true, true, false, false, false, true, true, false,
		200.0, 0.0, -1.0, 75.0, 180.0
	))
	failed += _expect("sound playing blocks", "playback", Ads.interstitial_block_reason_for(
		true, false, true, false, false, true, true, false,
		200.0, 0.0, -1.0, 75.0, 180.0
	))
	failed += _expect("reward window blocks", "reward window", Ads.interstitial_block_reason_for(
		true, false, false, false, true, true, true, false,
		200.0, 0.0, -1.0, 75.0, 180.0
	))
	failed += _expect("first 75s blocked", "session grace", Ads.interstitial_block_reason_for(
		true, false, false, false, false, true, true, false,
		100.0, 50.0, -1.0, 75.0, 180.0
	))
	failed += _expect("3 min cooldown", "cooldown", Ads.interstitial_block_reason_for(
		true, false, false, false, false, true, true, false,
		300.0, 0.0, 200.0, 75.0, 180.0
	))
	failed += _expect("not loaded yet", "not loaded", Ads.interstitial_block_reason_for(
		true, false, false, false, false, true, false, false,
		300.0, 0.0, -1.0, 75.0, 180.0
	))
	failed += _expect("break is allowed", "", Ads.interstitial_block_reason_for(
		true, false, false, false, false, true, true, false,
		400.0, 0.0, 100.0, 75.0, 180.0
	))
	failed += _expect("consent blocks", "consent", Ads.interstitial_block_reason_for(
		true, false, false, true, false, true, true, false,
		400.0, 0.0, -1.0, 75.0, 180.0
	))
	if Ads.rewarded_ad_is_stale(0.0, 1000.0, 2700.0):
		failed += _fail("fresh empty timestamp looked stale")
	if not Ads.rewarded_ad_is_stale(100.0, 100.0 + 2700.0, 2700.0):
		failed += _fail("45 minute ad was not stale")
	if Ads.rewarded_ad_is_stale(100.0, 100.0 + 2699.0, 2700.0):
		failed += _fail("ad just under 45 minutes looked stale")
	if failed > 0:
		push_error("ad policy check failed: %d" % failed)
		quit(1)
		return
	print("ad policy check ok")
	quit(0)


func _expect(label: String, want: String, got: String) -> int:
	if got == want:
		return 0
	return _fail("%s: want '%s' got '%s'" % [label, want, got])


func _fail(message: String) -> int:
	push_error(message)
	return 1
