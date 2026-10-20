package com.godot.game;

import android.graphics.Insets;
import android.os.Build;
import android.os.Looper;
import android.provider.Settings;
import android.util.Log;
import android.view.DisplayCutout;
import android.view.View;
import android.view.WindowInsets;

import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;

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

	private static final long INSET_CACHE_MS = 32L;

	private static volatile int safeLeft;
	private static volatile int safeTop;
	private static volatile int safeRight;
	private static volatile int safeBottom;
	private static volatile long lastReadUptimeMs;

	private DeviceLayoutBridge() {
	}

	/** Cutout plus system bars, in physical pixels. 0 when the activity is gone. */
	public static int getSafeInsetLeft() {
		refresh();
		return GodotApp.getInstance() == null ? 0 : safeLeft;
	}

	public static int getSafeInsetTop() {
		refresh();
		return GodotApp.getInstance() == null ? 0 : safeTop;
	}

	public static int getSafeInsetRight() {
		refresh();
		return GodotApp.getInstance() == null ? 0 : safeRight;
	}

	public static int getSafeInsetBottom() {
		refresh();
		return GodotApp.getInstance() == null ? 0 : safeBottom;
	}

	/** Read insets on the Android UI thread. Off-thread callers wait briefly for that read. */
	public static void refresh() {
		GodotApp activity = GodotApp.getInstance();
		if (activity == null) {
			safeLeft = 0;
			safeTop = 0;
			safeRight = 0;
			safeBottom = 0;
			lastReadUptimeMs = 0L;
			return;
		}
		long now = android.os.SystemClock.uptimeMillis();
		if (now - lastReadUptimeMs < INSET_CACHE_MS) {
			return;
		}
		if (Looper.myLooper() == Looper.getMainLooper()) {
			readFromDecor(activity);
			return;
		}
		CountDownLatch latch = new CountDownLatch(1);
		activity.runOnUiThread(() -> {
			try {
				if (GodotApp.getInstance() != null) {
					readFromDecor(GodotApp.getInstance());
				}
			} finally {
				latch.countDown();
			}
		});
		try {
			if (!latch.await(250, TimeUnit.MILLISECONDS)) {
				Log.w(TAG, "timed out waiting for window insets");
			}
		} catch (InterruptedException e) {
			Thread.currentThread().interrupt();
		}
	}

	private static void readFromDecor(GodotApp activity) {
		if (activity.getWindow() == null) {
			return;
		}
		View decor = activity.getWindow().getDecorView();
		if (decor == null) {
			return;
		}
		WindowInsets insets = decor.getRootWindowInsets();
		if (insets == null) {
			return;
		}
		if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
			Insets bars = insets.getInsets(WindowInsets.Type.systemBars() | WindowInsets.Type.displayCutout());
			safeLeft = bars.left;
			safeTop = bars.top;
			safeRight = bars.right;
			safeBottom = bars.bottom;
		} else {
			safeLeft = insets.getSystemWindowInsetLeft();
			safeTop = insets.getSystemWindowInsetTop();
			safeRight = insets.getSystemWindowInsetRight();
			safeBottom = insets.getSystemWindowInsetBottom();
			if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
				DisplayCutout cutout = insets.getDisplayCutout();
				if (cutout != null) {
					safeLeft = Math.max(safeLeft, cutout.getSafeInsetLeft());
					safeTop = Math.max(safeTop, cutout.getSafeInsetTop());
					safeRight = Math.max(safeRight, cutout.getSafeInsetRight());
					safeBottom = Math.max(safeBottom, cutout.getSafeInsetBottom());
				}
			}
		}
		lastReadUptimeMs = android.os.SystemClock.uptimeMillis();
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
