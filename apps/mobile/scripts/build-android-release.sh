#!/usr/bin/env bash
set -euo pipefail

MOBILE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
KEYSTORE_FILE="${RELEASE_STORE_FILE:-$HOME/.android/4by4-forhire-upload.keystore}"
CERTIFICATE_FILE="$HOME/.android/4by4-forhire-upload-certificate.pem"

java_17_home="${FORHIRE_JAVA_HOME:-/opt/homebrew/Cellar/openjdk@17/17.0.17/libexec/openjdk.jdk/Contents/Home}"
if [[ ! -x "$java_17_home/bin/java" ]]; then
  java_17_home="$(/usr/libexec/java_home -v 17 2>/dev/null || true)"
fi
export JAVA_HOME="$java_17_home"
export ANDROID_HOME="${ANDROID_HOME:-$HOME/Library/Android/sdk}"
export EXPO_PUBLIC_API_BASE_URL="${EXPO_PUBLIC_API_BASE_URL:-https://api.forhire.4by4softwares.com/api/v1}"
export JAVA_TOOL_OPTIONS="${JAVA_TOOL_OPTIONS:--Djavax.net.ssl.trustStore=$HOME/.gradle/corporate-cacerts.jks -Djavax.net.ssl.trustStorePassword=changeit}"

if [[ ! -f "$KEYSTORE_FILE" ]]; then
  echo "Upload keystore not found: $KEYSTORE_FILE" >&2
  exit 1
fi
if [[ ! -x "$JAVA_HOME/bin/java" ]]; then
  echo "Java 17 not found at JAVA_HOME=$JAVA_HOME" >&2
  exit 1
fi
java_major="$($JAVA_HOME/bin/java -version 2>&1 | awk -F'[".]' '/version/{print $2; exit}')"
if [[ ! "$java_major" =~ ^[0-9]+$ || "$java_major" -lt 17 ]]; then
  echo "Android release builds require Java 17 or newer; found major version $java_major." >&2
  exit 1
fi
if [[ ! -d "$ANDROID_HOME" ]]; then
  echo "Android SDK not found at ANDROID_HOME=$ANDROID_HOME" >&2
  exit 1
fi

if [[ -z "${EXPO_PUBLIC_MAPTILER_KEY:-}" ]]; then
  read -r -s -p "MapTiler key: " EXPO_PUBLIC_MAPTILER_KEY
  echo
  export EXPO_PUBLIC_MAPTILER_KEY
fi
if [[ -z "$EXPO_PUBLIC_MAPTILER_KEY" ]]; then
  echo "MapTiler key is required for a Play Store build." >&2
  exit 1
fi

if [[ -z "${RELEASE_STORE_PASSWORD:-}" ]]; then
  read -r -s -p "Upload keystore password: " RELEASE_STORE_PASSWORD
  echo
  export RELEASE_STORE_PASSWORD
fi
export RELEASE_STORE_FILE="$KEYSTORE_FILE"
export RELEASE_KEY_ALIAS="${RELEASE_KEY_ALIAS:-forhire-upload}"
export RELEASE_KEY_PASSWORD="${RELEASE_KEY_PASSWORD:-$RELEASE_STORE_PASSWORD}"

cd "$MOBILE_DIR"
npx expo prebuild --platform android --no-install

cd android
./gradlew clean bundleRelease

AAB="$MOBILE_DIR/android/app/build/outputs/bundle/release/app-release.aab"
if [[ ! -f "$AAB" ]]; then
  echo "Release bundle was not produced." >&2
  exit 1
fi
jarsigner -verify "$AAB" >/dev/null

if [[ -f "$CERTIFICATE_FILE" ]]; then
  bundle_fingerprint="$(keytool -printcert -jarfile "$AAB" | awk -F': ' '/SHA256:/{print $2; exit}')"
  upload_fingerprint="$(keytool -printcert -file "$CERTIFICATE_FILE" | awk -F': ' '/SHA256:/{print $2; exit}')"
  if [[ -z "$bundle_fingerprint" || "$bundle_fingerprint" != "$upload_fingerprint" ]]; then
    echo "Built AAB signer does not match the For Hire upload certificate." >&2
    exit 1
  fi
fi

version="$(node -p "require('../app.json').expo.version")"
destination="$HOME/Desktop/4by4ForHire-v${version}.aab"
cp "$AAB" "$destination"

echo "Release AAB ready: $destination"
echo "API: $EXPO_PUBLIC_API_BASE_URL"
echo "Package: com.fourbyfoursoftwares.forhire"
