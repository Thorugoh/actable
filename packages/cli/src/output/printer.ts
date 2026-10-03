import type { DispatchResult } from '@actable/core';
import type { CliIO } from '../cli-config';

/** Writes results: pretty JSON for humans, one compact JSON document with --json. */
export function createPrinter(io: CliIO, json: boolean | undefined) {
  return {
    value(value: unknown) {
      io.stdout(`${json ? JSON.stringify(value) : JSON.stringify(value, null, 2)}\n`);
    },
    line(text: string) {
      io.stdout(`${text}\n`);
    },
    problem(text: string) {
      io.stderr(`${text}\n`);
    },
    /** Returns whether the result was successful. */
    result(result: DispatchResult): boolean {
      if (json) this.value(result);
      else if (result.ok) this.value(result.value);
      else {
        this.problem(`✗ [${result.error.code}] ${result.error.message}`);
        if (result.error.details !== undefined) this.problem(JSON.stringify(result.error.details, null, 2));
      }
      return result.ok;
    },
  };
}

export type Printer = ReturnType<typeof createPrinter>;
