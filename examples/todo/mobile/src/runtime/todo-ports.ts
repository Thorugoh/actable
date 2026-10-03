import { systemClock, withMigration, type Ports } from '@actable/core';
import { createConfirmationQueue } from '@actable/react-native';
import { expoRandomIds, expoSqliteStorage } from '@actable/react-native/expo';
import { migrateStoredState } from './migrate-stored-state';

/** Agent requests that need the user's approval queue here; <ConfirmationSheet> shows them. */
export const confirmations = createConfirmationQueue();

/** How the todo runtime talks to the phone: SQLite storage, ids, clock and the confirmation sheet. */
export const todoPorts: Ports = {
  storage: withMigration(expoSqliteStorage('todo-app-state-v1'), migrateStoredState),
  clock: systemClock(),
  ids: expoRandomIds(),
  confirm: confirmations.confirm,
};
