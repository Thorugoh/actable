import type { Command } from 'commander';
import { DEFAULT_RELAY_PORT } from '@actable/bridge';
import { startRelay, type RelayLogEvent } from '@actable/node';
import { globalOptionsOf } from '../global-options';
import { formatEvent } from '../output/format-event';
import type { Session } from '../session';
import { waitUntilStopped } from '../wait-until-stopped';

const LOOPBACK_HOSTS = ['127.0.0.1', 'localhost', '::1'];

export function registerServeCommand(program: Command, session: Session) {
  program
    .command('serve')
    .description('Run the relay that lets this CLI and agents drive the live app (development only).')
    .option('--port <port>', 'port to listen on', String(DEFAULT_RELAY_PORT))
    .option('--host <host>', 'interface to bind; 0.0.0.0 for physical devices (requires --token)', '127.0.0.1')
    .action(async (serveOptions: { port: string; host: string }, command: Command) => {
      const options = globalOptionsOf(command);
      if (!LOOPBACK_HOSTS.includes(serveOptions.host) && !options.token) {
        throw new Error(`Binding to ${serveOptions.host} exposes the app to the network: pass --token <secret>`);
      }
      const print = session.printer(options);
      const relay = await startRelay({
        port: Number(serveOptions.port),
        host: serveOptions.host,
        token: options.token,
        log: (event) => {
          const line = options.json ? JSON.stringify(event) : describeRelayEvent(event);
          if (line) print.line(line);
        },
      });
      if (!options.json) {
        print.line(`Relay listening on ws://${relay.host}:${relay.port}${options.token ? ' (token required)' : ''}`);
        print.line('Waiting for the app (dev build). Ctrl+C to stop.');
      }
      await waitUntilStopped(session.io.signal);
      await relay.close();
    });
}

function describeRelayEvent(event: RelayLogEvent): string | undefined {
  switch (event.type) {
    case 'device':
      return `${event.status === 'connected' ? '●' : '○'} ${event.device.name} (${event.device.platform}) ${event.status}`;
    case 'rejected':
      return `✗ rejected a connection: ${event.reason}`;
    case 'event':
      return event.event.type === 'device' ? undefined : formatEvent(event.event);
    default:
      return undefined;
  }
}
