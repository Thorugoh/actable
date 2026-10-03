import { Command, Option } from 'commander';
import { DEFAULT_RELAY_URL } from '@actable/bridge';
import { defaultDataFile, type CliConfig } from './cli-config';

/** Options every command understands. */
export type GlobalOptions = {
  data?: string;
  fixture?: string;
  json?: boolean;
  as: string;
  uiStrict?: boolean;
  remote?: boolean;
  device?: string;
  relay: string;
  token?: string;
};

export function addGlobalOptions(program: Command, config: CliConfig): Command {
  const fixtures = Object.keys(config.app.fixtures ?? {});
  const fixtureOption = new Option('--fixture <name>', 'run in memory from a fixture; nothing is saved');
  if (fixtures.length > 0) fixtureOption.choices(fixtures);

  return program
    .option('--data <path>', `state file for local runs (default: ${defaultDataFile(config)})`)
    .addOption(fixtureOption)
    .option('--json', 'machine-readable output (one JSON document)')
    .option('--as <origin>', 'who is acting: user | system | agent:<id>', 'user')
    .option('--ui-strict', 'only allow what a user could do from the current screen (navigate first)')
    .option('--remote', 'run against the live app through the relay (see "serve")')
    .addOption(new Option('--device <name>', 'which connected app to use (name or prefix), when several are connected').env('ACTABLE_DEVICE'))
    .addOption(new Option('--relay <url>', 'relay URL').env('ACTABLE_RELAY_URL').default(DEFAULT_RELAY_URL))
    .addOption(new Option('--token <token>', 'relay pairing token').env('ACTABLE_RELAY_TOKEN'));
}

export function globalOptionsOf(command: Command): GlobalOptions {
  return command.optsWithGlobals<GlobalOptions>();
}
