import { randomUUID } from 'expo-crypto';
import KeyValueStore from 'expo-sqlite/kv-store';
import type { IdGenerator, Storage } from '@actable/core';

/** The whole runtime state as one row in SQLite (Expo). */
export function expoSqliteStorage(key: string): Storage {
  return {
    async load() {
      const stored = await KeyValueStore.getItemAsync(key);
      return stored ? JSON.parse(stored) : null;
    },
    async save(state) {
      await KeyValueStore.setItemAsync(key, JSON.stringify(state));
    },
  };
}

export const expoRandomIds = (): IdGenerator => ({ next: (prefix) => `${prefix}${randomUUID().slice(0, 8)}` });
