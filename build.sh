#!/usr/bin/env bash
# Build Karp.apk locally. Requires: Node 18+, JDK 17, Android SDK (ANDROID_HOME set).
set -euo pipefail
npm install
[ -d android ] || npx cap add android
npx cap sync android
(cd android && chmod +x gradlew && ./gradlew assembleDebug)
cp android/app/build/outputs/apk/debug/app-debug.apk Karp.apk
echo "Built: $(pwd)/Karp.apk"
