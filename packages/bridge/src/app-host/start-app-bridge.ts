import type { Runtime } from '@actable/core';
import { isRequest, notification, parseMessage } from '../protocol/json-rpc';
import { EVENT_METHOD, HELLO_METHOD } from '../protocol/bridge-protocol';
import { forwardEvents } from './forward-events';
import { handleRequest } from './handle-request';

export type BridgeStatus = 'connecting' | 'open' | 'closed';

export type AppBridgeOptions = {
  /** Relay URL, e.g. ws://127.0.0.1:8765 (iOS simulator) or ws://10.0.2.2:8765 (Android emulator). */
  url: string;
  /** How the CLI picks this app (`--device ios-sim`). */
  name: string;
  platform: string;
  token?: string;
  /** Returns a base64 PNG of the screen, when the platform can take one. */
  screenshot?: () => Promise<string>;
  reconnectMs?: number;
  onStatus?: (status: BridgeStatus) => void;
};

/**
 * Runs inside the app (dev builds only). Dials out to the relay, keeps reconnecting, and serves
 * the app's actions, so remote runs go through exactly the same code as taps.
 */
export function startAppBridge(runtime: Runtime, options: AppBridgeOptions): { stop(): void } {
  let socket: WebSocket | null = null;
  let stopped = false;
  let reconnectTimer: ReturnType<typeof setTimeout> | undefined;

  const send = (message: object) => {
    if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message));
  };
  const stopForwarding = forwardEvents(runtime, options.name, (event) => send(notification(EVENT_METHOD, event)));

  function connect() {
    if (stopped) return;
    options.onStatus?.('connecting');
    const current = new WebSocket(`${options.url}?${connectionQuery(options)}`);
    socket = current;
    current.onopen = () => {
      options.onStatus?.('open');
      send(notification(HELLO_METHOD, { name: options.name, platform: options.platform }));
    };
    current.onmessage = (event) => {
      const message = parseMessage(event.data);
      if (message && isRequest(message)) void handleRequest(runtime, message, options.screenshot).then(send);
    };
    current.onclose = () => {
      if (socket === current) socket = null;
      options.onStatus?.('closed');
      if (!stopped) reconnectTimer = setTimeout(connect, options.reconnectMs ?? 2000);
    };
    // The relay is optional in development: failures just lead to a quiet retry from onclose.
    current.onerror = () => {};
  }

  connect();

  return {
    stop() {
      stopped = true;
      clearTimeout(reconnectTimer);
      stopForwarding();
      socket?.close();
    },
  };
}

function connectionQuery({ name, platform, token }: AppBridgeOptions): string {
  const query = new URLSearchParams({ role: 'app', name, platform });
  if (token) query.set('token', token);
  return query.toString();
}
