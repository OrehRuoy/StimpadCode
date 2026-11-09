extends RefCounted
## Tune fullscreen ad caps here. Remote Config is not used.
## At most one interstitial per INTERSTITIAL_MIN_INTERVAL_SEC, and none during
## the first INTERSTITIAL_SESSION_GRACE_SEC of a cold start.
## Rewarded ads expire about an hour after load; reload before REWARDED_MAX_AGE_SEC.


const INTERSTITIAL_MIN_INTERVAL_SEC := 180.0
const INTERSTITIAL_SESSION_GRACE_SEC := 75.0
const REWARDED_MAX_AGE_SEC := 45.0 * 60.0


static func interstitial_block_reason_for(
	ads_on: bool,
	plus: bool,
	playback: bool,
	consent_blocked: bool,
	reward_window: bool,
	sdk_ready: bool,
	loaded: bool,
	fullscreen: bool,
	now: float,
	session_started: float,
	last_shown: float,
	grace_sec: float,
	interval_sec: float,
) -> String:
	if not ads_on:
		return "ads off"
	if plus:
		return "Plus"
	if playback:
		return "playback"
	if consent_blocked:
		return "consent"
	## Someone just watched a rewarded ad for the 20-minute window. Don't stack another fullscreen ad on it.
	if reward_window:
		return "reward window"
	if fullscreen:
		return "fullscreen"
	if not sdk_ready:
		return "SDK"
	if session_started > 0.0 and now - session_started < grace_sec:
		return "session grace"
	if last_shown > 0.0 and now - last_shown < interval_sec:
		return "cooldown"
	if not loaded:
		return "not loaded"
	return ""


static func rewarded_ad_is_stale(loaded_unix: float, now: float, max_age_sec: float) -> bool:
	if loaded_unix <= 0.0:
		return false
	return now - loaded_unix >= max_age_sec
