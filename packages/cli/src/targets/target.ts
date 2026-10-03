import type { ActionInfo, Dispatch } from '@actable/core';

/** What commands run against: an in-process runtime, or the live app through the relay. Same interface. */
export type Target = {
  dispatch: Dispatch;
  describeActions(): Promise<ActionInfo[]>;
  isRemote: boolean;
  close(): Promise<void>;
};
