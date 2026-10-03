import { randomUUID } from 'node:crypto';
import type { IdGenerator } from '@actable/core';

/** "t_" → t_1a2b3c4d */
export const randomIds = (): IdGenerator => ({ next: (prefix) => `${prefix}${randomUUID().slice(0, 8)}` });
