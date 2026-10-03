import { allowIf, describeJournal } from '@actable/core';
import { defineScreen } from '../kit';

export const activityScreen = defineScreen({
  route: 'activity',
  viewModel: ({ journal }) => ({ title: 'Activity', entries: describeJournal(journal) }),
  actions: {
    // Each entry has its own Undo button, so strict mode needs to know which one is "tapped".
    'journal.undo': ({ input, viewModel }) =>
      input.entryId
        ? allowIf(viewModel.entries.some((entry) => entry.id === input.entryId && entry.undoable), `No Undo button for "${input.entryId}" here`)
        : 'Pass the entryId of the Undo button to tap',
    'nav.back': true,
  },
});

export type ActivityViewModel = ReturnType<typeof activityScreen.viewModel>;
