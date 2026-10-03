import { createInterface } from 'node:readline/promises';
import { describeOrigin, type Confirmer } from '@actable/core';

/** When a person is at the terminal, destructive agent actions ask them with a y/N prompt. */
export function terminalConfirmer(stdin: NodeJS.ReadableStream): Confirmer {
  return async (request) => {
    const prompt = createInterface({ input: stdin, output: process.stderr });
    try {
      const answer = await prompt.question(`? ${describeOrigin(request.origin)} wants to: ${request.question} [y/N] `);
      return /^y(es)?$/i.test(answer.trim());
    } finally {
      prompt.close();
    }
  };
}
