import { allowIf, type ViewModelContext } from '@actable/core';
import { defineScreen } from '../kit';
import type { TodoData } from '../model/todo-data';

function buildTodoViewModel({ data, params }: ViewModelContext<TodoData, { todoId: string }>) {
  const todo = data.todos[params.todoId];
  if (!todo) return { notFound: true as const, todoId: params.todoId };
  return {
    id: todo.id,
    title: todo.title,
    done: todo.done,
    due: todo.due,
    list: { id: todo.listId, name: data.lists[todo.listId]?.name ?? '?' },
    createdAt: todo.createdAt,
    updatedAt: todo.updatedAt,
  };
}

export type TodoViewModel = ReturnType<typeof buildTodoViewModel>;

export const todoScreen = defineScreen({
  route: 'todo',
  viewModel: buildTodoViewModel,
  actions: {
    'todo.update': ({ input, viewModel }) => whyNotThisTodo(viewModel, input.id),
    'todo.toggle': ({ input, viewModel }) => whyNotThisTodo(viewModel, input.id),
    'todo.delete': ({ input, viewModel }) => whyNotThisTodo(viewModel, input.id),
    'nav.back': true,
  },
});

function whyNotThisTodo(viewModel: TodoViewModel, todoId: string): string | null {
  if ('notFound' in viewModel) return 'This todo no longer exists';
  return allowIf(viewModel.id === todoId, `This screen shows "${viewModel.id}", not "${todoId}"`);
}
