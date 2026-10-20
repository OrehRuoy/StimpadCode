# R8 / ProGuard for the Android release build only (minifyEnabled on release).
# GDScript and libgodot.so are not in the DEX. Keep only types loaded by name
# (JNI, manifest meta-data, JavaClassWrapper). SDK AARs ship their own consumer
# rules; a blanket -keep on those packages leaves names intact and fails Play's
# 25% DEX obfuscation check.

-keepattributes Signature
-keepattributes *Annotation*
-keepattributes EnclosingMethod
-keepattributes InnerClasses
-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile

-keepclasseswithmembernames,includedescriptorclasses class * {
    native <methods>;
}

-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

-keepclassmembers class * implements android.os.Parcelable {
    public static final ** CREATOR;
}

-keepclassmembers enum * {
    public static **[] values();
    public static ** valueOf(java.lang.String);
}

-keepclassmembers class ** {
    @kotlin.Metadata *;
}

# Godot engine. JNI and the plugin registry look these up by name.
-keep class org.godotengine.** { *; }

# App classes Godot instantiates from the manifest or JavaClassWrapper.
-keep class com.godot.game.GodotApp { *; }
-keep class com.godot.game.ConsentBridge { *; }
-keep class com.godot.game.ConsentBridge$* { *; }
-keep class com.godot.game.DeviceLayoutBridge { *; }
-keep class com.godot.game.AudioNoisyBridge { *; }
-keep class com.godot.game.AudioNoisyBridge$* { *; }
-keep class com.godot.game.FirebaseAnalyticsBridge { *; }

# GodotGooglePlayBilling — manifest value org.godotengine.plugin.googleplaybilling.GodotGooglePlayBilling
-keep class org.godotengine.plugin.googleplaybilling.** { *; }

# Play Billing client. The plugin calls this API; the AAR's consumer rules cover the rest.
-keep class com.android.billingclient.** { *; }

# AdmobPlugin — manifest value org.godotengine.plugin.admob.AdmobPlugin
-keep class org.godotengine.plugin.admob.** { *; }

# Google Mobile Ads. Names stay on the types AdMob loads by reflection.
# allowobfuscation keeps the rest of the SDK from being stripped while R8
# renames classes the AAR's own rules do not pin (needed for Play's 25% check).
-keep class com.google.android.gms.ads.MobileAds { *; }
-keep class com.google.android.gms.ads.AdRequest { *; }
-keep class com.google.android.gms.ads.initialization.** { *; }
-keep class com.google.ads.mediation.** { *; }
-keep,allowobfuscation class com.google.android.gms.ads.** { public protected *; }

# UMP consent forms, called from ConsentBridge and loaded by the SDK by name.
-keep class com.google.android.ump.** { *; }
-keep class com.google.android.gms.internal.consent_sdk.** { *; }

# InappReviewPlugin — manifest value org.godotengine.plugin.inappreview.InappReviewPlugin
-keep class org.godotengine.plugin.inappreview.** { *; }

# Firebase / Play services. Entry points keep their names; other classes may be renamed.
-keep class com.google.firebase.FirebaseApp { *; }
-keep class com.google.firebase.analytics.FirebaseAnalytics { *; }
-keep,allowobfuscation class com.google.firebase.** { public protected *; }
-keep,allowobfuscation class com.google.android.gms.** { public protected *; }

-dontwarn com.google.android.gms.**
-dontwarn com.google.firebase.**
-dontwarn com.google.android.ump.**
-dontwarn com.android.billingclient.**
-dontwarn com.unity3d.**
-dontwarn com.google.ads.mediation.**
-dontwarn com.google.gson.**
-keepclassmembers,allowobfuscation class * {
    @com.google.gson.annotations.SerializedName <fields>;
}
-dontwarn org.godotengine.**
