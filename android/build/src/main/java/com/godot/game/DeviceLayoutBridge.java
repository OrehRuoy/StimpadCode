package com.godot.game;

import android.provider.Settings;
import android.util.Log;

/**
 * Device chrome helpers for Godot (JavaClassWrapper).
 * Used to keep the bottom banner off the 3-button Home control without
 * changing layout for gesture-nav phones.
 */
public final class DeviceLayoutBridge {
	private static final String TAG = "DeviceLayoutBridge";

	/** Settings.Secure.NAVIGATION_MODE: 0 = 3-button, 1 = 2-button, 2 = gesture. */
	private static final String NAVIGATION_MODE = "navigation_mode";
	private static final int MODE_THREE_BUTTON = 0;
	private static final int MODE_TWO_BUTTON = 1;
	private static final int MODE_GESTURE = 2;

	private DeviceLayoutBridge() {
	}

	public static int getNavigationMode() {
		GodotApp activity = GodotApp.getInstance();
		if (activity == null) {
			return -1;
		}
		try {
			return Settings.Secure.getInt(activity.getContentResolver(), NAVIGATION_MODE, MODE_GESTURE);
		} catch (Exception e) {
			Log.w(TAG, "navigation_mode unavailable: " + e.getMessage());
			return -1;
		}
	}

	/** True when Back/Home/Recents (or 2-button Home) is on screen. */
	public static boolean hasOnScreenNavButtons() {
		int mode = getNavigationMode();
		return mode == MODE_THREE_BUTTON || mode == MODE_TWO_BUTTON;
	}
}
