# Adding the architecture to an app

This guide takes you from nothing to an app that humans, coding agents and user agents can all drive. It has three parts:

1. **A domain package** that holds your app's behavior. It's pure TypeScript and runs anywhere.
2. **A CLI**, built from one config object.
3. **A React Native shell** that renders the domain's screens.

`examples/todo` is the complete reference for every step.

```
my-app/
  domain/     @my/domain   → depends on @actable/core
  cli/        @my/cli      → depends on @actable/cli + @my/domain
  mobile/     @my/mobile   → depends on @actable/react-native + @my/domain
```

## 1. The domain

### Data and routes

Describe what the app stores and which screens exist, as zod schemas:

```ts
// domain/src/model/notes-data.ts
export const NotesDataSchema = z.object({ notes: z.record(z.string(), NoteSchema) });
export type NotesData = z.infer<typeof NotesDataSchema>;

// domain/src/routes.ts
export const NotesRouteSchema = z.discriminatedUnion('name', [
  z.object({ name: z.literal('home') }),
  z.object({ name: z.literal('note'), params: z.object({ noteId: z.string() }) }),
]);
export type NotesRoute = z.infer<typeof NotesRouteSchema>;
```

The runtime keeps navigation and the undo journal itself, so your data holds only your own things.

### The kit

Bind your types once. Every action and screen after that is fully typed:

```ts
// domain/src/kit.ts
export const { defineAction, defineScreen, defineApp } = createAppKit<NotesData, NotesRoute>();
```

### Actions (one per file)

An action is the only way to change state. Taps, the CLI and agents all call it.

```ts
// domain/src/actions/add-note.ts
export const addNote = defineAction({
  name: 'note.add',                                   // namespaced
  description: 'Add a note. Returns the new note.',   // agents read this as the tool description
  risk: 'write',                                      // read | nav | write | destructive
  input: z.object({ text: z.string().trim().min(1) }),// a top-level object (MCP requires it)
  output: NoteSchema,
  handler: ({ input, context }) => {                  // synchronous: validate, then setData once
    const note = { id: context.newId('n_'), text: input.text };
    context.setData((data) => ({ notes: { ...data.notes, [note.id]: note } }));
    return note;
  },
  summarize: ({ input }) => `added "${input.text}"`,  // shown in the activity feed
  undo: ({ output }) => ({ name: 'note.remove', input: { id: output.id } }),
});
```

Rules of thumb:
- Throw `new ActionError('not_found' | 'conflict' | 'forbidden', message)` for expected failures. Agents get the code and the message.
- `destructive` actions need a `confirmText` (`Delete "…"?`). Agents must get a human's approval before they run.
- Anything that can be undone gets an `undo` that names the reverse action.

### Screens (one per file)

A screen is a pure view model plus the actions its UI offers:

```ts
// domain/src/screens/home-screen.ts
function buildHomeViewModel({ data }: ViewModelContext<NotesData, undefined>) {
  return { notes: Object.values(data.notes) };
}
export type HomeViewModel = ReturnType<typeof buildHomeViewModel>;

export const homeScreen = defineScreen({
  route: 'home',
  viewModel: buildHomeViewModel,
  actions: {
    'note.add': true,                                  // the screen always offers it
    'nav.push': ({ input, viewModel }) =>              // or a guard: null = allowed, string = why not
      allowIf(viewModel.notes.some((n) => n.id === input.route.params?.noteId), 'That note is not listed'),
  },
});
```

Declare the view-model builder as a named function and derive its type from it. React components import that type, and it avoids circular types in guards.

The guards drive **strict UI mode** (`--ui-strict`). They also document what each screen can do. Keep them in sync with the buttons.

### The app definition

```ts
// domain/src/notes-app.ts
export const notesApp = defineApp({
  name: 'notes',
  dataSchema: NotesDataSchema,
  routeSchema: NotesRouteSchema,
  initialRoute: { name: 'home' },
  initialData: () => ({ notes: {} }),
  fixtures: { empty: …, demo: … },                     // for tests, demos and `state.load`
  actions: [addNote, removeNote, …],
  screens: { home: homeScreen, note: noteScreen },     // one per route name (type-checked)
  routeExists: (route, data) => route.name !== 'note' || Boolean(data.notes[route.params.noteId]),
});
```

`routeExists` validates `nav.push`, and after a delete it closes screens whose item is gone.

**Built-in actions** you get for free:
- `nav.push`, `nav.back` and `nav.reset`
- `app.inspect`
- `journal.list` and `journal.undo`
- `state.get`, plus `state.load` when you define fixtures

### Test it headlessly

```ts
const runtime = await createRuntime(notesApp, {
  ports: { storage: memoryStorage(), clock: fixedClock(), ids: sequentialIds() },
});
await runtime.dispatch('note.add', { text: 'Hi' }, { origin: 'user' });
expect(runtime.inspect().viewModel).toMatchObject({ notes: [{ text: 'Hi' }] });
```

Write flows as JSONL scenarios (`{"run":…}` / `{"expect":…}`) and run them with `runScenario`. The same files later run against the live app.

Add the domain to the headless lint guardrail in `eslint.config.mjs`, so it can never import React Native or Node.

## 2. The CLI

```ts
// cli/src/main.ts
import { processIO, runCli } from '@actable/cli';
import { notesApp } from '@my/domain';

process.exitCode = await runCli({ name: 'notes', app: notesApp }, process.argv.slice(2), processIO());
```

```js
// cli/bin/notes.js   (package.json: "bin": { "notes": "./bin/notes.js" })
#!/usr/bin/env node
import { register } from 'tsx/esm/api';
register();
await import('../src/main.ts');
```

That's the whole CLI. You get these commands:
- `actions`, `describe`, `inspect`, `state`
- `run`, `run-script`
- `serve`, `devices`, `watch`, `screenshot`

You also get these options on every command:
- `--as agent:<id>`, `--yes`, `--ui-strict`
- `--fixture`, `--data`, `--json`
- `--remote`, `--device`

## 3. The React Native shell

### Ports

Ports are how the runtime reaches the device. Create them once, at module level:

```ts
// mobile/src/runtime/ports.ts
export const confirmations = createConfirmationQueue();
export const ports: Ports = {
  storage: expoSqliteStorage('notes-state-v1'),        // from '@actable/react-native/expo'
  clock: systemClock(),
  ids: expoRandomIds(),
  confirm: confirmations.confirm,                      // agents' destructive actions ask the user
};
```

If you change your data's shape later, wrap the storage in `withMigration(storage, migrate)` so users keep their data. See `examples/todo/mobile/src/runtime/migrate-stored-state.ts`.

### Root

```tsx
export function App() {
  return (
    <RuntimeProvider app={notesApp} ports={ports} fallback={<Loading />}>
      <Navigator />
      <ConfirmationSheet />            {/* renders confirmations.useCurrentRequest() */}
      {__DEV__ ? <DevBridge /> : null} {/* useDevBridge(useRuntime(), { name: 'ios-sim' }) */}
    </RuntimeProvider>
  );
}
```

### Navigation

The runtime owns the stack, and React Navigation renders it:

```tsx
export function Navigator() {
  const ref = useNavigationContainerRef();
  const { initialState, onStateChange } = useNavigationSync(ref);
  return (
    <NavigationContainer ref={ref} initialState={initialState} onStateChange={onStateChange}>
      <Stack.Navigator>
        <Stack.Screen name="home" component={HomeScreen} />
        <Stack.Screen name="note" component={NoteScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
```

Never call `navigation.navigate` directly. Dispatch `nav.push` or `nav.back`, so agents, the CLI and taps all move through the same stack. Native back gestures are synced back into the runtime automatically.

### Screens

Screens only render and dispatch:

```tsx
export function HomeScreen() {
  const viewModel = useViewModel<HomeViewModel>({ name: 'home' });
  const dispatch = useDispatch((failure) => Alert.alert('Could not do that', failure.message));
  return (
    <FlashList
      data={viewModel.notes}
      renderItem={({ item }) => (
        <Row title={item.text} onPress={() => dispatch('nav.push', { route: { name: 'note', params: { noteId: item.id } } })} />
      )}
    />
  );
}
```

If you find yourself computing something in a component, move it into the view model.

## 4. Remote mode

With the dev bridge mounted, run `notes serve` in one terminal and the app in the simulator. Then:

```bash
notes --remote inspect
notes --remote --as agent:claude run note.remove '{"id":"n_1"}'   # the phone shows Approve/Decline
notes --remote run-script scenarios/happy-path.jsonl --delay 1000
notes watch
```

For physical devices, run `notes serve --host 0.0.0.0 --token <secret>`. Then set `EXPO_PUBLIC_ACTABLE_RELAY_URL` and `EXPO_PUBLIC_ACTABLE_RELAY_TOKEN` in the app.

## Checklist

- [ ] Domain has no React Native, Expo or Node imports (lint guardrail)
- [ ] Every action has a description, object input schema, risk, `summarize` (writes) and `confirmText` (destructive)
- [ ] Every screen declares its actions/guards, matching the buttons in the UI
- [ ] Scenarios cover every action (see `examples/todo/domain/test/todo-scenarios.test.ts`)
- [ ] The main user flow passes in strict UI mode
- [ ] Components use `useViewModel` and `useDispatch` only, and never navigate directly
