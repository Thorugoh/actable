import { afterEach, describe, expect, it } from 'vitest';
import { connectRelay, startAppBridge, type BridgeEvent, type RelayClient } from '@actable/bridge';
import type { Confirmer } from '@actable/core';
import { startRelay } from '../src';
import { counterRuntime } from './support/counter-app';

const cleanups: Array<() => unknown> = [];
afterEach(async () => {
  while (cleanups.length > 0) await cleanups.pop()!();
});

async function connectedApp(options: { token?: string; confirm?: Confirmer; screenshot?: () => Promise<string>; name?: string } = {}) {
  const relay = await startRelay({ port: 0, token: options.token });
  cleanups.push(relay.close);
  const url = `ws://127.0.0.1:${relay.port}`;
  const runtime = await counterRuntime(options.confirm);
  const bridge = startAppBridge(runtime, {
    url,
    name: options.name ?? 'ios-sim',
    platform: 'ios',
    token: options.token,
    screenshot: options.screenshot,
    reconnectMs: 50,
  });
  cleanups.push(bridge.stop);
  await waitFor(() => relay.devices().length === 1);
  return { relay, url, runtime, bridge };
}

async function client(url: string, options: Parameters<typeof connectRelay>[1] = {}): Promise<RelayClient> {
  const connected = await connectRelay(url, options);
  cleanups.push(connected.close);
  return connected;
}

async function waitFor(condition: () => boolean, timeoutMs = 2000) {
  const deadline = Date.now() + timeoutMs;
  while (!condition()) {
    if (Date.now() > deadline) throw new Error('timed out');
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}

describe('remote mode: client → relay → app', () => {
  it('runs actions in the live app and inspects its screen', async () => {
    const { url, runtime } = await connectedApp();
    const remote = await client(url);
    expect(await remote.dispatch('counter.increment', {}, { origin: 'agent:claude' })).toMatchObject({ ok: true, value: { count: 6 } });
    expect(runtime.getState().data.count).toBe(6);
    expect(await remote.inspect()).toMatchObject({ route: { name: 'home' }, viewModel: { count: 6 } });
  });

  it('lists actions and connected devices', async () => {
    const { url } = await connectedApp();
    const remote = await client(url);
    expect((await remote.describeActions()).map((action) => action.name)).toContain('counter.increment');
    expect(await remote.devices()).toMatchObject([{ name: 'ios-sim', platform: 'ios' }]);
  });

  it('waits while the human on the device decides', async () => {
    let answer: (approved: boolean) => void = () => {};
    const { url, runtime } = await connectedApp({ confirm: () => new Promise((resolve) => (answer = resolve)) });
    const remote = await client(url);
    const pending = remote.dispatch('counter.reset', {}, { origin: 'agent:claude' });
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(runtime.getState().data.count).toBe(5);
    answer(true);
    expect(await pending).toMatchObject({ ok: true, value: { count: 0 } });
  });

  it('streams dispatches (including taps) and navigation', async () => {
    const { url, runtime } = await connectedApp();
    const remote = await client(url);
    const events: BridgeEvent[] = [];
    await remote.onEvent((event) => events.push(event));
    await runtime.dispatch('counter.increment', {}, { origin: 'user' });
    await runtime.dispatch('nav.reset', {}, { origin: 'user' });
    await waitFor(() => events.length >= 2);
    expect(events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'dispatch', name: 'counter.increment', origin: 'user', ok: true, summary: 'counted to 6' }),
      ]),
    );
  });

  it('returns screenshots when the app can take them', async () => {
    const { url } = await connectedApp({ screenshot: async () => 'iVBORw0KGgo=' });
    expect(await (await client(url)).screenshot()).toEqual({ base64: 'iVBORw0KGgo=', format: 'png' });
  });

  it('explains when no app is connected', async () => {
    const relay = await startRelay({ port: 0 });
    cleanups.push(relay.close);
    await expect((await client(`ws://127.0.0.1:${relay.port}`)).inspect()).rejects.toThrow(/No app is connected/);
  });

  it('picks a device by name prefix and refuses to guess between several', async () => {
    const { url, relay } = await connectedApp({ name: 'ios-sim' });
    const android = startAppBridge(await counterRuntime(), { url, name: 'android-emu', platform: 'android', reconnectMs: 50 });
    cleanups.push(android.stop);
    await waitFor(() => relay.devices().length === 2);
    await expect((await client(url)).inspect()).rejects.toThrow(/Several apps are connected/);
    expect((await (await client(url, { device: 'android' })).devices()).length).toBe(2);
    expect(await (await client(url, { device: 'android' })).inspect()).toMatchObject({ viewModel: { count: 5 } });
  });

  it('requires the pairing token when one is set', async () => {
    const { url } = await connectedApp({ token: 's3cret' });
    await expect((await client(url, { token: 'wrong' })).inspect()).rejects.toThrow(/pairing token|closed/);
    expect((await (await client(url, { token: 's3cret' })).inspect()).route).toEqual({ name: 'home' });
  });

  it('fails pending calls when the app disconnects', async () => {
    const { url, relay, bridge } = await connectedApp({ confirm: () => new Promise(() => {}) });
    const pending = (await client(url)).dispatch('counter.reset', {}, { origin: 'agent:claude' });
    await new Promise((resolve) => setTimeout(resolve, 30));
    bridge.stop();
    await expect(pending).rejects.toThrow(/disconnected/);
    await waitFor(() => relay.devices().length === 0);
  });
});
