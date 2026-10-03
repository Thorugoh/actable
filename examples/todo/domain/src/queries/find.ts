import { ActionError } from '@actable/core';
import type { List } from '../model/list';
import type { Todo } from '../model/todo';
import type { TodoData } from '../model/todo-data';

export function findTodo(data: TodoData, id: string): Todo {
  const todo = data.todos[id];
  if (!todo) throw new ActionError('not_found', `Todo "${id}" does not exist`);
  return todo;
}

export function findList(data: TodoData, id: string): List {
  const list = data.lists[id];
  if (!list) throw new ActionError('not_found', `List "${id}" does not exist`, { availableLists: Object.keys(data.lists) });
  return list;
}
