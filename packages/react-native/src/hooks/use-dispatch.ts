import { useCallback } from 'react';
import type { DispatchFailure } from '@actable/core';
import { useRuntime } from './use-runtime';

/**
 * Dispatch for UI events, tagged origin "user": the same pipeline the CLI and agents use.
 * `onError` shows failures (e.g. an alert); results are also returned.
 */
export function useDispatch(onError?: (failure: DispatchFailure) => void) {
  const runtime = useRuntime();
  return useCallback(
    async (action: string, input: unknown = {}) => {
      const result = await runtime.dispatch(action, input, { origin: 'user' });
      if (!result.ok) onError?.(result.error);
      return result;
    },
    [runtime, onError],
  );
}
