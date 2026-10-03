import { readFile } from 'node:fs/promises';
import type { Command } from 'commander';
import { parseScenario, runScenario, type StepReport } from '@actable/core';
import { globalOptionsOf } from '../global-options';
import { parseDelay } from '../input/parse-delay';
import { parseOrigin } from '../input/parse-origin';
import type { Printer } from '../output/printer';
import type { Session } from '../session';

export function registerRunScriptCommand(program: Command, session: Session) {
  program
    .command('run-script <files...>')
    .description('Replay JSONL scenarios and check their expectations. Local runs are in memory unless --data is given.')
    .option('--delay <ms>', 'pause between actions, to watch them happen in the live app (with --remote)', parseDelay)
    .addHelpText('after', `\nExample:\n  ${session.config.name} --remote run-script scenarios/happy-path.jsonl --delay 1500`)
    .action(async (files: string[], scriptOptions: { delay?: number }, command: Command) => {
      const options = globalOptionsOf(command);
      const target = await session.openTarget(options, { memoryByDefault: true });
      const print = session.printer(options);
      const reports = [];

      for (const file of files) {
        if (!options.json) print.line(`▶ ${file}${target.isRemote ? ' (remote)' : ''}`);
        const startedAt = performance.now();
        const report = await runScenario(parseScenario(await readFile(file, 'utf8')), target.dispatch, {
          origin: parseOrigin(options.as),
          uiStrict: options.uiStrict,
          delayMs: scriptOptions.delay,
          onStep: options.json ? undefined : (step) => printStep(print, step),
        });
        const ms = Math.round(performance.now() - startedAt);
        reports.push({ file, ms, ...report });
        if (!report.ok) session.markFailed();
        if (!options.json) print.line(`${report.ok ? '✓' : '✗'} ${file} (${ms}ms)`);
      }

      if (options.json) print.value(reports);
    });
}

function printStep(print: Printer, step: StepReport) {
  const line = `  ${step.ok ? '✓' : '✗'} L${step.line} ${step.message}`;
  if (step.ok) print.line(line);
  else print.problem(line);
}
