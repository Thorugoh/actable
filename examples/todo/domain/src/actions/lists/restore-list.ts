import { ActionError } from '@actable/core';
import { z } from 'zod';
import { defineAction } from '../../kit';
import { ListSchema } from '../../model/list';
import { TodoSchema } from '../../model/todo';

export const restoreList = defineAction({
  name: 'list.restore',
  description: 'Put back a deleted list with its todos (as returned by list.delete).',
  risk: 'write',
  input: z.object({ list: ListSchema, todos: z.array(TodoSchema) }),
  output: ListSchema,
  handler: ({ input, context }) => {
    if (context.data().lists[input.list.id]) throw new ActionError('conflict', `List "${input.list.id}" already exists`);
    context.setData((data) => ({
      ...data,
      lists: { ...data.lists, [input.list.id]: input.list },
      todos: { ...data.todos, ...Object.fromEntries(input.todos.map((todo) => [todo.id, todo])) },
    }));
    return input.list;
  },
  summarize: ({ input }) => `restored the list "${input.list.name}"`,
  undo: ({ output }) => ({ name: 'list.delete', input: { id: output.id } }),
});
