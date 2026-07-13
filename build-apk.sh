#!/bin/bash
# ── AnfieldVoice — Build Android APK Locally ──────────────────────────────
# Installs Android SDK + Gradle, prebuilds Expo, and assembles a release APK.
# Run from repo root (~/projects/voiprct).
# ──────────────────────────────────────────────────────────────────────────
set -e

MOBILE_DIR="$(cd "$(dirname "$0")" && pwd)/anfieldvoice-mobile"
SDK_DIR="$HOME/android-sdk"

echo "╔══════════════════════════════════════════╗"
echo "║  AnfieldVoice — Android APK Builder     ║"
echo "╚══════════════════════════════════════════╝"

# ── 1. Java 17 ──────────────────────────────────────────────────────────────
echo ""
echo "  [1/6] Checking Java..."
if java -version 2>&1 | grep -q 'version "17'; then
    echo "        Java 17 OK"
elif command -v sdk &>/dev/null; then
    sdk install java 17.0.14-tem 2>/dev/null || true
    sdk use java 17.0.14-tem
else
    echo "        Using system Java ($(java -version 2>&1 | head -1))"
fi

# ── 2. Android SDK ──────────────────────────────────────────────────────────
echo ""
echo "  [2/6] Installing Android SDK..."

if [ -f "$SDK_DIR/platforms/android-34/android.jar" ]; then
    echo "        SDK already installed at $SDK_DIR"
else
    mkdir -p "$SDK_DIR"
    cd "$SDK_DIR"

    if [ ! -f "commandlinetools-linux-11076708_latest.zip" ]; then
        echo "        Downloading command-line tools..."
        wget -q https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip
    fi

    if [ ! -d "cmdline-tools" ]; then
        echo "        Extracting..."
        unzip -q commandlinetools-linux-11076708_latest.zip
        mkdir -p cmdline-tools/latest
        mv cmdline-tools/* cmdline-tools/latest/ 2>/dev/null || true
    fi

    export ANDROID_HOME="$SDK_DIR"
    export PATH="$SDK_DIR/cmdline-tools/latest/bin:$SDK_DIR/platform-tools:$PATH"

    echo "        Accepting licenses + installing SDK 34..."
    yes | "$SDK_DIR/cmdline-tools/latest/bin/sdkmanager" \
        --sdk_root="$SDK_DIR" \
        "platforms;android-34" \
        "build-tools;34.0.0" \
        "platform-tools" > /dev/null 2>&1

    echo "        Done"
fi

export ANDROID_HOME="$SDK_DIR"
export PATH="$SDK_DIR/cmdline-tools/latest/bin:$SDK_DIR/platform-tools:$PATH"

# ── 3. Install mobile deps ──────────────────────────────────────────────────
echo ""
echo "  [3/6] Installing npm dependencies..."
cd "$MOBILE_DIR"
npm install --silent 2>/dev/null || npm install

# ── 4. Expo prebuild ────────────────────────────────────────────────────────
echo ""
echo "  [4/6] Running Expo prebuild..."
npx expo prebuild --platform android --clean 2>&1 | tail -5

# ── 5. Gradle wrapper ───────────────────────────────────────────────────────
echo ""
echo "  [5/6] Setting up Gradle..."
if [ ! -f "$MOBILE_DIR/android/gradlew" ]; then
    echo "        Gradle wrapper missing — downloading..."
    cd "$MOBILE_DIR/android"
    # If the project has a wrapper properties file, gradlew should exist after prebuild
    ls -la gradlew* 2>/dev/null || echo "        ⚠️  No gradlew found after prebuild — trying npx expo run:android"
fi

# ── 6. Build APK ────────────────────────────────────────────────────────────
echo ""
echo "  [6/6] Building release APK..."
cd "$MOBILE_DIR/android"

if [ -f "./gradlew" ]; then
    chmod +x ./gradlew
    ./gradlew assembleRelease 2>&1 | tail -10
else
    cd "$MOBILE_DIR"
    npx expo run:android --no-install 2>&1 | tail -10
fi

# ── Locate APK ──────────────────────────────────────────────────────────────
echo ""
echo "  ── Locating APK ──"
APK=$(find "$MOBILE_DIR/android" -name "*.apk" -path "*/release/*" 2>/dev/null | head -1)
if [ -n "$APK" ]; then
    SIZE=$(du -h "$APK" | cut -f1)
    echo "  ✅ APK built: $APK"
    echo "     Size: $SIZE"
    echo ""
    echo "  Install on device:"
    echo "    adb install $APK"
else
    echo "  ⚠️  APK not found in expected path."
    echo "     Searching broader..."
    find "$MOBILE_DIR/android" -name "*.apk" 2>/dev/null
fi

echo ""
echo "╔══════════════════════════════════════════╗"
echo "║  Done.                                   ║"
echo "╚══════════════════════════════════════════╝"
