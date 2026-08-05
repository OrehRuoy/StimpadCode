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
# Firebase Analytics (GodotFirebaseiOS) — soft check; plist must be in the app bundle.
if [ -f "$APP/GoogleService-Info.plist" ]; then
  echo "GoogleService-Info.plist present in app bundle"
else
  echo "::warning::GoogleService-Info.plist missing from app bundle — Analytics will not initialize"
fi
echo "IPA plugin verification passed"
