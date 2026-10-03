import { allowIf, type ViewModelContext } from '@actable/core';
import { defineScreen } from '../kit';
import type { TodoData } from '../model/todo-data';
import { countTodos, todosInList } from '../queries/todos-in-list';

function buildListViewModel({ data, params }: ViewModelContext<TodoData, { listId: string }>) {
  const list = data.lists[params.listId];
  if (!list) return { notFound: true as const, listId: params.listId };
  return {
    listId: list.id,
    title: list.name,
    filter: data.filter,
    counts: countTodos(data, list.id),
    items: todosInList(data, list.id, data.filter).map((todo) => ({ id: todo.id, title: todo.title, done: todo.done, due: todo.due })),
  };
}

export type ListViewModel = ReturnType<typeof buildListViewModel>;

export const listScreen = defineScreen({
  route: 'list',
  viewModel: buildListViewModel,
  actions: {
    'todo.create': ({ input, viewModel }) =>
      'notFound' in viewModel ? 'This list no longer exists' : allowIf(input.listId === viewModel.listId, `This screen adds to "${viewModel.listId}"`),
    'todo.toggle': ({ input, viewModel }) => whyNotVisible(viewModel, input.id),
    'todo.delete': ({ input, viewModel }) => whyNotVisible(viewModel, input.id),
    'ui.setFilter': true,
    'nav.push': ({ input, viewModel }) =>
      input.route.name === 'todo' ? whyNotVisible(viewModel, input.route.params.todoId) : `A list only opens its todos, not "${input.route.name}"`,
    'nav.back': true,
  },
});

function whyNotVisible(viewModel: ListViewModel, todoId: string): string | null {
  if ('notFound' in viewModel) return 'This list no longer exists';
  const visible = viewModel.items.some((item) => item.id === todoId);
  return allowIf(visible, `Todo "${todoId}" isn't visible on this screen (filter: ${viewModel.filter})`);
}
