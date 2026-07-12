// Metro alias target (see metro.config.js): lib0's react-native webcrypto
// entry requires `isomorphic-webcrypto/src/react-native`, which is not
// installed (unmaintained, heavy, and unnecessary). yjs/lib0 only ever needs
// getRandomValues, which polyfills.ts provides on Hermes via expo-crypto.
// Shape mirrors isomorphic-webcrypto's default export as consumed by
// lib0/dist/webcrypto.react-native.cjs: ensureSecure() + subtle +
// getRandomValues. globalThis.crypto is read lazily so import order relative
// to polyfills.ts doesn't matter.
module.exports = {
  ensureSecure() {},
  get subtle() {
    return globalThis.crypto && globalThis.crypto.subtle;
  },
  getRandomValues(array) {
    return globalThis.crypto.getRandomValues(array);
  },
};
