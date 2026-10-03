import { useContext } from 'react';
import type { Runtime } from '@actable/core';
import { RuntimeContext } from '../runtime-provider';

export function useRuntime(): Runtime {
  const runtime = useContext(RuntimeContext);
  if (!runtime) throw new Error('useRuntime must be used inside <RuntimeProvider>');
  return runtime;
}
