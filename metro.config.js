const {getDefaultConfig, mergeConfig} = require('@react-native/metro-config');
const path = require('path');

/**
 * Metro configuration
 * https://reactnative.dev/docs/metro
 *
 * @type {import('@react-native/metro-config').MetroConfig}
 */
const config = {
  resolver: {
    // @waku/sdk and its libp2p deps are ESM packages that declare their real
    // entry points via the "exports" map, not a resolvable "main" field.
    unstable_enablePackageExports: true,
    // Test build: @waku/sdk (libp2p) and @automerge/automerge (WASM) do not
    // bundle for RN. Both are only used by the P2P bill-split sync, which is
    // irrelevant to the notification-listener test. Redirect them to an inert
    // stub so the app compiles + boots.
    resolveRequest: (context, moduleName, platform) => {
      if (moduleName.startsWith('@waku/') || moduleName.startsWith('@automerge/')) {
        return {
          type: 'sourceFile',
          filePath: path.resolve(__dirname, 'metro-stubs/empty-sync.js'),
        };
      }
      return context.resolveRequest(context, moduleName, platform);
    },
  },
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
