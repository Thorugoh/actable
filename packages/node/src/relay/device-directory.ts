import { RpcErrorCodes, type DeviceInfo } from '@actable/bridge';
import type { WebSocket } from 'ws';

export type ConnectedDevice = DeviceInfo & { socket: WebSocket };

export type DeviceLookup = { device: ConnectedDevice } | { code: number; error: string };

/** The apps currently connected to the relay, and how a client's `--device` picks one. */
export function createDeviceDirectory() {
  const devices = new Map<string, ConnectedDevice>();

  function list(): DeviceInfo[] {
    return [...devices.values()].map(({ socket: _socket, ...info }) => info);
  }

  /** Exact name, else a unique prefix ("ios" matches "ios-sim"), else the only connected app. */
  function find(requested?: string): DeviceLookup {
    const all = [...devices.values()];
    const names = all.map((device) => device.name).join(', ');
    if (all.length === 0) {
      return { code: RpcErrorCodes.NoDevice, error: 'No app is connected. Start the app in dev mode and check it can reach the relay.' };
    }
    if (!requested) {
      if (all.length === 1) return { device: all[0]! };
      return { code: RpcErrorCodes.AmbiguousDevice, error: `Several apps are connected (${names}). Pick one with --device <name>.` };
    }
    const exact = devices.get(requested);
    if (exact) return { device: exact };
    const matches = all.filter((device) => device.name.startsWith(requested));
    if (matches.length === 1) return { device: matches[0]! };
    return {
      code: matches.length > 0 ? RpcErrorCodes.AmbiguousDevice : RpcErrorCodes.NoDevice,
      error: `No single app matches "${requested}". Connected: ${names}`,
    };
  }

  return {
    list,
    find,
    get: (name: string) => devices.get(name),
    add: (device: ConnectedDevice) => devices.set(device.name, device),
    remove: (name: string) => devices.delete(name),
  };
}
