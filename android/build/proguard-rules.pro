# StimPad — R8 / ProGuard keep rules (release minify only).
# JavaClassWrapper + Godot Android plugins resolve classes by name; do not strip them.

####################################
# Godot engine / JNI
####################################
-keep class org.godotengine.godot.** { *; }
-keep interface org.godotengine.godot.** { *; }
-dontwarn org.godotengine.godot.**

-keepclasseswithmembernames class * {
    native <methods>;
}

-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

-keepattributes *Annotation*,Signature,InnerClasses,EnclosingMethod,EnclosingClass,Exceptions,SourceFile,LineNumberTable,RuntimeVisibleAnnotations,RuntimeInvisibleAnnotations

####################################
# App package — GodotApp + JavaClassWrapper bridges
####################################
-keep class com.godot.game.** { *; }
-keepclassmembers class com.godot.game.** { *; }

# ConsentBridge is called only from GDScript (JavaClassWrapper.wrap). R8 cannot
# see that call, so without this it removes the class and the EU form never opens.
# The $* rule keeps the main-thread lambdas that present the UMP form.
-keep class com.godot.game.ConsentBridge { *; }
-keepclassmembers class com.godot.game.ConsentBridge { *; }
-keep class com.godot.game.ConsentBridge$* { *; }

####################################
# Godot Android plugins (AAR singletons — discovered via manifest meta-data)
####################################
# AdMob / UMP / mediation
-keep class org.godotengine.plugin.admob.** { *; }
-keep class org.godotengine.plugin.admob.AdmobPlugin { *; }
-dontwarn org.godotengine.plugin.admob.**

# Play Games Services plugin (Kotlin AAR)
-keep class com.jacobibanez.plugin.android.godotplaygameservices.** { *; }
-keep class com.jacobibanez.plugin.android.godotplaygameservices.GodotAndroidPlugin { *; }
-dontwarn com.jacobibanez.plugin.android.godotplaygameservices.**

# Google Play Billing plugin
-keep class org.godotengine.plugin.googleplaybilling.** { *; }
-keep class org.godotengine.plugin.googleplaybilling.GodotGooglePlayBilling { *; }
-dontwarn org.godotengine.plugin.googleplaybilling.**

# Any other Godot v2 plugins that may be injected at export time
-keep class org.godotengine.plugin.** { *; }

####################################
# Google Play / Ads / Firebase / Billing / Mediation SDKs
####################################
-keep class com.google.android.gms.** { *; }
-dontwarn com.google.android.gms.**

-keep class com.google.android.play.** { *; }
-dontwarn com.google.android.play.**

-keep class com.google.firebase.** { *; }
-dontwarn com.google.firebase.**

-keep class com.android.billingclient.** { *; }
-dontwarn com.android.billingclient.**

-keep class com.google.android.ump.** { *; }
-keep class com.google.android.gms.internal.consent_sdk.** { *; }
-dontwarn com.google.android.ump.**
-dontwarn com.google.android.gms.internal.consent_sdk.**

# Unity mediation adapter (loaded by reflection from AdMob)
-keep class com.unity3d.** { *; }
-keep class com.google.ads.mediation.unity.** { *; }
-dontwarn com.unity3d.**
-dontwarn com.google.ads.mediation.unity.**
-keep class com.ironsource.** { *; }
-dontwarn com.ironsource.**

# Play Games plugin uses Gson for JSON marshalling
-keep class com.google.gson.** { *; }
-dontwarn com.google.gson.**
-keepclassmembers,allowobfuscation class * {
  @com.google.gson.annotations.SerializedName <fields>;
}

####################################
# AndroidX / Kotlin (Play Games AAR is Kotlin)
####################################
-dontwarn androidx.**
-keep class androidx.lifecycle.** { *; }
-keep class androidx.core.app.NotificationCompat** { *; }
-keep class androidx.core.app.NotificationManagerCompat { *; }
-keep class androidx.core.content.ContextCompat { *; }

-keep class kotlin.Metadata { *; }
-keepclassmembers class kotlin.Metadata {
    public <methods>;
}
-dontwarn kotlin.**
-dontwarn kotlinx.**

####################################
# Parcelable / enums used by GMS
####################################
-keepclassmembers class * implements android.os.Parcelable {
    public static final ** CREATOR;
}
-keepclassmembers enum * {
    public static **[] values();
    public static ** valueOf(java.lang.String);
}
