# Actable packages

## What it is

A small set of TypeScript packages for building React Native apps that **people and AI agents can both use**. Your app's behavior (data, actions, screens, navigation) lives in one headless runtime. Several clients drive it:

- the React Native UI, through taps
- a CLI, used by developers and coding agents
- the live app on a device, driven through a relay
- (next) MCP tools, for assistants acting on a user's behalf

## Why use it

- **One capability surface.** A tap, a CLI command and an agent call run the same action through the same checks.
- **Fast agent loops.** Everything runs headlessly in Node, so testing a change takes milliseconds, with no simulator.
- **Agents can read the app.** Every screen is a JSON view model, and every action describes itself with a schema.
- **Safe by default.** Destructive agent actions need the user's approval, every change is journaled with who made it, and anything can be undone.
- **Same scripts everywhere.** Scenario files run headlessly in CI and against the live app, unchanged.
- **Small and explicit.** No magic: plain TypeScript, zod schemas and pure functions.

## Packages

| Package | Runs in | Role |
|---|---|---|
| `@actable/core` | anywhere | The runtime. Your app is defined with it |
| `@actable/bridge` | anywhere | Protocol for remote mode (app ⇄ relay ⇄ client) |
| `@actable/node` | Node | File storage, ids, and the relay server |
| `@actable/cli` | Node | A full CLI for your app, from one config object |
| `@actable/react-native` | React Native | Renders the runtime: provider, hooks, navigation, approvals |

### `@actable/core`

Defines and runs an app. It is platform-free.

**Features**
- **`createAppKit<Data, Route>()`** returns typed `defineAction`, `defineScreen` and `defineApp`.
- **Actions:** zod input/output schemas, a risk level (`read`, `nav`, `write`, `destructive`), and optional `summarize`, `confirmText` and `undo`.
- **Dispatch pipeline:** validate → strict UI check → permission/confirmation → execute → journal → emit event. Failures roll back.
- **Screens:** a pure view model plus guards saying which actions the screen offers.
- **Navigation as state:** a route stack owned by the runtime. Screens whose item was deleted close automatically.
- **Journal:** every change is recorded with its origin (`user`, `agent:<id>`, `system`). `describeJournal()` produces an activity feed.
- **Built-in actions:** `nav.push`, `nav.back`, `nav.reset`, `app.inspect`, `journal.list`, `journal.undo`, `state.get`, `state.load`.
- **Policy:** agents need approval for destructive actions, and can optionally be limited to scopes.
- **Structured errors** that agents can act on (`invalid_input` includes the schema).
- **Idempotency keys** make retries safe.
- **Strict UI mode:** only allows what a user could do from the current screen.
- **Scenarios:** JSONL flows with `run` and `expect` steps, `$references`, and delays.
- **Ports and adapters:** `Storage`, `Clock`, `IdGenerator` and `Confirmer`, plus memory, fixed-clock, sequential-id and `withMigration` adapters.

### `@actable/bridge`

Connects a running app to tools outside it. It is platform-free.

**Features**
- **JSON-RPC 2.0 over WebSocket.** The app dials out, so devices need no server socket.
- **`startAppBridge(runtime, options)`** runs inside the app, serves its actions and streams events. It reconnects on its own.
- **`connectRelay(url)`** is the client used by the CLI (and MCP). It provides `dispatch`, `inspect`, `describeActions`, `screenshot`, `devices` and `onEvent`.

### `@actable/node`

Node-side pieces.

**Features**
- **`jsonFileStorage(path)`** saves state as one JSON file, atomically.
- **`randomIds()`**.
- **`startRelay()`**, the relay between clients and apps:
  - picks a device by name or prefix
  - can require a pairing token
  - applies timeouts
  - fails pending calls cleanly when an app disconnects
  - fans events out to subscribers

### `@actable/cli`

Gives any app a complete CLI.

```ts
process.exitCode = await runCli({ name: 'myapp', app: myApp }, process.argv.slice(2), processIO());
```

**Commands**
- `actions` and `describe`: the app's API, with JSON Schemas
- `inspect` and `state`: the current screen and the full state
- `run <action> '<json>'`: dispatch an action
- `run-script <files…>`: replay scenarios (`--delay <ms>` to watch them)
- `serve`: start the relay
- `devices`, `watch` and `screenshot`: work with the live app

**Options on every command**
- `--as agent:<id>`, `--yes`, `--ui-strict`
- `--fixture`, `--data`, `--json`
- `--remote` and `--device`, to target the live app instead of a local runtime
- `--relay` and `--token`

### `@actable/react-native`

Renders the runtime in React Native. The UI holds no logic.

**Features**
- **`<RuntimeProvider app ports fallback>`** starts the runtime on the device.
- **Hooks:**
  - `useViewModel<T>(route)`: what to render
  - `useDispatch(onError?)`: taps, tagged `origin: "user"`
  - `useRuntime()` and `useRuntimeState(selector)`
- **`useNavigationSync(ref)`** syncs React Navigation with the runtime's stack in both directions, including native back gestures.
- **`createConfirmationQueue()`** implements agent approvals for your own sheet UI.
- **`useDevBridge(runtime, { name })`** is remote mode for development builds.
- **`@actable/react-native/expo`** provides `expoSqliteStorage(key)` and `expoRandomIds()`.

## How they work together

```
                        your app's domain  (defineApp: data, actions, screens)
                                  │
                           @actable/core  ──  runtime.dispatch(action, input, { origin })
             ┌────────────────────┼─────────────────────────────┐
             │                    │                             │
 @actable/react-native     @actable/cli (local)          @actable/bridge (app host)
   UI taps → dispatch       run / inspect / scenarios       inside the running app
   view models → screens    in Node, in milliseconds               │  WebSocket
                                                                   ▼
                                                        @actable/node relay  (`serve`)
                                                                   ▲
                                                                   │
                                              @actable/cli --remote,  MCP (next)
```

- **The domain is written once** against `@actable/core` and has no platform code.
- **On the phone,** `@actable/react-native` creates the runtime with Expo ports and renders its view models.
- **In the terminal,** `@actable/cli` creates the same runtime with Node ports (`@actable/node`). It runs in milliseconds and needs no device.
- **In remote mode,** the app's bridge connects to the relay (`serve`). `--remote` sends the same commands to the live app, and the UI updates as they run. If an agent asks for something destructive, the phone shows Approve/Decline.

## Add it to a new React Native app

### 1. Create the app and install

```bash
npx create-expo-app@latest my-app --template blank-typescript
npx expo install @react-navigation/native @react-navigation/native-stack react-native-screens \
  react-native-safe-area-context expo-sqlite expo-crypto
npm install @actable/core @actable/react-native zod
npm install -D @actable/cli tsx
```

The packages aren't published to npm yet. Until they are, add your app to this monorepo as a workspace (with dependencies set to `"*"`), or link them with `npm link`.

### 2. Define the domain

This is pure TypeScript. Keep it in its own folder or package.

```ts
// domain/kit.ts
export const { defineAction, defineScreen, defineApp } = createAppKit<NotesData, NotesRoute>();

// domain/actions/add-note.ts
export const addNote = defineAction({
  name: 'note.add',
  description: 'Add a note.',
  risk: 'write',
  input: z.object({ text: z.string().min(1) }),
  output: NoteSchema,
  handler: ({ input, context }) => {
    const note = { id: context.newId('n_'), text: input.text };
    context.setData((data) => ({ notes: { ...data.notes, [note.id]: note } }));
    return note;
  },
  summarize: ({ input }) => `added "${input.text}"`,
  undo: ({ output }) => ({ name: 'note.remove', input: { id: output.id } }),
});

// domain/screens/home-screen.ts
export const homeScreen = defineScreen({
  route: 'home',
  viewModel: ({ data }) => ({ notes: Object.values(data.notes) }),
  actions: { 'note.add': true },
});

// domain/notes-app.ts
export const notesApp = defineApp({
  name: 'notes',
  dataSchema: NotesDataSchema,
  routeSchema: NotesRouteSchema,
  initialRoute: { name: 'home' },
  initialData: () => ({ notes: {} }),
  actions: [addNote /* … */],
  screens: { home: homeScreen /* one per route */ },
});
```

### 3. Wire the app

```tsx
// runtime/ports.ts: create once, outside render
export const confirmations = createConfirmationQueue();
export const ports = {
  storage: expoSqliteStorage('notes-state-v1'),
  clock: systemClock(),
  ids: expoRandomIds(),
  confirm: confirmations.confirm,
};

// App.tsx
export default function App() {
  return (
    <RuntimeProvider app={notesApp} ports={ports} fallback={<ActivityIndicator />}>
      <Navigator />
      <ConfirmationSheet />            {/* shows confirmations.useCurrentRequest(), calls answer() */}
      {__DEV__ ? <DevBridge /> : null} {/* useDevBridge(useRuntime(), { name: 'ios-sim' }) */}
    </RuntimeProvider>
  );
}

// Navigator.tsx
export function Navigator() {
  const ref = useNavigationContainerRef();
  const { initialState, onStateChange } = useNavigationSync(ref);
  return (
    <NavigationContainer ref={ref} initialState={initialState} onStateChange={onStateChange}>
      <Stack.Navigator>
        <Stack.Screen name="home" component={HomeScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

// HomeScreen.tsx: render and dispatch, nothing else
export function HomeScreen() {
  const { notes } = useViewModel<HomeViewModel>({ name: 'home' });
  const dispatch = useDispatch();
  return <NoteList notes={notes} onAdd={(text) => dispatch('note.add', { text })} />;
}
```

### 4. Add the CLI

```ts
// cli/main.ts
import { processIO, runCli } from '@actable/cli';
import { notesApp } from '../domain/notes-app';

process.exitCode = await runCli({ name: 'notes', app: notesApp }, process.argv.slice(2), processIO());
```

```bash
npx tsx cli/main.ts inspect
npx tsx cli/main.ts run note.add '{"text":"Hello"}'
npx tsx cli/main.ts serve                      # then, with the app running:
npx tsx cli/main.ts --remote inspect
```

### Rules

- **Change state only through actions.** Never navigate with React Navigation directly: dispatch `nav.push` or `nav.back`.
- **Keep display logic in view models,** not in components.
- **Keep the domain free of React Native, Expo and Node imports.**
- **Give every action** a description, and `summarize` (writes), `confirmText` (destructive) and `undo` where possible.

The complete working example is in [`examples/todo`](../examples/todo). A longer walkthrough is in [`docs/adding-to-an-app.md`](../docs/adding-to-an-app.md).
