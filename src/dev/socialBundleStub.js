/**
 * Build-time stub for the social / P2P sync libraries (@waku/sdk,
 * @automerge/automerge) that cannot currently be bundled for Hermes.
 *
 * Metro redirects those packages here (see metro.config.js) so the app —
 * Dashboard and the on-device test runner — builds and runs on a device.
 * The social feature was deprioritized; until @waku (libp2p) and Automerge
 * (WASM) are made RN-compatible, any code path that actually USES these
 * libraries (only GroupInviteScreen, which renders on a pending invite)
 * will throw the clear error below instead of bundling the real packages.
 *
 * To restore real bundling: remove the resolver entry in metro.config.js.
 * Named imports resolve to throwing functions; the error only fires when a
 * stubbed API is actually called, never at module load.
 */
const message =
  '[monflo] Social/P2P module is stubbed out of this build ' +
  '(@waku/sdk + @automerge/automerge are not bundled for Hermes yet). ' +
  'See metro.config.js to re-enable.';

const handler = {
  get(_target, prop) {
    if (prop === '__esModule') return true;
    if (prop === 'default') return new Proxy(function () {}, handler);
    if (prop === Symbol.toPrimitive || prop === Symbol.toStringTag) return undefined;
    return function stubbedExport() {
      throw new Error(message);
    };
  },
  apply() {
    throw new Error(message);
  },
};

module.exports = new Proxy(function () {}, handler);
