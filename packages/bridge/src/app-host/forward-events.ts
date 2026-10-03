import { currentRoute, type Runtime } from '@actable/core';
import type { BridgeEvent } from '../protocol/bridge-events';

/** Turns runtime activity (every dispatch and navigation) into bridge events. Returns an unsubscribe. */
export function forwardEvents(runtime: Runtime, device: string, emit: (event: BridgeEvent) => void): () => void {
  const now = () => new Date().toISOString();

  const stopDispatches = runtime.onDispatch(({ name, meta, result, summary }) =>
    emit({
      type: 'dispatch',
      device,
      at: now(),
      name,
      origin: meta.origin,
      ok: result.ok,
      code: result.ok ? undefined : result.error.code,
      summary,
    }),
  );

  const stopNavigation = runtime.subscribe((state, previous) => {
    if (state.navigation !== previous.navigation) {
      emit({ type: 'nav', device, at: now(), route: currentRoute(state.navigation) });
    }
  });

  return () => {
    stopDispatches();
    stopNavigation();
  };
}
