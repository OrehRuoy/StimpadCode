package com.godot.game;

import android.os.Bundle;
import android.os.Build;
import android.provider.Settings;
import android.util.Log;

import com.google.firebase.analytics.FirebaseAnalytics;

import org.json.JSONException;
import org.json.JSONObject;

import java.util.Iterator;

/**
 * Sends custom events to Firebase Analytics. Closed testing + release builds are allowed;
 * only emulators, optional ANDROID_ID blocklist, and missing activity are excluded.
 * <p>
 * Params are passed as JSON from Godot (Dictionary → JSON.stringify) so JNI receives a
 * plain String — Map/Dictionary bridging was unreliable for custom parameter display in Firebase.
 */
public final class FirebaseAnalyticsBridge {
	private static final String TAG = "StimPadAnalytics";
	private static FirebaseAnalytics firebaseAnalytics;
	private static Boolean cachedShouldTrackAnalytics;

	/**
	 * ANDROID_ID values (hex, typically 16 chars) for devices that must not send analytics
	 * (e.g. your personal phone used for AdMob test device + local QA). Closed testers are not listed here.
	 * <p>
	 * Find yours: {@code adb shell settings get secure android_id}
	 */
	private static final String[] ANALYTICS_EXCLUDED_ANDROID_IDS = {
	};

	private FirebaseAnalyticsBridge() {
	}

	private static FirebaseAnalytics getAnalytics() {
		if (firebaseAnalytics != null) {
			return firebaseAnalytics;
		}
		GodotApp activity = GodotApp.getInstance();
		if (activity == null) {
			Log.w(TAG, "GodotApp instance unavailable; cannot initialize FirebaseAnalytics.");
			return null;
		}
		try {
			firebaseAnalytics = FirebaseAnalytics.getInstance(activity.getApplicationContext());
		} catch (Exception e) {
			Log.w(TAG, "FirebaseAnalytics unavailable: " + e.getMessage());
			return null;
		}
		return firebaseAnalytics;
	}

	public static boolean shouldTrackAnalytics() {
		if (cachedShouldTrackAnalytics != null) {
			return cachedShouldTrackAnalytics;
		}

		// Local debug APKs use a separate application id (e.g. *.debug) without a Firebase client.
		if (BuildConfig.APPLICATION_ID != null && BuildConfig.APPLICATION_ID.endsWith(".debug")) {
			cachedShouldTrackAnalytics = false;
			Log.i(TAG, "Analytics disabled (debug application id).");
			return false;
		}

		GodotApp activity = GodotApp.getInstance();
		if (activity == null) {
			cachedShouldTrackAnalytics = false;
			return false;
		}

		if (isLikelyEmulator()) {
			cachedShouldTrackAnalytics = false;
			Log.i(TAG, "Analytics disabled (emulator).");
			return false;
		}

		String androidId = getAndroidId(activity);
		if (isExcludedAndroidId(androidId)) {
			cachedShouldTrackAnalytics = false;
			Log.i(TAG, "Analytics disabled (device on ANALYTICS_EXCLUDED_ANDROID_IDS).");
			return false;
		}

		// Closed testing / internal tracks often use debuggable or ADB-enabled devices — still send analytics.
		cachedShouldTrackAnalytics = true;
		return true;
	}

	private static String getAndroidId(GodotApp activity) {
		try {
			String id = Settings.Secure.getString(activity.getContentResolver(), Settings.Secure.ANDROID_ID);
			return id == null ? "" : id.toLowerCase();
		} catch (Exception e) {
			return "";
		}
	}

	private static boolean isExcludedAndroidId(String androidId) {
		if (androidId.isEmpty()) {
			return false;
		}
		for (String blocked : ANALYTICS_EXCLUDED_ANDROID_IDS) {
			if (blocked == null || blocked.isEmpty()) {
				continue;
			}
			if (androidId.equalsIgnoreCase(blocked.trim())) {
				return true;
			}
		}
		return false;
	}

	/**
	 * Preferred entry from Godot: one JSON string avoids JavaClassWrapper dropping the 2nd argument.
	 * Shape: {@code {"event":"level_completed","params":{"level_number":"12",...}}}
	 */
	public static void logEventJson(String payloadJson) {
		if (payloadJson == null || payloadJson.isEmpty()) {
			return;
		}
		if (!shouldTrackAnalytics()) {
			return;
		}
		try {
			JSONObject root = new JSONObject(payloadJson);
			String eventName = root.optString("event", "");
			if (eventName.isEmpty()) {
				Log.w(TAG, "logEventJson missing event name");
				return;
			}
			JSONObject params = root.optJSONObject("params");
			dispatchLogEvent(eventName, params);
		} catch (JSONException e) {
			Log.w(TAG, "Bad analytics payload JSON: " + e.getMessage());
		}
	}

	/**
	 * @param eventName Firebase event name (already sanitized on GDScript side).
	 * @param paramsJson JSON object string of string/number/boolean values, or "{}".
	 */
	public static void logEvent(String eventName, String paramsJson) {
		if (eventName == null || eventName.isEmpty()) {
			return;
		}
		if (!shouldTrackAnalytics()) {
			return;
		}
		JSONObject params = null;
		if (paramsJson != null && !paramsJson.isEmpty() && !paramsJson.equals("{}")) {
			try {
				params = new JSONObject(paramsJson);
			} catch (JSONException e) {
				Log.w(TAG, "Bad analytics params JSON for event " + eventName + ": " + e.getMessage());
			}
		}
		dispatchLogEvent(eventName, params);
	}

	private static void dispatchLogEvent(String eventName, JSONObject params) {
		FirebaseAnalytics analytics = getAnalytics();
		if (analytics == null) {
			return;
		}
		Bundle bundle = new Bundle();
		if (params != null) {
			Iterator<String> keys = params.keys();
			while (keys.hasNext()) {
				String key = keys.next();
				if (key == null || key.isEmpty()) {
					continue;
				}
				try {
					putJsonValue(bundle, key, params.get(key));
				} catch (JSONException e) {
					Log.w(TAG, "Skip param " + key + " on " + eventName + ": " + e.getMessage());
				}
			}
		}
		if (BuildConfig.DEBUG) {
			Log.d(TAG, "logEvent " + eventName + " paramCount=" + bundle.size());
		} else if (eventName.contains("share")) {
			Log.i(TAG, "logEvent " + eventName + " paramCount=" + bundle.size());
		}
		analytics.logEvent(eventName, bundle);
	}

	/**
	 * One JSON string so JavaClassWrapper cannot drop a 2nd JNI argument.
	 * Shape: {@code {"name":"game_mode","value":"arcade"}}
	 */
	public static void setUserPropertyJson(String payloadJson) {
		if (payloadJson == null || payloadJson.isEmpty()) {
			return;
		}
		if (!shouldTrackAnalytics()) {
			return;
		}
		FirebaseAnalytics analytics = getAnalytics();
		if (analytics == null) {
			return;
		}
		try {
			JSONObject root = new JSONObject(payloadJson);
			String name = root.optString("name", "");
			String value = root.optString("value", "");
			if (name.isEmpty()) {
				Log.w(TAG, "setUserPropertyJson missing name");
				return;
			}
			analytics.setUserProperty(name, value.isEmpty() ? null : value);
		} catch (JSONException e) {
			Log.w(TAG, "Bad user-property payload JSON: " + e.getMessage());
		}
	}

	private static void putJsonValue(Bundle bundle, String key, Object val) throws JSONException {
		if (val == null || val == JSONObject.NULL) {
			return;
		}
		if (isGa4StringDimension(key)) {
			bundle.putString(key, String.valueOf(val));
			return;
		}
		if (val instanceof Boolean) {
			bundle.putLong(key, ((Boolean) val) ? 1L : 0L);
		} else if (val instanceof Integer) {
			bundle.putInt(key, (Integer) val);
		} else if (val instanceof Long) {
			bundle.putLong(key, (Long) val);
		} else if (val instanceof Double) {
			double d = (Double) val;
			if (d == Math.rint(d) && d >= Integer.MIN_VALUE && d <= Integer.MAX_VALUE) {
				bundle.putInt(key, (int) d);
			} else {
				bundle.putDouble(key, d);
			}
		} else if (val instanceof Float) {
			bundle.putFloat(key, (Float) val);
		} else if (val instanceof Number) {
			bundle.putDouble(key, ((Number) val).doubleValue());
		} else if (val instanceof String) {
			bundle.putString(key, (String) val);
		} else {
			bundle.putString(key, String.valueOf(val));
		}
	}

	/** GA4 custom dimensions only persist strings. */
	private static boolean isGa4StringDimension(String key) {
		return "level_number".equals(key)
				|| "skin_name".equals(key)
				|| "game_mode".equals(key)
				|| "ad_format".equals(key);
	}

	private static boolean isLikelyEmulator() {
		String fingerprint = Build.FINGERPRINT == null ? "" : Build.FINGERPRINT.toLowerCase();
		String model = Build.MODEL == null ? "" : Build.MODEL.toLowerCase();
		String manufacturer = Build.MANUFACTURER == null ? "" : Build.MANUFACTURER.toLowerCase();
		String brand = Build.BRAND == null ? "" : Build.BRAND.toLowerCase();
		String device = Build.DEVICE == null ? "" : Build.DEVICE.toLowerCase();
		String product = Build.PRODUCT == null ? "" : Build.PRODUCT.toLowerCase();
		String hardware = Build.HARDWARE == null ? "" : Build.HARDWARE.toLowerCase();

		return fingerprint.contains("generic")
				|| fingerprint.contains("unknown")
				|| model.contains("emulator")
				|| model.contains("android sdk built for")
				|| manufacturer.contains("genymotion")
				|| brand.startsWith("generic")
				|| device.startsWith("generic")
				|| product.contains("sdk")
				|| hardware.contains("goldfish")
				|| hardware.contains("ranchu");
	}
}
