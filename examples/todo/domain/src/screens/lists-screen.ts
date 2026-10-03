import { allowIf } from '@actable/core';
import { defineScreen } from '../kit';
import { listsWithCounts } from '../queries/todos-in-list';

export const listsScreen = defineScreen({
  route: 'lists',
  viewModel: ({ data }) => ({
    title: 'Lists',
    lists: listsWithCounts(data).map((list) => ({ id: list.id, name: list.name, open: list.counts.open, done: list.counts.done })),
  }),
  actions: {
    'list.create': true,
    'nav.push': ({ input, viewModel }) => {
      const { route } = input;
      if (route.name === 'activity') return null;
      if (route.name !== 'list') return `The Lists screen opens a list or Activity, not "${route.name}"`;
      return allowIf(viewModel.lists.some((list) => list.id === route.params.listId), `List "${route.params.listId}" isn't shown here`);
    },
  },
});

export type ListsViewModel = ReturnType<typeof listsScreen.viewModel>;
