import { createRuntime, fixedClock, freshState, memoryStorage, sequentialIds, type DispatchResult, type Ports } from '@actable/core';
import { todoApp, todoFixtures } from '../src';

export async function makeTodoRuntime(fixture: keyof typeof todoFixtures = 'demo', ports: Partial<Ports> = {}) {
  return createRuntime(todoApp, {
    ports: { storage: memoryStorage(freshState(todoApp, todoFixtures[fixture]())), clock: fixedClock(), ids: sequentialIds(), ...ports },
  });
}

export const asUser = { origin: 'user' } as const;

export function valueOf<T>(result: DispatchResult<T>): T {
  if (!result.ok) throw new Error(`[${result.error.code}] ${result.error.message}`);
  return result.value;
}
