# Derived Android builder for Apple Silicon hosts (colima/vz + Rosetta).
#
# The upstream image is amd64 (Android SDK tooling wants x86_64, which the VM runs
# via Rosetta) — but emulated Node segfaults on React Native's codegen. The VM
# kernel is arm64, so a NATIVE arm64 Node runs perfectly inside this amd64 image —
# it just needs arm64 userland libraries (dynamic loader + libc). This image adds
# both: multiarch arm64 libc from ubuntu-ports, and arm64 Node first on PATH.
# Result: Java/Gradle/aapt2/hermesc run x86_64-under-Rosetta; all JS runs natively.
FROM reactnativecommunity/react-native-android:latest

RUN dpkg --add-architecture arm64 && \
    sed -i 's/^deb /deb [arch=amd64] /' /etc/apt/sources.list && \
    . /etc/os-release && \
    printf 'deb [arch=arm64] http://ports.ubuntu.com/ubuntu-ports %s main universe\n' \
      "$VERSION_CODENAME" "$VERSION_CODENAME-updates" "$VERSION_CODENAME-security" \
      > /etc/apt/sources.list.d/arm64-ports.list && \
    apt-get update && \
    apt-get install -y --no-install-recommends libc6:arm64 libstdc++6:arm64 zlib1g:arm64 && \
    rm -rf /var/lib/apt/lists/*

ARG NODE_VERSION=22.14.0
RUN curl -fsSL "https://nodejs.org/dist/v${NODE_VERSION}/node-v${NODE_VERSION}-linux-arm64.tar.gz" \
      | tar -xz -C /opt && \
    ln -s "/opt/node-v${NODE_VERSION}-linux-arm64" /opt/node-arm64

ENV PATH=/opt/node-arm64/bin:$PATH
