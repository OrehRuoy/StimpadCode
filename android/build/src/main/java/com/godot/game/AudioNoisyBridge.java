package com.godot.game;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.media.AudioManager;
import android.os.Build;

import androidx.annotation.Keep;

/**
 * Sets a flag when headphones or Bluetooth audio disconnect so a loop
 * does not continue on the speaker. Godot polls takeNoisyFlag().
 */
@Keep
public final class AudioNoisyBridge {
	private static volatile boolean noisy;
	private static BroadcastReceiver receiver;
	private static boolean registered;

	private AudioNoisyBridge() {
	}

	public static void register(Context context) {
		if (context == null || registered) {
			return;
		}
		if (receiver == null) {
			receiver = new BroadcastReceiver() {
				@Override
				public void onReceive(Context ignored, Intent intent) {
					if (intent != null && AudioManager.ACTION_AUDIO_BECOMING_NOISY.equals(intent.getAction())) {
						noisy = true;
					}
				}
			};
		}
		IntentFilter filter = new IntentFilter(AudioManager.ACTION_AUDIO_BECOMING_NOISY);
		if (Build.VERSION.SDK_INT >= 33) {
			context.registerReceiver(receiver, filter, Context.RECEIVER_NOT_EXPORTED);
		} else {
			context.registerReceiver(receiver, filter);
		}
		registered = true;
	}

	public static void unregister(Context context) {
		if (context == null || !registered || receiver == null) {
			return;
		}
		try {
			context.unregisterReceiver(receiver);
		} catch (IllegalArgumentException ignored) {
		}
		registered = false;
	}

	public static boolean takeNoisyFlag() {
		if (!noisy) {
			return false;
		}
		noisy = false;
		return true;
	}
}
