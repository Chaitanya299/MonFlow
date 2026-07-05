// Test build stub for P2P bill-split sync deps (@waku/sdk, @automerge/automerge).
// These are libp2p/WASM ESM packages that do not bundle for React Native and are
// only reachable via GroupInviteScreen (deep-link invite flow) — irrelevant to the
// notification-listener test. metro.config.js redirects those packages here so the
// app compiles + boots. Any named import resolves to a function that throws when
// actually called, so social sync is inert (not silently wrong). To restore real
// sync, remove the resolveRequest redirect in metro.config.js.
const disabled = () => {
  throw new Error('P2P sync (Waku/Automerge) is disabled in this test build');
};

module.exports = new Proxy(
  {},
  {
    get: () => disabled,
  },
);
