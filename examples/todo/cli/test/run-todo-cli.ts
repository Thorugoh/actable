import { runCli, type CliIO } from '@actable/cli';
import { todoCli } from '../src/todo-cli';

/** Runs the todo CLI in-process and captures its output. */
export async function runTodoCli(argv: string[], io: Partial<CliIO> = {}) {
  let stdout = '';
  let stderr = '';
  const code = await runCli(todoCli, argv, {
    stdout: (text) => (stdout += text),
    stderr: (text) => (stderr += text),
    ...io,
  });
  return { code, stdout, stderr, json: () => JSON.parse(stdout) };
}

export const scenarioFile = (name: string) => new URL(`../../scenarios/${name}.jsonl`, import.meta.url).pathname;
