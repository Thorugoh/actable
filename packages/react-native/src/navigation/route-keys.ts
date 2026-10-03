import { routeParams, sameRoute, type AnyRoute } from '@actable/core';

/**
 * React Navigation needs a unique key per route *visit* (it remembers the keys of dismissed
 * screens), while runtime routes are plain data. Routes in the unchanged part of the stack keep
 * their keys; anything pushed or replaced gets a new one.
 */
export type NativeRoute = { key: string; name: string; params?: object };

let visitCounter = 0;

export function createRouteKeys(initialStack: AnyRoute[]) {
  let stack: AnyRoute[] = [];
  let keys: string[] = [];

  function update(nextStack: AnyRoute[]): NativeRoute[] {
    let unchanged = true;
    keys = nextStack.map((route, index) => {
      unchanged = unchanged && index < stack.length && sameRoute(stack[index]!, route);
      return unchanged ? keys[index]! : `${route.name}-${++visitCounter}`;
    });
    stack = nextStack;
    return current();
  }

  function current(): NativeRoute[] {
    return stack.map((route, index) => ({ key: keys[index]!, name: route.name, params: routeParams(route) as object | undefined }));
  }

  update(initialStack);
  return { update, current };
}

export function sameKeys(a: { key?: string }[], b: { key?: string }[]): boolean {
  return a.length === b.length && a.every((route, index) => route.key === b[index]?.key);
}
