import { ActionError } from '@actable/core';
import { z } from 'zod';
import { defineAction } from '../../kit';
import { TodoSchema } from '../../model/todo';
import { findList } from '../../queries/find';
import { saveTodo } from './save-todo';

export const restoreTodo = defineAction({
  name: 'todo.restore',
  description: 'Put back a deleted todo (as returned by todo.delete).',
  risk: 'write',
  input: z.object({ todo: TodoSchema }),
  output: TodoSchema,
  handler: ({ input, context }) => {
    if (context.data().todos[input.todo.id]) throw new ActionError('conflict', `Todo "${input.todo.id}" already exists`);
    findList(context.data(), input.todo.listId);
    context.setData(saveTodo(input.todo));
    return input.todo;
  },
  summarize: ({ input }) => `restored "${input.todo.title}"`,
  undo: ({ output }) => ({ name: 'todo.delete', input: { id: output.id } }),
});
