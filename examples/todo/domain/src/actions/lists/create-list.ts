import { ActionError } from '@actable/core';
import { z } from 'zod';
import { defineAction } from '../../kit';
import { ListSchema, type List } from '../../model/list';

export const createList = defineAction({
  name: 'list.create',
  description: 'Create a new todo list.',
  risk: 'write',
  input: z.object({ name: z.string().trim().min(1).max(80) }),
  output: ListSchema,
  handler: ({ input, context }) => {
    const nameTaken = Object.values(context.data().lists).some((list) => list.name.toLowerCase() === input.name.toLowerCase());
    if (nameTaken) throw new ActionError('conflict', `A list named "${input.name}" already exists`);
    const list: List = { id: context.newId('l_'), name: input.name, createdAt: context.now() };
    context.setData((data) => ({ ...data, lists: { ...data.lists, [list.id]: list } }));
    return list;
  },
  summarize: ({ input }) => `created the list "${input.name}"`,
  undo: ({ output }) => ({ name: 'list.delete', input: { id: output.id } }),
});
