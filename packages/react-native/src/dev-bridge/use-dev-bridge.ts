import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { DEFAULT_RELAY_PORT, startAppBridge, type BridgeStatus } from '@actable/bridge';
import type { Runtime } from '@actable/core';

export type DevBridgeOptions = {
  /** How the CLI picks this app (`--device <name>`). */
  name: string;
  /** Defaults to the dev machine as seen from a simulator/emulator. */
  url?: string;
  token?: string;
  /** Returns a base64 PNG of the screen, e.g. react-native-view-shot's captureScreen. */
  screenshot?: () => Promise<string>;
};

/** The iOS simulator reaches the dev machine at 127.0.0.1, the Android emulator at 10.0.2.2. */
export function defaultRelayUrl(): string {
  return `ws://${Platform.OS === 'android' ? '10.0.2.2' : '127.0.0.1'}:${DEFAULT_RELAY_PORT}`;
}

/**
 * Remote mode, development builds only: connects the running app to the relay so the CLI,
 * scenarios and agents can drive it through the same actions as the UI. Returns the status.
 */
export function useDevBridge(runtime: Runtime | null, options: DevBridgeOptions): BridgeStatus | null {
  const [status, setStatus] = useState<BridgeStatus | null>(null);
  const { name, url = defaultRelayUrl(), token, screenshot } = options;

  useEffect(() => {
    if (!__DEV__ || !runtime) return;
    const bridge = startAppBridge(runtime, { url, name, platform: Platform.OS, token, screenshot, onStatus: setStatus });
    return bridge.stop;
  }, [runtime, url, name, token, screenshot]);

  return status;
}
