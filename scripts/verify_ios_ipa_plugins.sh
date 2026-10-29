#!/usr/bin/env bash
# Verify StimPad IPA contains AdmobPlugin symbols.
set -euo pipefail
IPA="${1:?Usage: verify_ios_ipa_plugins.sh path/to.ipa}"
TMP=$(mktemp -d)
unzip -q "$IPA" -d "$TMP"
APP=$(find "$TMP/Payload" -maxdepth 1 -name '*.app' | head -1)
BIN="$APP/$(basename "$APP" .app)"
strings "$BIN" > "$TMP/strings.txt"
grep -q 'AdmobPlugin' "$TMP/strings.txt" || { echo 'AdmobPlugin not found in binary'; exit 1; }
plugin_strings="$(cat "$TMP/strings.txt" || true)"
if ! printf '%s\n' "$plugin_strings" | grep -c 'StimPadLocalNotifications' >/dev/null; then
  echo 'StimPadLocalNotifications not found in binary'
  exit 1
fi
echo "LocalNotificationPlugin class present"
# Soft-check Unity mediation adapter (present when pods linked).
if grep -qE 'UnityAds|GADMediationAdapterUnity|UMSUnity' "$TMP/strings.txt"; then
  echo "Unity Ads mediation symbols present in binary"
else
  echo "::warning::Unity Ads mediation strings not found — check Podfile / workspace archive"
fi
# Firebase Analytics (GodotFirebaseiOS) — soft check; plist must be in the app bundle.
if [ -f "$APP/GoogleService-Info.plist" ]; then
  echo "GoogleService-Info.plist present in app bundle"
else
  echo "::warning::GoogleService-Info.plist missing from app bundle — Analytics will not initialize"
fi
# App Store 90057: embedded GodotFirebaseiOS.framework needs CFBundleShortVersionString.
FB_PLIST=$(find "$APP/Frameworks" -path "*/GodotFirebaseiOS.framework/Info.plist" 2>/dev/null | head -1 || true)
if [ -n "$FB_PLIST" ]; then
  if /usr/libexec/PlistBuddy -c "Print :CFBundleShortVersionString" "$FB_PLIST" >/dev/null 2>&1; then
    echo "GodotFirebaseiOS.framework CFBundleShortVersionString OK"
  else
    echo "::error::GodotFirebaseiOS.framework missing CFBundleShortVersionString (App Store 90057)"
    exit 1
  fi
else
  echo "::warning::GodotFirebaseiOS.framework not found under Frameworks/"
fi
# Soft-require AdMob Info.plist keys (headless export sometimes omits them).
if /usr/libexec/PlistBuddy -c "Print :GADApplicationIdentifier" "$APP/Info.plist" >/dev/null 2>&1; then
  echo "GADApplicationIdentifier present: $(/usr/libexec/PlistBuddy -c "Print :GADApplicationIdentifier" "$APP/Info.plist")"
else
  echo "::warning::GADApplicationIdentifier missing from Info.plist — AdMob initialize will crash on device"
fi
if /usr/libexec/PlistBuddy -c "Print :NSUserTrackingUsageDescription" "$APP/Info.plist" >/dev/null 2>&1; then
  echo "NSUserTrackingUsageDescription present"
else
  echo "::warning::NSUserTrackingUsageDescription missing from Info.plist"
fi
# App Store Connect Languages is the .lproj set inside the .app, plus CFBundleLocalizations.
for lang in en de fr es pt-BR ja; do
  if [ ! -f "$APP/$lang.lproj/InfoPlist.strings" ]; then
    echo "missing $lang.lproj/InfoPlist.strings"
    exit 1
  fi
done
LOC_DUMP=$(/usr/libexec/PlistBuddy -c "Print :CFBundleLocalizations" "$APP/Info.plist" 2>/dev/null || true)
if [ -z "$LOC_DUMP" ]; then
  echo "CFBundleLocalizations missing from Info.plist"
  exit 1
fi
for lang in en de fr es pt-BR ja; do
  if ! printf '%s\n' "$LOC_DUMP" | grep -Eq "^[[:space:]]+${lang//-/\\-}$"; then
    echo "CFBundleLocalizations missing $lang"
    printf '%s\n' "$LOC_DUMP"
    exit 1
  fi
done
while IFS= read -r dir; do
  base=$(basename "$dir" .lproj)
  case "$base" in
    en|de|fr|es|pt-BR|ja) ;;
    *)
      echo "unexpected localization $dir"
      exit 1
      ;;
  esac
done <<EOF
$(find "$APP" -type d -name '*.lproj')
EOF
echo "Store languages present: en de fr es pt-BR ja"
echo "IPA plugin verification passed"
