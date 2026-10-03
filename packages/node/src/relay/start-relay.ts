import type { IncomingMessage } from 'node:http';
import type { AddressInfo } from 'node:net';
import { WebSocket, WebSocketServer } from 'ws';
import {
  CLOSE_UNAUTHORIZED,
  DEFAULT_RELAY_PORT,
  EVENT_METHOD,
  RpcErrorCodes,
  errorResponse,
  isNotification,
  isRequest,
  isResponse,
  notification,
  parseMessage,
  resultResponse,
  type BridgeEvent,
  type DeviceInfo,
  type RpcRequest,
} from '@actable/bridge';
import { createDeviceDirectory, type ConnectedDevice } from './device-directory';
import { createForwardedCalls } from './forwarded-calls';

export type RelayLogEvent =
  | { type: 'device'; status: 'connected' | 'disconnected'; device: DeviceInfo }
  | { type: 'client'; status: 'connected' | 'disconnected' }
  | { type: 'rejected'; reason: string }
  | { type: 'call'; device: string; method: string; params: unknown }
  | { type: 'event'; event: BridgeEvent };

export type RelayOptions = {
  port?: number;
  /** Defaults to 127.0.0.1: only this machine (and the iOS simulator) can connect. */
  host?: string;
  /** When set, every connection must present it. Set it whenever the host isn't loopback. */
  token?: string;
  /** How long a forwarded call may wait for the app (confirmation sheets wait for a human). */
  callTimeoutMs?: number;
  log?: (event: RelayLogEvent) => void;
};

type Client = { socket: WebSocket; device?: string; wantsEvents: boolean };

export type Relay = Awaited<ReturnType<typeof startRelay>>;

/** Connects CLIs/agents (clients) to running apps (devices) and forwards requests between them. */
export async function startRelay(options: RelayOptions = {}) {
  const host = options.host ?? '127.0.0.1';
  const log = options.log ?? (() => {});
  const devices = createDeviceDirectory();
  const clients = new Set<Client>();
  const forwarded = createForwardedCalls<Client>();
  const now = () => new Date().toISOString();

  const server = new WebSocketServer({ port: options.port ?? DEFAULT_RELAY_PORT, host });
  await new Promise<void>((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });

  const send = (socket: WebSocket, message: object) => {
    if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message));
  };

  function publish(event: BridgeEvent) {
    log({ type: 'event', event });
    for (const client of clients) {
      const interested = client.wantsEvents && (!client.device || event.device.startsWith(client.device));
      if (interested) send(client.socket, notification(EVENT_METHOD, event));
    }
  }

  function handleClientRequest(client: Client, request: RpcRequest) {
    if (request.method === 'relay.devices') return send(client.socket, resultResponse(request.id, devices.list()));
    if (request.method === 'events.subscribe') {
      client.wantsEvents = true;
      return send(client.socket, resultResponse(request.id, { subscribed: true }));
    }
    const lookup = devices.find(client.device);
    if (!('device' in lookup)) return send(client.socket, errorResponse(request.id, lookup.code, lookup.error));
    forwardToDevice(client, request, lookup.device);
  }

  function forwardToDevice(client: Client, request: RpcRequest, device: ConnectedDevice) {
    const relayId = forwarded.start(
      { client, clientRequestId: request.id, device: device.name },
      options.callTimeoutMs ?? 120_000,
      () => send(client.socket, errorResponse(request.id, RpcErrorCodes.Timeout, `${device.name} did not answer ${request.method} in time`)),
    );
    log({ type: 'call', device: device.name, method: request.method, params: request.params });
    send(device.socket, { ...request, id: relayId });
  }

  function handleDeviceMessage(device: ConnectedDevice, data: unknown) {
    const message = parseMessage(data);
    if (!message) return;
    if (isResponse(message)) {
      const call = forwarded.finish(String(message.id));
      if (call) send(call.client.socket, { ...message, id: call.clientRequestId });
    } else if (isNotification(message, EVENT_METHOD)) {
      publish({ ...(message.params as BridgeEvent), device: device.name });
    }
  }

  function connectDevice(socket: WebSocket, query: URLSearchParams) {
    const name = query.get('name') || `app-${devices.list().length + 1}`;
    devices.get(name)?.socket.close(1000, 'Replaced by a newer connection');
    const device: ConnectedDevice = { name, platform: query.get('platform') ?? 'unknown', connectedAt: now(), socket };
    devices.add(device);
    log({ type: 'device', status: 'connected', device });
    publish({ type: 'device', device: name, at: now(), status: 'connected' });

    socket.on('message', (data) => handleDeviceMessage(device, data));
    socket.on('close', () => {
      if (devices.get(name) !== device) return; // replaced by a newer connection
      devices.remove(name);
      for (const call of forwarded.finishWhere((pending) => pending.device === name)) {
        send(call.client.socket, errorResponse(call.clientRequestId, RpcErrorCodes.DeviceGone, `${name} disconnected`));
      }
      log({ type: 'device', status: 'disconnected', device });
      publish({ type: 'device', device: name, at: now(), status: 'disconnected' });
    });
  }

  function connectClient(socket: WebSocket, query: URLSearchParams) {
    const client: Client = { socket, device: query.get('target') || undefined, wantsEvents: false };
    clients.add(client);
    log({ type: 'client', status: 'connected' });
    socket.on('message', (data) => {
      const message = parseMessage(data);
      if (message && isRequest(message)) handleClientRequest(client, message);
    });
    socket.on('close', () => {
      clients.delete(client);
      forwarded.finishWhere((pending) => pending.client === client);
      log({ type: 'client', status: 'disconnected' });
    });
  }

  server.on('connection', (socket: WebSocket, request: IncomingMessage) => {
    const query = new URL(request.url ?? '/', 'ws://relay').searchParams;
    if (options.token && query.get('token') !== options.token) {
      log({ type: 'rejected', reason: 'bad or missing token' });
      socket.close(CLOSE_UNAUTHORIZED, 'Bad or missing pairing token');
      return;
    }
    if (query.get('role') === 'app') connectDevice(socket, query);
    else connectClient(socket, query);
  });

  return {
    port: (server.address() as AddressInfo).port,
    host,
    devices: devices.list,
    close: () =>
      new Promise<void>((resolve) => {
        for (const socket of server.clients) socket.terminate();
        server.close(() => resolve());
      }),
  };
}
