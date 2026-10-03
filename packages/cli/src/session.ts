import type { RelayClient } from '@actable/bridge';
import type { CliConfig, CliIO } from './cli-config';
import type { GlobalOptions } from './global-options';
import { createPrinter } from './output/printer';
import { createLocalTarget } from './targets/local-target';
import { connectToRelay, createRemoteTarget } from './targets/remote-target';
import type { Target } from './targets/target';

/** Shared by all commands in one CLI invocation: config, IO, exit code, and what must be closed. */
export function createSession(config: CliConfig, io: CliIO) {
  const cleanups: Array<() => Promise<void> | void> = [];
  let exitCode = 0;

  return {
    config,
    io,
    printer: (options: GlobalOptions) => createPrinter(io, options.json),

    /** The live app with --remote/--device, otherwise a local runtime. */
    async openTarget(options: GlobalOptions, { memoryByDefault = false } = {}): Promise<Target> {
      const wantsRemote = options.remote || Boolean(options.device);
      const target = wantsRemote ? await createRemoteTarget(options) : await createLocalTarget({ config, options, io, memoryByDefault });
      cleanups.push(target.close);
      return target;
    },

    async openRelay(options: GlobalOptions): Promise<RelayClient> {
      const client = await connectToRelay(options);
      cleanups.push(client.close);
      return client;
    },

    markFailed() {
      exitCode = 1;
    },
    exitCode: () => exitCode,

    /** Saves local state and closes connections. Always runs, even after errors. */
    async close() {
      await Promise.all(cleanups.map((cleanup) => cleanup()));
    },
  };
}

export type Session = ReturnType<typeof createSession>;
