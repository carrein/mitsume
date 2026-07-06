#!/usr/bin/env bash
# Sign the CI-built APK locally and publish the GitHub Release.
#   ./tooling/android-builder/sign-release.sh
# Prereqs: a successful "Android APK" workflow run; ~/.mitsume-keys (keystore +
# keystore.properties); gh + docker. The keystore never leaves this machine.
set -euo pipefail
cd "$(dirname "$0")/../.."

KEYS_DIR="${MITSUME_KEYS_DIR:-$HOME/.mitsume-keys}"
[ -f "$KEYS_DIR/release.keystore" ] || { echo "missing $KEYS_DIR/release.keystore"; exit 1; }

VERSION=$(bun -e 'console.log(JSON.parse(require("fs").readFileSync("app/app.json","utf8")).expo.version)')
TAG="v$VERSION"

echo "==> fetching latest successful Android APK workflow artifact"
RUN=$(gh run list --workflow 'Android APK' --status success -L 1 --json databaseId -q '.[0].databaseId')
[ -n "$RUN" ] || { echo "no successful 'Android APK' run found"; exit 1; }
rm -rf dist-apk && mkdir -p dist-apk
gh run download "$RUN" -n mitsume-unsigned-apk -D dist-apk
[ -f "dist-apk/mitsume-$TAG-unsigned.apk" ] || {
  echo "artifact version mismatch: expected mitsume-$TAG-unsigned.apk, got:"; ls dist-apk; exit 1; }

echo "==> signing locally (temurin JRE container; keystore stays on this machine)"
# shellcheck disable=SC1091
source "$KEYS_DIR/keystore.properties"
docker run --rm -v "$PWD/dist-apk:/w" -v "$KEYS_DIR:/keys:ro" -w /w eclipse-temurin:17-jre \
  java -jar apksigner.jar sign \
    --ks /keys/release.keystore --ks-key-alias "$keyAlias" \
    --ks-pass "pass:$storePassword" --key-pass "pass:$keyPassword" \
    --out "mitsume-$TAG.apk" "mitsume-$TAG-unsigned.apk"

echo "==> verify signature + content audit"
docker run --rm -v "$PWD/dist-apk:/w" -w /w eclipse-temurin:17-jre \
  java -jar apksigner.jar verify --print-certs "mitsume-$TAG.apk" | head -3
grep -ca 'ts.net' "dist-apk/mitsume-$TAG.apk" >/dev/null \
  && echo "baked URL present ✓" || { echo "FAIL: baked URL missing"; exit 1; }

echo "==> publishing release $TAG"
gh release create "$TAG" "dist-apk/mitsume-$TAG.apk" \
  --title "mitsume $TAG" --generate-notes
echo "==> done: $(gh release view "$TAG" --json url -q .url)"
