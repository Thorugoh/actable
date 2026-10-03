import type { RpcId } from '@actable/bridge';

type ForwardedCall<TClient> = { client: TClient; clientRequestId: RpcId; device: string; timer: ReturnType<typeof setTimeout> };

/** Requests the relay forwarded to an app and is waiting to route back to a client. */
export function createForwardedCalls<TClient>() {
  let lastId = 0;
  const calls = new Map<string, ForwardedCall<TClient>>();

  return {
    start(call: Omit<ForwardedCall<TClient>, 'timer'>, timeoutMs: number, onTimeout: () => void): string {
      const relayId = `r${++lastId}`;
      const timer = setTimeout(() => {
        calls.delete(relayId);
        onTimeout();
      }, timeoutMs);
      calls.set(relayId, { ...call, timer });
      return relayId;
    },
    finish(relayId: string): ForwardedCall<TClient> | undefined {
      const call = calls.get(relayId);
      if (!call) return undefined;
      clearTimeout(call.timer);
      calls.delete(relayId);
      return call;
    },
    /** Removes and returns every call matching the predicate (e.g. all calls to a device that left). */
    finishWhere(predicate: (call: ForwardedCall<TClient>) => boolean): ForwardedCall<TClient>[] {
      const finished = [...calls.entries()].filter(([, call]) => predicate(call));
      return finished.map(([relayId]) => this.finish(relayId)!);
    },
  };
}
