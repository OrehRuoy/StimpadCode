#!/usr/bin/env bash
# Download GodotFirebaseiOS 0.5.6 into addons/ (CI + local Mac). Requires gh + unzip.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
VERSION="${FIREBASE_IOS_VERSION:-0.5.6}"
TMP="${TMPDIR:-/tmp}/godot-firebase-ios-$$"
mkdir -p "$TMP/download" addons
gh release download "$VERSION" \
  --repo SomniGameStudios/godot-firebase-ios \
  --pattern "GodotFirebaseiOS-${VERSION}.zip" \
  --dir "$TMP/download"
unzip -q "$TMP/download/"*.zip -d "$TMP/extracted"
rm -rf addons/GodotFirebaseiOS
cp -R "$TMP/extracted/addons/GodotFirebaseiOS" addons/
rm -rf "$TMP"

# Prefer CI-injected or local plist locations.
if [ -n "${GOOGLE_SERVICE_INFO_PLIST_BASE64:-}" ]; then
  echo "$GOOGLE_SERVICE_INFO_PLIST_BASE64" | base64 --decode > addons/GodotFirebaseiOS/GoogleService-Info.plist
  mkdir -p ios
  cp addons/GodotFirebaseiOS/GoogleService-Info.plist ios/GoogleService-Info.plist
  echo "Injected GoogleService-Info.plist from GOOGLE_SERVICE_INFO_PLIST_BASE64"
elif [ -f ios/GoogleService-Info.plist ]; then
  cp ios/GoogleService-Info.plist addons/GodotFirebaseiOS/GoogleService-Info.plist
  echo "Copied ios/GoogleService-Info.plist into addon"
elif [ -f GoogleService-Info.plist ]; then
  cp GoogleService-Info.plist addons/GodotFirebaseiOS/GoogleService-Info.plist
  mkdir -p ios
  cp GoogleService-Info.plist ios/GoogleService-Info.plist
  echo "Copied ./GoogleService-Info.plist into addon + ios/"
else
  echo "::warning::GoogleService-Info.plist not found — place it in addons/GodotFirebaseiOS/ before iOS export"
fi

test -f addons/GodotFirebaseiOS/FirebaseIOS.gd
test -f addons/GodotFirebaseiOS/GodotFirebaseiOS.gdextension

# App Store rejects GodotFirebaseiOS.framework without CFBundleShortVersionString (90057).
# Circuit Sort / StimPad CI patches this after unzip (PlistBuddy is macOS-only).
if [ -x /usr/libexec/PlistBuddy ]; then
  while IFS= read -r -d '' plist; do
    /usr/libexec/PlistBuddy -c "Print :CFBundleShortVersionString" "$plist" >/dev/null 2>&1 \
      || /usr/libexec/PlistBuddy -c "Add :CFBundleShortVersionString string ${VERSION}" "$plist"
    /usr/libexec/PlistBuddy -c "Print :CFBundleVersion" "$plist" >/dev/null 2>&1 \
      || /usr/libexec/PlistBuddy -c "Add :CFBundleVersion string ${VERSION}" "$plist"
    echo "Patched Firebase framework plist: $plist"
    /usr/libexec/PlistBuddy -c "Print :CFBundleShortVersionString" "$plist"
  done < <(find addons/GodotFirebaseiOS -path "*/GodotFirebaseiOS.framework/Info.plist" -print0)
fi

echo "GodotFirebaseiOS $VERSION ready under addons/"
