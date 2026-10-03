import { useSyncExternalStore } from 'react';
import type { AnyRoute } from '@actable/core';
import { useRuntime } from './use-runtime';

/**
 * The view model of a screen: what to render. Re-renders when it changes. View models are
 * memoized per state, so this is safe with useSyncExternalStore.
 *
 *   const viewModel = useViewModel<ListViewModel>({ name: 'list', params: { listId } });
 */
export function useViewModel<TViewModel>(route: AnyRoute): TViewModel {
  const runtime = useRuntime();
  return useSyncExternalStore(runtime.subscribe, () => runtime.viewModel(route)) as TViewModel;
}
