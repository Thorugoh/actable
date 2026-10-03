import { connectRelay, type RelayClient } from '@actable/bridge';
import type { GlobalOptions } from '../global-options';
import type { Target } from './target';

export function connectToRelay(options: GlobalOptions): Promise<RelayClient> {
  return connectRelay(options.relay, { device: options.device, token: options.token });
}

/** Runs commands against the live app through the relay. */
export async function createRemoteTarget(options: GlobalOptions): Promise<Target> {
  const client = await connectToRelay(options);
  return {
    dispatch: client.dispatch,
    describeActions: client.describeActions,
    isRemote: true,
    close: async () => client.close(),
  };
}
