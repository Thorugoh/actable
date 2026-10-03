# Agent-Addressable React Native Architecture — Proposal

> Status: implemented (M0–M4) · 2026-09-24
> Inspired by: Shopify Engineering, *"Back to native"* (2026-09-10)
>
> This is the original proposal. The implementation became reusable packages:
> - `@actable/core`, `bridge`, `node`, `cli` and `react-native` in `packages/`
> - the todo app as an example in `examples/todo/`
>
> See [`README.md`](../README.md) and [`adding-to-an-app.md`](adding-to-an-app.md). Code samples below follow the implemented API.

## 1. What we are borrowing from Shopify (and what we are not)

Shopify moved from React Native back to Swift/Kotlin because coding agents made
maintaining two native codebases cheap. That language decision is **not** what
this proposal copies. What we copy is the architecture that made agents
effective:

| Shopify principle | What it means for us |
|---|---|
| *"Business logic should be completely decoupled from the UI and be able to run headlessly on desktop."* | All state, rules and navigation live in a plain TypeScript package with zero `react-native` imports. It runs in Node. |
| Agents can *"inspect the state of the app, navigate between different sections, and perform actions all without needing to touch the UI"* | Every capability is a typed, named **action**. Navigation is data. Screens expose a **view model** that can be read as JSON. |
| A CLI that iterates *"in milliseconds instead of minutes without involving simulators"* | `todo` CLI runs the core headlessly in Node. |
| A **remote mode** where the CLI drives the app on a simulator *"without having to inspect the layout or the accessibility tree"* | A dev-only WebSocket bridge inside the app. The same CLI commands run against the live app, and the UI updates on its own. |
| Helix: small checkpoints, tests + visual review + adversarial review + a human's approval | Our agent dev loop: each change ships with headless tests, a remote-mode screenshot and a review gate (§8). |

We add one goal that Shopify's post doesn't cover: **agents as end users**, not
only as developers. The action layer that lets a coding agent test the app is the
same layer that lets an assistant (Claude via MCP, an in-app chat, Siri/App
Intents) *use* the app for a person. That means one capability surface with
three kinds of consumer:

```
            ┌──────────────── one capability surface ────────────────┐
 humans  →  │  UI taps  ─┐                                           │
 dev agents → CLI / remote ─┼─►  Action Registry  ─►  Core (headless)  │
 user agents → MCP / in-app / OS intents ─┘                            │
            └────────────────────────────────────────────────────────┘
```

## 2. Design principles

1. **Headless first.** If a behavior can't be exercised from Node, it doesn't exist yet.
2. **Actions are the only way to change state.** The UI, CLI, MCP and tests all call `dispatch(action, input)`. Nothing calls the store directly.
3. **Navigation is state.** The router renders `core.nav`; it doesn't own it.
4. **Screens are projections.** Each screen has a pure `viewModel(state)`. The React component only renders it. Agents read the same view model.
5. **Self-describing.** Every action has a name, a description, zod input/output schemas and a risk level. Tool definitions for LLMs are generated from these, never written by hand.
6. **Every call records its origin.** Each dispatch carries `origin: user | agent:<id> | system`. That gives us audit, undo and permission checks for free.
7. **Platform code sits behind ports.** Storage, clock, IDs, notifications and haptics are interfaces. The Node and RN adapters are small and swappable.

## 3. Layered architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│ SHELLS (thin)                                                        │
│  todo/mobile (Expo RN)   todo/cli (Node)   mcp (Node, M5)            │
│  - renders view models   - REPL + --json   - MCP tools from registry │
│  - taps → dispatch       - local | remote  - local | remote          │
│  - dev bridge (WS)                                                   │
├──────────────────────────────────────────────────────────────────────┤
│ CAPABILITY LAYER  packages/core/actions                              │
│  Action Registry: name, description, input/output schema, risk,      │
│  handler. Middleware: validation → policy → confirm → exec → log     │
├──────────────────────────────────────────────────────────────────────┤
│ CORE  packages/core  (pure TS, no RN imports, runs in Node)          │
│  domain/   entities + rules (Todo, List)                             │
│  store/    state container + selectors (vanilla, framework-free)     │
│  nav/      route stack as data + navigation reducer                  │
│  screens/  viewModel(state) per screen                               │
│  ports/    Storage, Clock, IdGen, Notifier                           │
├──────────────────────────────────────────────────────────────────────┤
│ ADAPTERS                                                             │
│  adapters-node: memory / node:sqlite / JSON file                     │
│  adapters-rn:   expo-sqlite / MMKV, expo-notifications               │
└──────────────────────────────────────────────────────────────────────┘
```

### 3.1 Core: domain + store

- Pure TypeScript. The store is a small framework-free container, for example `zustand/vanilla` or a hand-rolled `subscribe/getState`. React bindings exist only in the mobile shell.
- The state is serializable. The whole app state can be dumped, snapshotted or restored as JSON. Agents rely on this, and so do fixtures.

```ts
// @actable/core: runtime/runtime-state.ts (app data + navigation + journal)
export type AppState = {
  todos: Record<TodoId, Todo>;
  lists: Record<ListId, List>;
  nav: NavState;            // { stack: Route[] }
  ui: { filter: 'all' | 'open' | 'done' };
};
```

### 3.2 Navigation as data

```ts
// examples/todo/domain/src/routes.ts
export type Route =
  | { name: 'lists' }
  | { name: 'list'; params: { listId: ListId } }
  | { name: 'todo'; params: { todoId: TodoId } };
```

`nav.push`, `nav.back` and `nav.reset` are ordinary actions. In the mobile shell,
a small `NavSync` component maps `state.nav.stack` onto Expo Router or React
Navigation, and sends native back gestures back as `nav.back`. An agent can move
to any screen, and read where it is, without touching layout.

### 3.3 Screens as view models

```ts
// examples/todo/domain/src/screens/list-screen.ts
export const listScreen = defineScreen({
  route: 'list',
  viewModel: (s, { listId }) => ({
    title: s.lists[listId].name,
    filter: s.ui.filter,
    items: selectTodos(s, listId).map(t => ({ id: t.id, title: t.title, done: t.done, due: t.due })),
    availableActions: ['todo.create', 'todo.toggle', 'todo.delete', 'ui.setFilter'],
  }),
});
```

The React screen is a pure renderer:

```tsx
// examples/todo/mobile/src/screens/list/ListScreen.tsx
export function ListScreen({ listId }: Props) {
  const vm = useViewModel(listScreen, { listId });
  const dispatch = useDispatch();
  return (
    <FlashList
      data={vm.items}
      renderItem={({ item }) => (
        <TodoRow {...item} onToggle={() => dispatch('todo.toggle', { id: item.id })} />
      )}
    />
  );
}
```

`app.inspect` returns `{ route, viewModel }` for the current screen. To an
agent this is the equivalent of a screenshot, but structured, exact and
milliseconds to produce.

### 3.4 Capability layer: the Action Registry

```ts
// examples/todo/domain/src/actions/todos/create-todo.ts
export const createTodo = defineAction({
  name: 'todo.create',
  description: 'Create a todo in a list (the Inbox by default). Returns the new todo.',
  risk: 'write',                         // 'read' | 'nav' | 'write' | 'destructive'
  input: z.object({ listId: z.string().default(INBOX_ID), title: TodoTitleSchema, due: DueDateSchema.optional() }),
  output: TodoSchema,
  handler: ({ input, context }) => {
    findList(context.data(), input.listId);
    const todo = { id: context.newId('t_'), listId: input.listId, title: input.title, done: false, … };
    context.setData(saveTodo(todo));
    return todo;
  },
  summarize: ({ input }) => `added "${input.title}"`,
  undo: ({ output }) => ({ name: 'todo.delete', input: { id: output.id } }),
});

// examples/todo/domain/src/actions/todos/delete-todo.ts
export const deleteTodo = defineAction({
  name: 'todo.delete',
  risk: 'destructive',                   // agent callers need confirmation
  confirmText: ({ input, data }) => `Delete "${data.todos[input.id]?.title}"?`,
  undo: ({ output }) => ({ name: 'todo.restore', input: { todo: output.deleted } }),
  …
});
```

Every dispatch goes through the same middleware pipeline:

```
dispatch(name, input, { origin })
  → validate (zod)          reject bad input with a structured error an LLM can fix
  → policy(origin, risk)    e.g. agent:* + destructive → requires confirmation
  → confirm                 UI: bottom sheet · CLI: --yes · MCP: elicitation / error
  → execute handler
  → journal                 { id, name, input, origin, before/after digest, ts }
  → notify subscribers      UI re-renders, WS clients receive `state.changed`
```

From the registry we generate:
- **MCP tools**: `actions.map(a => ({ name, description, inputSchema: zodToJsonSchema(a.input) }))`
- **CLI commands**: `todo todo.create --listId inbox --title "Buy milk"`
- **In-app assistant tools**: the same list, filtered by policy
- **Docs** for `AGENTS.md`: a generated table of actions

### 3.5 Ports and adapters

```ts
export interface Storage { load(): Promise<Snapshot | null>; save(s: Snapshot): Promise<void>; }
export interface Clock   { now(): Date }
export interface IdGen   { next(): string }
```

| Port | Node (CLI / tests) | React Native |
|---|---|---|
| Storage | memory · JSON file · `node:sqlite` | `expo-sqlite` or MMKV |
| Clock | fake clock (tests) / system | system |
| IdGen | deterministic seed (tests) / uuid | uuid |
| Notifier | console log | `expo-notifications` |

Deterministic clock and IDs make headless runs reproducible. Agents can diff two
runs of the same scenario.

## 4. The three ways to reach the app

### 4.1 Local headless mode (CLI in Node)

```bash
$ todo run state.load '{"fixture":"demo"}'          # state lives in .todo/state.json
$ todo run todo.create '{"listId":"inbox","title":"Buy milk"}'
$ todo run nav.push '{"route":{"name":"list","params":{"listId":"inbox"}}}'
$ todo --json inspect | jq '.value.viewModel.items | length'
4
$ todo --fixture demo inspect                       # ephemeral, in memory, nothing saved
```

The CLI also takes a script, `todo run-script scenario.jsonl`, so an agent can
replay a whole flow and assert on the result. This is the mode agents use for
most of their iteration.

### 4.2 Remote mode (CLI → running app)

In dev builds only (`__DEV__` or a debug flag), the app starts a **Dev Bridge**:
a WebSocket client that connects to a relay the CLI starts (`todo serve`), so it
works from simulators, emulators and devices on the LAN.

Protocol: JSON-RPC 2.0.

| Method | Served by | Purpose |
|---|---|---|
| `actions.list` | app | Registry metadata and JSON schemas |
| `actions.invoke` | app | `{ name, input, meta: { origin, confirmed?, interactive? } }` → `DispatchResult` |
| `app.inspect` | app | Current route, available actions and view model |
| `dev.screenshot` | app | Base64 PNG via `react-native-view-shot` |
| `relay.devices` | relay | Connected apps |
| `events.subscribe` | relay | Stream `dispatch` (every action, including taps), `nav` and `device` events |

State dumps and fixtures don't need extra methods: they are ordinary actions (`state.get`, `state.load`).

```bash
$ todo serve                                   # terminal 1: the relay
$ todo --remote --as agent:claude run todo.create '{"title":"From agent"}'
# the row appears in the simulator immediately; no taps, no accessibility tree
$ todo --remote --as agent:claude run todo.delete '{"id":"t_…"}'
# the phone shows "Claude wants to: Delete …?" and the CLI waits for Approve / Decline
$ todo watch                                   # live feed of everything that happens in the app
```

Scenarios always dispatch with `interactive: false`, so they never block on a confirmation
sheet and behave identically headless and against a live app.

Because remote mode runs the **same actions**, anything proven headlessly can
be checked on a real device with the same command.

### 4.3 End-user agents

The same registry, exposed to agents acting **for the user**:

| Channel | How it works | POC? |
|---|---|---|
| **MCP server** (`@actable/mcp`, M5) | Serves registry actions as MCP tools. Runs locally (headless, on the same storage) or in remote mode against the phone. Later, as a hosted server against a sync backend. | ✅ |
| **In-app assistant** | A chat screen. The LLM gets registry tools filtered by policy, and each tool call goes through `dispatch(..., { origin: 'agent:assistant' })`. The user watches the UI change live. | stretch |
| **OS intents** (Siri App Intents / Android App Actions) | A native module maps a curated subset (`todo.create`, `todo.list`) to intents that call into the JS registry. | later |

**Rules for user-facing agents:**
- `read` runs freely. `write` runs and can be undone. `destructive` needs explicit user confirmation in the app, or an MCP elicitation.
- Every agent action is journaled with its origin and shows in an **Activity** screen: "Claude added 'Buy milk' · Undo".
- Idempotency: agents may pass `idempotencyKey` so retries don't create duplicates.
- Scopes per agent (`agent:claude` may use `todo.*` but not `settings.*`).

## 5. Monorepo layout

```
packages/                 # the architecture; reusable, knows nothing about todos
├─ core/                  # @actable/core: runtime, dispatch pipeline, screens, navigation, journal, scenarios
├─ bridge/                # @actable/bridge: remote-mode protocol, app host + client (platform-free)
├─ node/                  # @actable/node: file storage, ids, relay server
├─ cli/                   # @actable/cli: runCli({ name, app }) gives any app its CLI
└─ react-native/          # @actable/react-native: provider, hooks, navigation sync, confirmations, dev bridge
examples/todo/            # the POC built on it
├─ domain/                # @todo/domain: data, actions, screens, fixtures (pure TS)
├─ cli/                   # @todo/cli: the `todo` binary (one config object)
├─ mobile/                # @todo/mobile: the Expo app
└─ scenarios/             # .jsonl flows shared by tests, the CLI and agents
```

Guardrails, enforced in CI:
- `eslint no-restricted-imports`: `core`, `bridge` and the todo domain can't import React, React Native, Expo or Node.
- Core and domain tests run under Vitest in Node, with no simulator. Framework tests use tiny test apps, never the todo app.
- Registry checks: every action is self-describing (object schemas), and together the scenarios use every action.

## 6. Testing pyramid (agent-friendly)

| Layer | Tool | Speed | Written by |
|---|---|---|---|
| Domain and action unit tests | Vitest | ms | agent + human |
| Scenario tests (`scenarios/*.jsonl` replayed headlessly, then assert on view models) | Vitest + CLI runner | ms | agent |
| View-model snapshots per screen | Vitest | ms | agent |
| Component render tests | React Native Testing Library | s | agent |
| Remote-mode smoke (same scenarios, run against the simulator) | CLI `--remote` | s | CI |
| Visual review (screenshots from `dev.screenshot`) | human / vision model | min | review gate |

A scenario file is the shared language between humans, agents and CI:

```jsonl
{"run":"state.load","input":{"fixture":"empty"}}
{"run":"todo.create","input":{"listId":"inbox","title":"Buy milk"}}
{"run":"todo.toggle","input":{"id":"$last.id"}}
{"expect":"app.inspect","path":"viewModel.items[0].done","equals":true}
```

## 7. Trade-offs and risks

| Risk | Mitigation |
|---|---|
| Duplicate state (router state vs. core nav) | Core is the only source of truth. `NavSync` is one-way, and native gestures dispatch `nav.back`. |
| View-model layer is more boilerplate than hooks-in-components | Generate `defineScreen` scaffolds. The payoff is testability and agent access. |
| Dev bridge leaks into production | It is compiled out with `__DEV__`, the release build checks that the module is absent, and it needs a pairing token. |
| Agents doing harmful things for users | Risk levels, per-agent scopes, confirmation, journal and undo (§4.3). |
| Animations and gestures aren't covered by headless tests | Remote-mode screenshots and component tests cover the gap. Visual review stays in the gate. |
| Perf: global store causing re-renders | Selector-based subscriptions (`useSyncExternalStore` + shallow equality) per view model. |

## 8. Agent development loop (our "mini-Helix")

For each feature, an agent works in checkpoints. A checkpoint moves on only when:

1. **Plan:** the feature is split into small ordered slices, each named by the actions and screens it touches.
2. **Headless proof:** actions, view models and scenarios are written first, and `npm run test:core` is green.
3. **UI:** the renderer is wired to the view model, and `todo --remote run-script` passes.
4. **Visual check:** screenshots are attached to the PR.
5. **Review:** at least one adversarial agent reviewer (and, optionally, a second model), then a human's approval.
6. **Memory:** review feedback is added to `AGENTS.md` so the next loop is more autonomous.

See [`poc-plan.md`](./poc-plan.md) for the todo-app POC that proves this out.
