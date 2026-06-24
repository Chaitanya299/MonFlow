// Minimal react-native shim for Node.js — prototype use only
// Intercepts the react-native require before tsx/esbuild can fail on it
const Module = require('module');
const _load = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === 'react-native') {
    return {
      NativeModules: {},
      Platform: { OS: 'node', select: (obj) => obj.default ?? obj.android ?? {} },
      AppState: { addEventListener: () => ({ remove: () => {} }) },
    };
  }
  if (request === 'tweetnacl') {
    // RuleManager also uses nacl — return a no-op if not installed
    try { return _load.call(this, request, parent, isMain); } catch (_) { return {}; }
  }
  return _load.call(this, request, parent, isMain);
};
