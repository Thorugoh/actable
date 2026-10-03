import { resolve } from 'node:path';
import { createRuntime, freshState, memoryStorage, systemClock, type Storage } from '@actable/core';
import { jsonFileStorage, randomIds } from '@actable/node';
import { defaultDataFile, type CliConfig, type CliIO } from '../cli-config';
import type { GlobalOptions } from '../global-options';
import { terminalConfirmer } from '../input/terminal-confirmer';
import type { Target } from './target';

/** Runs the app headlessly in this process. */
export async function createLocalTarget(args: {
  config: CliConfig;
  options: GlobalOptions;
  io: CliIO;
  /** Use memory instead of the state file unless --data is given (e.g. scenario runs). */
  memoryByDefault: boolean;
}): Promise<Target> {
  const { config, options, io } = args;
  const runtime = await createRuntime(config.app, {
    ports: {
      storage: chooseStorage(args),
      clock: systemClock(),
      ids: randomIds(),
      confirm: io.interactive && !options.json && io.stdin ? terminalConfirmer(io.stdin) : undefined,
    },
  });
  return {
    dispatch: runtime.dispatch,
    describeActions: async () => runtime.describeActions(),
    isRemote: false,
    close: runtime.flush,
  };
}

function chooseStorage({ config, options, memoryByDefault }: { config: CliConfig; options: GlobalOptions; memoryByDefault: boolean }): Storage {
  if (options.fixture) {
    const fixture = config.app.fixtures?.[options.fixture];
    if (!fixture) throw new Error(`Unknown fixture "${options.fixture}"`);
    return memoryStorage(freshState(config.app, fixture()));
  }
  if (memoryByDefault && !options.data) return memoryStorage();
  return jsonFileStorage(resolve(options.data ?? defaultDataFile(config)));
}
