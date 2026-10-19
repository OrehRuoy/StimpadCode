package com.godot.game;

import android.content.Context;
import android.content.SharedPreferences;
import android.util.Log;

import androidx.annotation.Keep;

import com.google.android.ump.ConsentInformation;
import com.google.android.ump.ConsentRequestParameters;
import com.google.android.ump.UserMessagingPlatform;

/**
 * UMP helpers the AdMob Godot plugin does not expose.
 * Called from GDScript through JavaClassWrapper.
 *
 * canRequestAds() is Google's gate: true when consent is NOT_REQUIRED, or when
 * the user has accepted or denied the form (status OBTAINED).
 */
@Keep
public final class ConsentBridge {
	private static final String TAG = "ConsentBridge";
	/** 0 idle, 1 running, 2 finished. GDScript polls this; UMP has no Godot signal. */
	public static final int GATHER_IDLE = 0;
	public static final int GATHER_RUNNING = 1;
	public static final int GATHER_DONE = 2;
	/** 0 idle, 1 showing, 2 closed. */
	private static volatile int privacyFormState = 0;
	private static volatile int gatherState = GATHER_IDLE;
	private static volatile String gatherError = "";
	private static volatile boolean canRequestAdsCached = false;
	private static volatile boolean privacyOptionsRequiredCached = false;
	private static volatile String consentStatusName = "UNKNOWN";
	private static int focusWaits = 0;

	private ConsentBridge() {
	}

	/**
	 * Google's required sequence, on the Android main thread.
	 * Godot calls Java off that thread. The plugin's update_consent_info() does
	 * not hop over, and UMP then refuses the call, so the EU form never opens.
	 * loadAndShowConsentFormIfRequired shows the form only when this country
	 * requires a choice, and returns immediately otherwise.
	 */
	public static void gatherConsent() {
		if (gatherState == GATHER_RUNNING) {
			return;
		}
		GodotApp activity = GodotApp.getInstance();
		if (activity == null) {
			gatherError = "no activity";
			gatherState = GATHER_DONE;
			return;
		}
		gatherError = "";
		gatherState = GATHER_RUNNING;
		focusWaits = 0;
		activity.runOnUiThread(() -> gatherOnUi(activity));
	}

	/**
	 * UMP will not present the form unless this runs on the main thread while
	 * the activity is in front. The AdMob Godot plugin calls
	 * requestConsentInfoUpdate from Godot's thread, and UMP then refuses it.
	 */
	private static void gatherOnUi(GodotApp activity) {
		if (activity.isFinishing()) {
			finishGather(activity, "activity finishing");
			return;
		}
		if (!activity.hasWindowFocus() && focusWaits < 25 && activity.getWindow() != null) {
			focusWaits++;
			activity.getWindow().getDecorView().postDelayed(() -> gatherOnUi(activity), 200);
			return;
		}
		try {
			ConsentRequestParameters params = new ConsentRequestParameters.Builder()
					.setTagForUnderAgeOfConsent(false)
					.build();
			ConsentInformation info = UserMessagingPlatform.getConsentInformation(activity);
			info.requestConsentInfoUpdate(
					activity,
					params,
					() -> UserMessagingPlatform.loadAndShowConsentFormIfRequired(activity, formError -> {
						String error = "";
						if (formError != null) {
							error = formError.getErrorCode() + ": " + formError.getMessage();
							Log.w(TAG, "consent form: " + error);
						}
						finishGather(activity, error);
					}),
					requestError -> {
						String error = requestError.getErrorCode() + ": " + requestError.getMessage();
						Log.w(TAG, "consent info update failed: " + error);
						finishGather(activity, error);
					});
		} catch (RuntimeException e) {
			Log.w(TAG, "gatherConsent: " + e.getMessage());
			finishGather(activity, e.getMessage() == null ? e.toString() : e.getMessage());
		}
	}

	public static int getGatherState() {
		return gatherState;
	}

	public static String getGatherError() {
		return gatherError == null ? "" : gatherError;
	}

	/** Cached on the UI thread when gather finishes. Safe to read from Godot's thread. */
	public static boolean allowsAdRequests() {
		return canRequestAdsCached;
	}

	public static String getConsentStatusName() {
		return consentStatusName == null ? "UNKNOWN" : consentStatusName;
	}

	private static void finishGather(GodotApp activity, String error) {
		ConsentInformation info = UserMessagingPlatform.getConsentInformation(activity);
		canRequestAdsCached = info.canRequestAds();
		privacyOptionsRequiredCached = info.getPrivacyOptionsRequirementStatus()
				== ConsentInformation.PrivacyOptionsRequirementStatus.REQUIRED;
		consentStatusName = statusName(info.getConsentStatus());
		gatherError = error == null ? "" : error;
		Log.i(TAG, "gather finished status=" + consentStatusName
				+ " canRequestAds=" + canRequestAdsCached
				+ " privacyOptions=" + privacyOptionsRequiredCached
				+ " error=" + gatherError);
		gatherState = GATHER_DONE;
	}

	private static String statusName(int status) {
		switch (status) {
			case ConsentInformation.ConsentStatus.REQUIRED:
				return "REQUIRED";
			case ConsentInformation.ConsentStatus.NOT_REQUIRED:
				return "NOT_REQUIRED";
			case ConsentInformation.ConsentStatus.OBTAINED:
				return "OBTAINED";
			default:
				return "UNKNOWN";
		}
	}

	/** True in regions whose privacy message requires a settings entry point (EEA/UK). */
	public static boolean isPrivacyOptionsRequired() {
		return privacyOptionsRequiredCached;
	}

	/**
	 * True only when this player may be sent an ad request.
	 * Outside GDPR the TCF flag is absent and this is true.
	 * Inside GDPR, purpose 1 (store/access information on the device) must be
	 * an explicit grant. A deny, or a missing string, is not approval.
	 */
	public static boolean hasAdsConsent() {
		GodotApp activity = GodotApp.getInstance();
		if (activity == null) {
			return false;
		}
		// Same file UMP writes (PreferenceManager default: {package}_preferences).
		SharedPreferences prefs = activity.getSharedPreferences(
				activity.getPackageName() + "_preferences", Context.MODE_PRIVATE);
		if (readGdprApplies(prefs) != 1) {
			return true;
		}
		String purposes = prefs.getString("IABTCF_PurposeConsents", "");
		if (purposes != null && !purposes.isEmpty()) {
			return purposes.charAt(0) == '1';
		}
		// UMP 4 consent-mode int: 1 granted, 2 denied. Missing is not a grant.
		return readPrefInt(prefs, "UMP_CoMoAdStoragePurposeConsentStatus", -1) == 1;
	}

	public static void showPrivacyOptionsForm() {
		GodotApp activity = GodotApp.getInstance();
		if (activity == null) {
			Log.w(TAG, "showPrivacyOptionsForm: no activity");
			privacyFormState = 2;
			return;
		}
		privacyFormState = 1;
		activity.runOnUiThread(() -> UserMessagingPlatform.showPrivacyOptionsForm(activity, formError -> {
			if (formError != null) {
				Log.w(TAG, "privacy options form: " + formError.getErrorCode() + " " + formError.getMessage());
			}
			finishGather(activity, "");
			privacyFormState = 2;
		}));
	}

	public static int getPrivacyFormState() {
		return privacyFormState;
	}

	public static void clearPrivacyFormState() {
		privacyFormState = 0;
	}

	private static int readGdprApplies(SharedPreferences prefs) {
		return readPrefInt(prefs, "IABTCF_gdprApplies", 0);
	}

	private static int readPrefInt(SharedPreferences prefs, String key, int fallback) {
		try {
			return prefs.getInt(key, fallback);
		} catch (ClassCastException ignored) {
			try {
				return Integer.parseInt(prefs.getString(key, Integer.toString(fallback)));
			} catch (NumberFormatException bad) {
				return fallback;
			}
		}
	}
}
