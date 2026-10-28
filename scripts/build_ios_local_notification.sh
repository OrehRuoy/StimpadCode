#!/usr/bin/env bash
# Build LocalNotificationPlugin debug/release xcframeworks for the Godot iOS export.
# Pure Apple frameworks. No Godot headers. CI runs this before export.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="$ROOT/ios/plugins/local_notification/local_notification.mm"
OUT="$ROOT/ios/plugins"
WORK="$ROOT/build/local_notification"
MIN_IOS="17.0"

if [[ ! -f "$SRC" ]]; then
  echo "Missing $SRC" >&2
  exit 1
fi

rm -rf "$WORK"
mkdir -p "$WORK"

SDK_DEVICE="$(xcrun --sdk iphoneos --show-sdk-path)"
SDK_SIM="$(xcrun --sdk iphonesimulator --show-sdk-path)"

clang -c "$SRC" -arch arm64 -isysroot "$SDK_DEVICE" -miphoneos-version-min="$MIN_IOS" \
  -fobjc-arc -O2 -o "$WORK/device.o"
libtool -static -o "$WORK/device.a" "$WORK/device.o"

clang -c "$SRC" -arch arm64 -isysroot "$SDK_SIM" -mios-simulator-version-min="$MIN_IOS" \
  -fobjc-arc -O2 -o "$WORK/sim-arm64.o"
libtool -static -o "$WORK/sim-arm64.a" "$WORK/sim-arm64.o"

if clang -c "$SRC" -arch x86_64 -isysroot "$SDK_SIM" -mios-simulator-version-min="$MIN_IOS" \
  -fobjc-arc -O2 -o "$WORK/sim-x64.o"; then
  libtool -static -o "$WORK/sim-x64.a" "$WORK/sim-x64.o"
  lipo -create "$WORK/sim-arm64.a" "$WORK/sim-x64.a" -output "$WORK/sim.a"
  SIM_ID="ios-arm64_x86_64-simulator"
  SIM_ARCH_PLIST=$'			<string>arm64</string>\n			<string>x86_64</string>'
else
  cp "$WORK/sim-arm64.a" "$WORK/sim.a"
  SIM_ID="ios-arm64-simulator"
  SIM_ARCH_PLIST=$'			<string>arm64</string>'
  echo "x86_64 simulator slice unavailable; shipping arm64 simulator only"
fi

write_plist() {
  local dest="$1"
  cat > "$dest/Info.plist" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
	<key>AvailableLibraries</key>
	<array>
		<dict>
			<key>BinaryPath</key>
			<string>LocalNotificationPlugin.a</string>
			<key>LibraryIdentifier</key>
			<string>${SIM_ID}</string>
			<key>LibraryPath</key>
			<string>LocalNotificationPlugin.a</string>
			<key>SupportedArchitectures</key>
			<array>
${SIM_ARCH_PLIST}
			</array>
			<key>SupportedPlatform</key>
			<string>ios</string>
			<key>SupportedPlatformVariant</key>
			<string>simulator</string>
		</dict>
		<dict>
			<key>BinaryPath</key>
			<string>LocalNotificationPlugin.a</string>
			<key>LibraryIdentifier</key>
			<string>ios-arm64</string>
			<key>LibraryPath</key>
			<string>LocalNotificationPlugin.a</string>
			<key>SupportedArchitectures</key>
			<array>
				<string>arm64</string>
			</array>
			<key>SupportedPlatform</key>
			<string>ios</string>
		</dict>
	</array>
	<key>CFBundlePackageType</key>
	<string>XFWK</string>
	<key>XCFrameworkFormatVersion</key>
	<string>1.0</string>
</dict>
</plist>
EOF
}

for cfg in debug release; do
  dest="$OUT/LocalNotificationPlugin.${cfg}.xcframework"
  rm -rf "$dest"
  mkdir -p "$dest/ios-arm64" "$dest/${SIM_ID}"
  cp "$WORK/device.a" "$dest/ios-arm64/LocalNotificationPlugin.a"
  cp "$WORK/sim.a" "$dest/${SIM_ID}/LocalNotificationPlugin.a"
  write_plist "$dest"
done

LIB="$OUT/LocalNotificationPlugin.release.xcframework/ios-arm64/LocalNotificationPlugin.a"
raw="$(nm -gU "$LIB" 2>/dev/null || true)"
syms="$(printf '%s\n' "$raw" | c++filt || true)"
if ! printf '%s\n' "$syms" | grep -c 'local_notification_init()' >/dev/null; then
  echo "missing local_notification_init() in $LIB"
  exit 1
fi
echo "LocalNotificationPlugin xcframeworks ready"
