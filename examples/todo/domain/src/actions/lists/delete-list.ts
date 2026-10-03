import { ActionError } from '@actable/core';
import { z } from 'zod';
import { defineAction } from '../../kit';
import { INBOX_ID, ListSchema } from '../../model/list';
import { TodoSchema } from '../../model/todo';
import { findList } from '../../queries/find';
import { todosInList } from '../../queries/todos-in-list';

export const deleteList = defineAction({
  name: 'list.delete',
  description: 'Delete a list and all its todos. The Inbox cannot be deleted. Agents need the user to confirm.',
  risk: 'destructive',
  input: z.object({ id: z.string().min(1) }),
  output: z.object({ deleted: ListSchema, todos: z.array(TodoSchema) }),
  handler: ({ input, context }) => {
    if (input.id === INBOX_ID) throw new ActionError('forbidden', 'The Inbox cannot be deleted');
    const list = findList(context.data(), input.id);
    const todos = todosInList(context.data(), list.id);
    context.setData((data) => ({
      ...data,
      lists: Object.fromEntries(Object.entries(data.lists).filter(([id]) => id !== list.id)),
      todos: Object.fromEntries(Object.entries(data.todos).filter(([, todo]) => todo.listId !== list.id)),
    }));
    return { deleted: list, todos };
  },
  confirmText: ({ input, data }) => `Delete the list "${data.lists[input.id]?.name ?? input.id}" and all its todos?`,
  summarize: ({ output }) => `deleted the list "${output.deleted.name}" and its ${output.todos.length} todo${output.todos.length === 1 ? '' : 's'}`,
  undo: ({ output }) => ({ name: 'list.restore', input: { list: output.deleted, todos: output.todos } }),
});
