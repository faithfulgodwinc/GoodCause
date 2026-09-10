#!/bin/bash
# Source profile for env vars and NVM
source /home/faith/.profile

echo "=== NODE ==="
node --version

echo "=== NPM ==="
npm --version

echo "=== YARN ==="
yarn --version

echo "=== JAVA ==="
java --version

echo "=== JAVA_HOME ==="
echo "$JAVA_HOME"

echo "=== ANDROID_HOME ==="
echo "$ANDROID_HOME"

echo "=== ADB ==="
adb version | head -2

echo "=== SDKMANAGER ==="
sdkmanager --version

echo "=== EAS CLI ==="
eas --version

echo "=== SDK CONTENTS ==="
ls "$ANDROID_HOME"

echo "=== BUILD TOOLS ==="
ls "$ANDROID_HOME/build-tools/"

echo "=== PLATFORMS ==="
ls "$ANDROID_HOME/platforms/"

echo "=== PLATFORM-TOOLS (sample) ==="
ls "$ANDROID_HOME/platform-tools/" | head -5
