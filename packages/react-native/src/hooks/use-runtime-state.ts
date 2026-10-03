import { useSyncExternalStore } from 'react';
import type { RuntimeState } from '@actable/core';
import { useRuntime } from './use-runtime';

/** Subscribes to a slice of runtime state. The selector must return stable references. */
export function useRuntimeState<TSelected>(selector: (state: RuntimeState) => TSelected): TSelected {
  const runtime = useRuntime();
  return useSyncExternalStore(runtime.subscribe, () => selector(runtime.getState()));
}
