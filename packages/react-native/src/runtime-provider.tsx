import { createContext, useEffect, useState, type ReactNode } from 'react';
import { createRuntime, type AnyAppDefinition, type Policy, type Ports, type Runtime } from '@actable/core';

export const RuntimeContext = createContext<Runtime | null>(null);

type RuntimeProviderProps = {
  app: AnyAppDefinition;
  /** Create them once (outside render); the runtime is created on mount. */
  ports: Ports;
  policy?: Policy;
  /** Rendered while the stored state loads. */
  fallback: ReactNode;
  children: ReactNode;
};

/** Starts the app's runtime (the same one the CLI and tests use) and provides it to hooks. */
export function RuntimeProvider({ app, ports, policy, fallback, children }: RuntimeProviderProps) {
  const [runtime, setRuntime] = useState<Runtime | null>(null);
  const [startupError, setStartupError] = useState<Error | null>(null);

  useEffect(() => {
    createRuntime(app, { ports, policy }).then(setRuntime, setStartupError);
  }, [app, ports, policy]);

  if (startupError) throw startupError;
  if (!runtime) return fallback;
  return <RuntimeContext.Provider value={runtime}>{children}</RuntimeContext.Provider>;
}
