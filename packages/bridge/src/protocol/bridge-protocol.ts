import type { ActionInfo, DispatchMeta, DispatchResult, Inspection } from '@actable/core';

/**
 * Remote mode:
 *
 *   CLI / MCP ──(role=client)──►  relay  ◄──(role=app)── the running app (dev builds only)
 *
 * The app dials out to the relay, so devices don't need a server socket. The relay forwards
 * client requests to the chosen app and streams the app's events back.
 */
export const DEFAULT_RELAY_PORT = 8765;
export const DEFAULT_RELAY_URL = `ws://127.0.0.1:${DEFAULT_RELAY_PORT}`;

/** WebSocket close code for a bad or missing pairing token. */
export const CLOSE_UNAUTHORIZED = 4001;

export const RpcErrorCodes = {
  MethodNotFound: -32601,
  InvalidParams: -32602,
  Internal: -32603,
  NoDevice: -32001,
  AmbiguousDevice: -32002,
  DeviceGone: -32003,
  Timeout: -32004,
} as const;

/** Methods the app serves. */
export type AppMethods = {
  'actions.list': { params: undefined; result: ActionInfo[] };
  'actions.invoke': { params: { name: string; input: unknown; meta: DispatchMeta }; result: DispatchResult };
  'app.inspect': { params: undefined; result: Inspection };
  'dev.screenshot': { params: undefined; result: Screenshot };
};

/** Methods the relay serves itself. */
export type RelayMethods = {
  'relay.devices': { params: undefined; result: DeviceInfo[] };
  'events.subscribe': { params: undefined; result: { subscribed: true } };
};

export type Screenshot = { base64: string; format: 'png' };

export type DeviceInfo = { name: string; platform: string; connectedAt: string };

/** Notification method names. */
export const EVENT_METHOD = 'event';
export const HELLO_METHOD = 'app.hello';
