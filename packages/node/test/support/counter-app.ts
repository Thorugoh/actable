import { z } from 'zod';
import { createAppKit, createRuntime, fixedClock, memoryStorage, sequentialIds, type Confirmer } from '@actable/core';

/** A minimal app for exercising remote mode. */
const CounterData = z.object({ count: z.number() });
const CounterRoute = z.object({ name: z.literal('home') });
const { defineAction, defineScreen, defineApp } = createAppKit<z.infer<typeof CounterData>, z.infer<typeof CounterRoute>>();

const increment = defineAction({
  name: 'counter.increment',
  description: 'Add one.',
  risk: 'write',
  input: z.object({}),
  output: z.object({ count: z.number() }),
  handler: ({ context }) => {
    context.setData((data) => ({ count: data.count + 1 }));
    return context.data();
  },
  summarize: ({ output }) => `counted to ${output.count}`,
});

const reset = defineAction({
  name: 'counter.reset',
  description: 'Back to zero.',
  risk: 'destructive',
  input: z.object({}),
  output: z.object({ count: z.number() }),
  handler: ({ context }) => {
    context.setData(() => ({ count: 0 }));
    return context.data();
  },
  confirmText: () => 'Reset the counter?',
  summarize: () => 'reset the counter',
});

export const counterApp = defineApp({
  name: 'counter',
  dataSchema: CounterData,
  routeSchema: CounterRoute,
  initialRoute: { name: 'home' },
  initialData: () => ({ count: 5 }),
  actions: [increment, reset],
  screens: {
    home: defineScreen({ route: 'home', viewModel: ({ data }) => ({ count: data.count }), actions: { 'counter.increment': true } }),
  },
});

export function counterRuntime(confirm?: Confirmer) {
  return createRuntime(counterApp, { ports: { storage: memoryStorage(), clock: fixedClock(), ids: sequentialIds(), confirm } });
}
