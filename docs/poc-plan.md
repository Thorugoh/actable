# Todo App POC — Plan

> Goal: prove that **one capability surface** lets a human (touch UI), a coding
> agent (CLI, headless or remote) and a user's agent (MCP) all operate the
> same React Native app, with every change visible, auditable and undoable.
> Architecture: [`architecture-proposal.md`](./architecture-proposal.md)

## 1. Scope

### Features (deliberately small)
- Lists: `Inbox` plus user-created lists
- Todos: create, rename, toggle done, set due date, delete, restore
- Filter: all / open / done
- Activity screen: journal of actions with origin (`user`, `agent:*`) and **Undo**

### Actions (the entire public API of the app)

| Action | Risk | Notes |
|---|---|---|
| `list.list` | read | |
| `list.create` | write | |
| `todo.list` | read | `{ listId, filter? }` |
| `todo.create` | write | supports `idempotencyKey` |
| `todo.update` | write | title, due |
| `todo.toggle` | write | |
| `todo.delete` | destructive | confirmation for `agent:*` |
| `todo.restore` | write | inverse of delete |
| `ui.setFilter` | read-ish (UI) | |
| `nav.push` / `nav.back` / `nav.reset` | nav | |
| `journal.list` / `journal.undo` | read / write | |
| `app.inspect` | read | route + current view model |

### Screens
`ListsScreen` → `ListScreen` → `TodoScreen`, plus `ActivityScreen` and a
`ConfirmSheet` (the modal used when an agent requests a destructive action).

### Out of scope
Auth, backend sync, OS intents (Siri / App Actions), and the in-app LLM chat
(it is a stretch goal, M6).

## 2. Stack

| Concern | Choice | Why |
|---|---|---|
| Monorepo | npm workspaces (Turborepo later if needed) | no extra tooling to install |
| App | Expo (dev client) + Expo Router | fast setup; the router is driven by `NavSync` |
| Core store | `zustand/vanilla` | framework-free and tiny; React bindings only in the app |
| Schemas | zod + `zod-to-json-schema` | one source for validation, CLI help and MCP tools |
| RN storage | `expo-sqlite` (KV table holding the snapshot) | |
| Node storage | memory + JSON file | shared file lets the CLI and MCP see the same data |
| Lists | FlashList | |
| CLI | `commander` + JSON-RPC over `ws` | |
| MCP | `@modelcontextprotocol/sdk` (stdio) | works with Claude Desktop / Claude Code |
| Tests | Vitest (core), RNTL (components) | |

## 3. Milestones

Each milestone ends with a demo command that anyone (human or agent) can run.

### M0: Skeleton (0.5 day)
- Monorepo, TS project refs, lint rule banning RN imports in `packages/core`.
- `AGENTS.md` stub covering repo map, commands and the "headless first" rule.
- ✅ `npm run lint && npm run typecheck` passes.

### M1: Headless core (1.5 days)
- Domain (`Todo`, `List`), store, `defineAction`, middleware (validate → policy → exec → journal), ports.
- Nav reducer and `defineScreen` view models for the three screens.
- Deterministic `Clock` / `IdGen` for tests.
- ✅ `npm run test:core` runs 20+ tests in under 1s. No simulator involved.

### M2: CLI local mode (1 day)
- `todo inspect | run <action> <json> | actions | run-script <file.jsonl>`, plus `--json` and `--fixture`.
- Scenario runner with `$last` refs and `expect` steps. `scenarios/*.jsonl` run in CI.
- ✅ `todo run-script scenarios/happy-path.jsonl` passes. An agent can build a feature using only the CLI.

### M3: Mobile shell (2 days)
- Expo app: `useViewModel`, `useDispatch`, renderers for the three screens and Activity.
- `NavSync` (core nav → Expo Router; native back → `nav.back`).
- `expo-sqlite` storage adapter.
- ✅ A human can use the app normally, and every tap appears in the Activity screen as `origin: user`.

### M4: Remote mode (1.5 days)
- `packages/bridge`: JSON-RPC types, relay server (`todo serve`) and app client (dev only, pairing token).
- The CLI's `--remote` (plus `--device <name>` when several apps are connected) sends the same commands to the running app. `events.subscribe` streams changes.
- `dev.screenshot` via `react-native-view-shot`.
- ✅ `todo --remote run-script scenarios/happy-path.jsonl` runs **the same scenario** on the simulator. The UI updates live and a screenshot is saved.

### M5: User agents via MCP (1.5 days)
- `@actable/mcp` (plus a thin `examples/todo/mcp`): tools generated from the registry. Two modes: `--local` (shared JSON file) and `--remote` (bridge to the phone).
- Policy: `origin: agent:mcp`. `todo.delete` either triggers a `ConfirmSheet` on the device (remote) or returns `confirmation_required` (local).
- ✅ **Headline demo:**
  1. The app is open on the simulator and the MCP server is connected in remote mode.
  2. The user tells Claude: *"Add 'buy milk' and 'call mom' to my inbox, and clear everything I finished."*
  3. The todos appear live. The delete opens a confirmation sheet on the phone, and the user taps Approve.
  4. The Activity screen shows each step as "Claude …", and one tap on Undo reverts it.

### M6 (stretch): In-app assistant (2 days)
- A chat screen calls the Claude API with registry tools (filtered to `read`/`write`). Tool calls dispatch with `origin: agent:assistant`.
- ✅ The same headline demo works entirely inside the app.

**Total: about 8 working days (M0–M5), plus 2 for the stretch goal.**

## 4. Key code shapes to build first

```ts
// packages/core/src/actions/define.ts
export function defineAction<I extends z.ZodTypeAny, O extends z.ZodTypeAny>(a: {
  name: string; description: string; input: I; output: O;
  risk: 'read' | 'write' | 'destructive' | 'nav';
  inverse?: (x: { input: z.infer<I>; before: AppState }) => { name: string; input: unknown };
  handler: (x: { input: z.infer<I>; ctx: Ctx }) => z.infer<O> | Promise<z.infer<O>>;
}) { return a; }

// packages/core/src/app.ts: identical in Node, RN, CLI, MCP
export function createApp(ports: Ports) {
  const store = createStore(ports);
  const registry = createRegistry(allActions);
  return {
    dispatch: (name: string, input: unknown, meta: { origin: Origin; idempotencyKey?: string }) =>
      registry.run(name, input, { store, ports, ...meta }),
    inspect: () => inspectCurrentScreen(store.getState()),
    subscribe: store.subscribe,
    actions: registry.describe(),         // → MCP tools / CLI help / AGENTS.md
  };
}
```

```ts
// packages/mcp/src/… (sketch)
for (const a of app.actions) {
  server.registerTool(a.name, { description: a.description, inputSchema: a.inputShape },
    async (input) => toMcpResult(await target.dispatch(a.name, input, { origin: 'agent:mcp' })));
}
```

## 5. Success criteria

| Criterion | Measure |
|---|---|
| Headless parity | 100% of actions are covered by scenarios that run in Node |
| Same scenario, both modes | `happy-path.jsonl` passes locally and against the simulator with no changes |
| Agent iteration speed | Headless scenario run under 1s, vs. more than 30s for a simulator E2E equivalent |
| No UI coupling | Lint proves `packages/core` has zero RN imports |
| Safe user agents | Destructive agent actions always need confirmation; every agent action can be undone from Activity |
| Agent-built feature | Add one feature (e.g. "due-date reminders") where the agent works only through the CLI and tests, then a human reviews it |

## 6. Suggested build order for an agent

1. Read `AGENTS.md` and this plan.
2. Build M0 and M1, keeping `npm run test:core` green after each action is added.
3. Build M2 and write `scenarios/happy-path.jsonl` before any UI.
4. Build M3, then check the UI by eye.
5. Build M4 and re-run the same scenario remotely.
6. Build M5 and record the headline demo.
