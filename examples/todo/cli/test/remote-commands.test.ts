import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { startAppBridge } from '@actable/bridge';
import { createRuntime, fixedClock, freshState, memoryStorage, sequentialIds, type Runtime } from '@actable/core';
import { startRelay, type Relay } from '@actable/node';
import { todoApp, todoFixtures, type TodoData, type TodoRoute } from '@todo/domain';
import { runTodoCli, scenarioFile } from './run-todo-cli';

describe('todo CLI, --remote (CLI → relay → live app)', () => {
  let relay: Relay;
  let runtime: Runtime<TodoData, TodoRoute>;
  let stopBridge: () => void;
  let relayArgs: string[];
  let answerConfirmation: (approved: boolean) => void;

  beforeEach(async () => {
    relay = await startRelay({ port: 0 });
    relayArgs = ['--relay', `ws://127.0.0.1:${relay.port}`];
    runtime = await createRuntime(todoApp, {
      ports: {
        storage: memoryStorage(freshState(todoApp, todoFixtures.demo())),
        clock: fixedClock(),
        ids: sequentialIds(),
        confirm: () => new Promise((resolve) => (answerConfirmation = resolve)),
      },
    });
    stopBridge = startAppBridge(runtime, {
      url: `ws://127.0.0.1:${relay.port}`,
      name: 'ios-sim',
      platform: 'ios',
      screenshot: async () => 'aGVsbG8=',
    }).stop;
    while (relay.devices().length === 0) await new Promise((resolve) => setTimeout(resolve, 10));
  });
  afterEach(async () => {
    stopBridge();
    await relay.close();
  });

  const remoteCli = (...argv: string[]) => runTodoCli([...relayArgs, ...argv]);

  it('runs actions in the live app', async () => {
    const result = await remoteCli('--remote', '--as', 'agent:claude', '--json', 'run', 'todo.create', '{"title":"Remote milk"}');
    expect(result.json()).toMatchObject({ ok: true, value: { title: 'Remote milk' } });
    expect(runtime.getState().journal[0]).toMatchObject({ origin: 'agent:claude', summary: 'added "Remote milk"' });
  });

  it('inspects the live screen and lists devices', async () => {
    await runtime.dispatch('nav.push', { route: { name: 'list', params: { listId: 'groceries' } } }, { origin: 'user' });
    expect((await remoteCli('--device', 'ios', '--json', 'inspect')).json().value).toMatchObject({ viewModel: { title: 'Groceries' } });
    expect((await remoteCli('--json', 'devices')).json()).toMatchObject([{ name: 'ios-sim' }]);
  });

  it('replays the same scenario files against the live app', async () => {
    const result = await remoteCli('--remote', 'run-script', ...['happy-path', 'agent-safety', 'undo', 'lists'].map(scenarioFile));
    expect(result.stderr).toBe('');
    expect(result.code).toBe(0);
    expect(result.stdout).toContain('(remote)');
  });

  it('waits for the user to decide on the device', async () => {
    const pending = remoteCli('--remote', '--as', 'agent:claude', '--json', 'run', 'todo.delete', '{"id":"t_eggs"}');
    await new Promise((resolve) => setTimeout(resolve, 50));
    answerConfirmation(false);
    expect((await pending).json()).toMatchObject({ ok: false, error: { code: 'confirmation_denied' } });
    expect(runtime.getState().data.todos.t_eggs).toBeDefined();
  });

  it('saves a screenshot', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'todo-shot-'));
    expect((await remoteCli('screenshot', join(directory, 'shot.png'))).code).toBe(0);
    expect(await readFile(join(directory, 'shot.png'), 'utf8')).toBe('hello');
    await rm(directory, { recursive: true, force: true });
  });

  it('streams the live feed with watch until stopped', async () => {
    const stop = new AbortController();
    let output = '';
    const watching = runTodoCli([...relayArgs, 'watch'], { stdout: (text) => (output += text), signal: stop.signal });
    await new Promise((resolve) => setTimeout(resolve, 100));
    await runtime.dispatch('todo.toggle', { id: 't_eggs' }, { origin: 'agent:claude' });
    await new Promise((resolve) => setTimeout(resolve, 50));
    stop.abort();
    expect((await watching).code).toBe(0);
    expect(output).toMatch(/ios-sim {2}Claude +todo\.toggle +✓ Claude completed "Eggs"/);
  });

  it('explains how to start the relay when it is not running', async () => {
    const result = await runTodoCli(['--relay', 'ws://127.0.0.1:1', '--remote', 'inspect']);
    expect(result.code).toBe(1);
    expect(result.stderr).toContain('"serve"');
  });
});
