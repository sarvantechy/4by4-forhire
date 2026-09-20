# Android Release Signing

The Android release build uses a dedicated upload key. Google Play App Signing should hold the
app-signing key; this local key is only the upload credential.

## One-time upload key creation

Run this command locally and enter strong passwords directly at the prompts:

```bash
mkdir -p "$HOME/.android"
keytool -genkeypair -v \
  -keystore "$HOME/.android/4by4-forhire-upload.keystore" \
  -alias forhire-upload \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000
```

Back up the keystore and its passwords in the approved password manager. Losing the upload key
requires a Play Console key-reset process. Never place the keystore or passwords in this repository.

## Build configuration

Provide all four values through environment variables or uncommitted Gradle properties:

```text
RELEASE_STORE_FILE=/absolute/path/to/4by4-forhire-upload.keystore
RELEASE_STORE_PASSWORD=<secret>
RELEASE_KEY_ALIAS=forhire-upload
RELEASE_KEY_PASSWORD=<secret>
```

The Expo config plugin `plugins/withAndroidReleaseSigning.js` recreates the signing configuration
after every prebuild. A release task fails immediately if any value is missing; it never falls back
to the debug key.

## Production AAB

The public API URL and MapTiler key are embedded into the JavaScript release bundle. Set the
production values in the build environment, then run:

```bash
cd apps/mobile
npx expo prebuild --platform android --no-install
cd android
./gradlew bundleRelease
```

The output is `apps/mobile/android/app/build/outputs/bundle/release/app-release.aab`.

Before the first upload, confirm the immutable package ID `com.fourbyfoursoftwares.forhire`, enroll
in Google Play App Signing, and upload to Internal testing. Increment `android.versionCode` for every
subsequent Play Console upload.
