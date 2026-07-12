// Default Expo Metro config with ONE addition: pin yjs to a single module
// instance. yjs ships both ESM and CJS entries behind an exports map; mixed
// import/require usage across our deps (y-indexeddb, @hocuspocus/provider)
// otherwise bundles BOTH copies — yjs then warns "Yjs was already imported"
// and instanceof checks (incl. UndoManager origin tracking) silently break.
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

const yjsPath = require.resolve('yjs');
const defaultResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === 'yjs') return { type: 'sourceFile', filePath: yjsPath };
  // lib0's react-native webcrypto entry wants isomorphic-webcrypto, which is
  // not installed; polyfills.ts already provides crypto.getRandomValues on
  // Hermes, so a minimal shim stands in (only hit on native platforms).
  if (moduleName === 'isomorphic-webcrypto/src/react-native') {
    return {
      type: 'sourceFile',
      filePath: require.resolve('./src/shims/lib0-webcrypto.cjs'),
    };
  }
  return defaultResolveRequest
    ? defaultResolveRequest(context, moduleName, platform)
    : context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
