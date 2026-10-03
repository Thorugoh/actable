import type { AnyAppDefinition } from '@actable/core';

/** What an app provides to get a CLI: `runCli({ name: 'todo', app: todoApp }, argv, io)`. */
export type CliConfig = {
  /** The binary name, used in help and messages. */
  name: string;
  app: AnyAppDefinition;
  /** Where local runs keep state. Defaults to `.<name>/state.json` in the working directory. */
  dataFile?: string;
};

export type CliIO = {
  stdout: (text: string) => void;
  stderr: (text: string) => void;
  stdin?: NodeJS.ReadableStream;
  /** A human is at the terminal, so destructive agent actions can be confirmed with a prompt. */
  interactive?: boolean;
  /** Ends long-running commands (serve, watch). Defaults to Ctrl+C. */
  signal?: AbortSignal;
};

/** The IO of the current process, for bin scripts. */
export function processIO(): CliIO {
  return {
    stdout: (text) => void process.stdout.write(text),
    stderr: (text) => void process.stderr.write(text),
    stdin: process.stdin,
    interactive: Boolean(process.stdin.isTTY && process.stdout.isTTY),
  };
}

export const defaultDataFile = (config: CliConfig) => config.dataFile ?? `.${config.name}/state.json`;
