import type { AnyRoute } from '@actable/core';

/** What the live feed (`todo watch`, relay logs) shows. */
export type BridgeEvent = DispatchedEvent | NavigatedEvent | DeviceEvent;

export type DispatchedEvent = {
  type: 'dispatch';
  device: string;
  at: string;
  name: string;
  origin: string;
  ok: boolean;
  code?: string;
  summary?: string;
};

export type NavigatedEvent = { type: 'nav'; device: string; at: string; route: AnyRoute };

export type DeviceEvent = { type: 'device'; device: string; at: string; status: 'connected' | 'disconnected' };
