import type { BridgeEvent } from '@actable/bridge';
import { describeOrigin } from '@actable/core';

const timeOf = (iso: string) => iso.slice(11, 19);

/** One line of the live feed, e.g. `12:01:02  ios-sim  Claude   todo.create    ✓ Claude added "Buy milk"`. */
export function formatEvent(event: BridgeEvent): string {
  const prefix = `${timeOf(event.at)}  ${event.device}`;
  switch (event.type) {
    case 'device':
      return `${prefix}  ${event.status === 'connected' ? '● connected' : '○ disconnected'}`;
    case 'nav': {
      const params = 'params' in event.route ? ` ${JSON.stringify(event.route.params)}` : '';
      return `${prefix}  ↪ ${event.route.name}${params}`;
    }
    case 'dispatch': {
      const who = describeOrigin(event.origin);
      const outcome = event.ok ? `✓${event.summary ? ` ${who} ${event.summary}` : ''}` : `✗ ${event.code}`;
      return `${prefix}  ${who.padEnd(8)} ${event.name.padEnd(14)} ${outcome}`;
    }
  }
}
