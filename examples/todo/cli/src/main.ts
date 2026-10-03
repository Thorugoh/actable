import { processIO, runCli } from '@actable/cli';
import { todoCli } from './todo-cli';

process.exitCode = await runCli(todoCli, process.argv.slice(2), processIO());
