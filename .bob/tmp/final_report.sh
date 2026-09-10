#!/bin/bash
source /home/faith/.profile

echo "================================================"
echo "GoodCause Android Build Environment Report"
echo "================================================"
echo ""
echo "--- System ---"
lsb_release -d 2>/dev/null | cut -d: -f2 | xargs

echo ""
echo "--- Node.js ---"
node --version

echo "--- npm ---"
npm --version

echo "--- Yarn ---"
yarn --version

echo ""
echo "--- Java ---"
java --version 2>&1 | head -1

echo "--- JAVA_HOME ---"
echo $JAVA_HOME

echo ""
echo "--- Android SDK Location ---"
echo $ANDROID_HOME

echo "--- Android Platforms ---"
ls $ANDROID_HOME/platforms/

echo "--- Build Tools ---"
ls $ANDROID_HOME/build-tools/

echo "--- NDK ---"
ls $ANDROID_HOME/ndk/ 2>/dev/null || echo "NDK not found"

echo "--- Platform Tools (adb) ---"
adb version 2>&1 | head -1

echo "--- sdkmanager ---"
sdkmanager --version

echo ""
echo "--- EAS CLI ---"
eas --version

echo ""
echo "--- Gradle (from project wrapper) ---"
cd /mnt/c/Users/faith/Documents/GoodCause/frontend/android
./gradlew --version 2>&1 | grep -E "Gradle|Kotlin|Groovy|JVM|OS"

echo ""
echo "--- Project Expo SDK ---"
node -e "const p=require('/mnt/c/Users/faith/Documents/GoodCause/frontend/package.json'); console.log(p.dependencies.expo)"

echo ""
echo "--- eas.json production profile ---"
cat /mnt/c/Users/faith/Documents/GoodCause/frontend/eas.json

echo ""
echo "================================================"
echo "Environment check complete"
echo "================================================"
