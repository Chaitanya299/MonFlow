const {getDefaultConfig, mergeConfig} = require('@react-native/metro-config');
const path = require('path');

/**
 * Metro configuration
 * https://reactnative.dev/docs/metro
 *
 * @type {import('@react-native/metro-config').MetroConfig}
 */

// The social / P2P sync context pulls in @waku/sdk (libp2p) and
// @automerge/automerge (WASM). Both are statically imported via
// GroupInviteScreen, so Metro drags them into the startup bundle even though
// that screen only renders on a pending invite. Neither bundles for Hermes
// without significant polyfilling, and the social feature is deprioritized — so
// we redirect those two packages to a stub (src/dev/socialBundleStub.js) at
// bundle time. The Dashboard and on-device test runner build and run normally.
// Remove these entries to re-enable real bundling once those libs are RN-ready.
const STUBBED_MODULES = new Set(['@waku/sdk', '@automerge/automerge']);
const STUB_PATH = path.resolve(__dirname, 'src/dev/socialBundleStub.js');

const config = {
  resolver: {
    resolveRequest: (context, moduleName, platform) => {
      if (STUBBED_MODULES.has(moduleName)) {
        return {type: 'sourceFile', filePath: STUB_PATH};
      }
      return context.resolveRequest(context, moduleName, platform);
    },
  },
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
