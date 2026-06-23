// Minimal react-native shim for Node.js (prototype receiver only)
export const NativeModules: Record<string, unknown> = {};
export const Platform = { OS: 'node' as const };
export const AppState = { addEventListener: (_: string, __: () => void) => ({ remove: () => {} }) };
