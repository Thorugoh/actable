import { useSyncExternalStore } from 'react';
import type { ConfirmationRequest, Confirmer } from '@actable/core';

type PendingConfirmation = ConfirmationRequest & { resolve: (approved: boolean) => void };

/**
 * Implements the runtime's Confirmer port for a UI: requests queue up, a component shows the
 * first one (e.g. a bottom sheet) and answers it. The runtime waits until the user decides.
 *
 *   const confirmations = createConfirmationQueue();       // once, at module level
 *   ports = { ..., confirm: confirmations.confirm };
 *   const request = confirmations.useCurrentRequest();    // in the sheet component
 *   confirmations.answer(true);
 */
export function createConfirmationQueue() {
  let queue: PendingConfirmation[] = [];
  const listeners = new Set<() => void>();
  const notify = () => listeners.forEach((listener) => listener());
  const subscribe = (listener: () => void) => {
    listeners.add(listener);
    return () => void listeners.delete(listener);
  };

  const confirm: Confirmer = (request) =>
    new Promise<boolean>((resolve) => {
      queue = [...queue, { ...request, resolve }];
      notify();
    });

  function answer(approved: boolean) {
    const [current, ...rest] = queue;
    if (!current) return;
    queue = rest;
    notify();
    current.resolve(approved);
  }

  function useCurrentRequest(): ConfirmationRequest | undefined {
    return useSyncExternalStore(subscribe, () => queue[0]);
  }

  return { confirm, answer, useCurrentRequest };
}
