# Karp

A sleek Discord-style chat app: servers, channels, direct messages and a full **friends system** (add by username, incoming/outgoing requests, accept/decline/cancel, remove, online status). No calls yet.

Built with plain HTML/CSS/JS and packaged for Android with [Capacitor](https://capacitorjs.com).

## Get the APK (easiest: GitHub Actions)

1. Push this repo to GitHub (branch `main`).
2. The **Build APK** workflow runs automatically (or run it from the Actions tab).
3. Download `Karp.apk` from the **latest** release, or from the workflow run's artifacts.
4. On your phone, allow "install unknown apps" and open the APK.

## Build locally

Requires Node 18+, JDK 17 and the Android SDK (`ANDROID_HOME` set).

```bash
./build.sh
# or manually:
npm install
npx cap add android
npx cap sync android
cd android && ./gradlew assembleDebug
# APK: android/app/build/outputs/apk/debug/app-debug.apk
```

Preview in a browser: `npx serve www`

## Notes

- Data is stored on-device (localStorage). The people you can add come from a demo directory in `www/app.js` (`mia`, `leo`, `nova`, `kai`, `juno`, `ravi`, `zed`); they accept requests and reply automatically.
- To make it truly multi-user, swap the `Store` and `Friends` objects in `www/app.js` for calls to a backend (WebSocket + auth).
- The debug APK is signed with the debug key. For Play Store distribution, configure a release keystore and run `./gradlew assembleRelease`.
