import { createAppKit } from '@actable/core';
import type { TodoData } from './model/todo-data';
import type { TodoRoute } from './routes';

/** Typed helpers for defining the todo app's actions, screens and app definition. */
export const { defineAction, defineScreen, defineApp } = createAppKit<TodoData, TodoRoute>();
