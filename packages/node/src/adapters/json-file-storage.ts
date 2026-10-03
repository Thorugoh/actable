import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { Storage } from '@actable/core';

/** The whole state as one JSON file, written atomically (temp file + rename). */
export function jsonFileStorage(path: string): Storage {
  return {
    async load() {
      try {
        return JSON.parse(await readFile(path, 'utf8'));
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
        throw error;
      }
    },
    async save(state) {
      await mkdir(dirname(path), { recursive: true });
      const temporary = `${path}.${randomUUID()}.tmp`;
      await writeFile(temporary, JSON.stringify(state, null, 2));
      await rename(temporary, path);
    },
  };
}
