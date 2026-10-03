import type { ActionInfo, DispatchMeta, DispatchResult, Inspection } from '@actable/core';
import type { BridgeEvent } from '../protocol/bridge-events';
import { CLOSE_UNAUTHORIZED, EVENT_METHOD, type DeviceInfo, type Screenshot } from '../protocol/bridge-protocol';
import { isNotification, isResponse, parseMessage } from '../protocol/json-rpc';
import { createPendingCalls } from './pending-calls';

export type RelayClientOptions = {
  /** Device name or prefix. Optional when exactly one app is connected. */
  device?: string;
  token?: string;
  /** Per-call timeout. Invokes default to 120s, because the app may be waiting for a human. */
  timeoutMs?: number;
};

export type RelayClient = Awaited<ReturnType<typeof connectRelay>>;

const DEFAULT_TIMEOUT_MS = 15_000;
const INVOKE_TIMEOUT_MS = 120_000;

/** Talks to a running app through the relay. Used by `--remote` in the CLI and by MCP servers. */
export async function connectRelay(url: string, options: RelayClientOptions = {}) {
  const socket = await openSocket(url, options);
  const pending = createPendingCalls();
  const eventListeners = new Set<(event: BridgeEvent) => void>();
  let closedReason: string | undefined;

  socket.onmessage = (event) => {
    const message = parseMessage(event.data);
    if (!message) return;
    if (isResponse(message)) pending.settle(message);
    else if (isNotification(message, EVENT_METHOD)) eventListeners.forEach((listener) => listener(message.params as BridgeEvent));
  };
  socket.onclose = (event) => {
    closedReason = event.code === CLOSE_UNAUTHORIZED ? 'The relay rejected the pairing token (--token)' : 'The relay connection closed';
    pending.failAll(closedReason);
  };

  function call<TResult>(method: string, params?: unknown, timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS): Promise<TResult> {
    if (closedReason) return Promise.reject(new Error(closedReason));
    const { id, response } = pending.start(method, timeoutMs);
    socket.send(JSON.stringify({ jsonrpc: '2.0', id, method, params }));
    return response as Promise<TResult>;
  }

  return {
    call,
    dispatch: <TValue = unknown>(name: string, input: unknown, meta: DispatchMeta) =>
      call<DispatchResult<TValue>>('actions.invoke', { name, input, meta }, options.timeoutMs ?? INVOKE_TIMEOUT_MS),
    describeActions: () => call<ActionInfo[]>('actions.list'),
    inspect: () => call<Inspection>('app.inspect'),
    screenshot: () => call<Screenshot>('dev.screenshot', undefined, 30_000),
    devices: () => call<DeviceInfo[]>('relay.devices'),
    async onEvent(listener: (event: BridgeEvent) => void): Promise<() => void> {
      eventListeners.add(listener);
      await call('events.subscribe');
      return () => void eventListeners.delete(listener);
    },
    close: () => socket.close(),
  };
}

async function openSocket(url: string, { device, token }: RelayClientOptions): Promise<WebSocket> {
  const query = new URLSearchParams({ role: 'client' });
  if (device) query.set('target', device);
  if (token) query.set('token', token);
  const socket = new WebSocket(`${url}?${query}`);
  await new Promise<void>((resolve, reject) => {
    socket.onopen = () => resolve();
    socket.onerror = () => reject(new Error(`Could not reach the relay at ${url}. Is it running? Start it with the "serve" command.`));
  });
  return socket;
}
