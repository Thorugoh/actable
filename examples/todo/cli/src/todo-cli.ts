import type { CliConfig } from '@actable/cli';
import { todoApp } from '@todo/domain';

/** The whole todo CLI is this config: every command comes from @actable/cli. */
export const todoCli: CliConfig = { name: 'todo', app: todoApp };
