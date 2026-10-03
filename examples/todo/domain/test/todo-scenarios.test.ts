import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { actionsUsedBy, parseScenario, runScenario } from '@actable/core';
import { makeTodoRuntime } from './make-todo-runtime';

const scenarioDirectory = join(import.meta.dirname, '../../scenarios');
const scenarioFiles = readdirSync(scenarioDirectory).filter((file) => file.endsWith('.jsonl'));
const readScenario = (file: string) => parseScenario(readFileSync(join(scenarioDirectory, file), 'utf8'));

describe('todo scenarios (headless)', () => {
  it.each(scenarioFiles)('%s passes', async (file) => {
    const runtime = await makeTodoRuntime('empty');
    const report = await runScenario(readScenario(file), runtime.dispatch);
    const failed = report.steps.find((step) => !step.ok);
    expect(failed ? `line ${failed.line}: ${failed.message}` : 'ok').toBe('ok');
  });

  it('happy-path.jsonl passes in strict UI mode (every step is something a user could tap)', async () => {
    const runtime = await makeTodoRuntime('empty');
    const report = await runScenario(readScenario('happy-path.jsonl'), runtime.dispatch, { uiStrict: true });
    expect(report.steps.find((step) => !step.ok)?.message ?? 'ok').toBe('ok');
  });

  it('together, the scenarios use every action', async () => {
    const runtime = await makeTodoRuntime();
    const used = new Set(scenarioFiles.flatMap((file) => actionsUsedBy(readScenario(file))));
    const unused = runtime.describeActions().map((action) => action.name).filter((name) => !used.has(name));
    expect(unused).toEqual([]);
  });
});
