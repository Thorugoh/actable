# AGENTS.md

How to work in this repo, whether you're a coding agent or a human.
- **Overview:** [`README.md`](README.md)
- **Building an app on the packages:** [`docs/adding-to-an-app.md`](docs/adding-to-an-app.md)

## The one rule: headless first

All behavior lives in platform-free TypeScript that runs in Node. If you can't exercise something with the CLI or a Vitest test, it doesn't exist yet. React Native code only renders view models and dispatches actions.

Lint enforces this. These packages can't import React, React Native, Expo or Node built-ins:
- `packages/core`
- `packages/bridge`
- `examples/todo/domain`

## Repo map

| Path | What |
|---|---|
| `packages/core` | `@actable/core`, the runtime. `runtime/` (createRuntime, app definition, persistence), `dispatch/` (pipeline and its `steps/`), `actions/`, `screens/`, `navigation/`, `journal/`, `built-in-actions/`, `scenarios/`, `adapters/` |
| `packages/bridge` | `@actable/bridge`. Remote-mode protocol, app host and client (platform-free) |
| `packages/node` | `@actable/node`. File storage, random ids, and the relay server |
| `packages/cli` | `@actable/cli`. `runCli(config)`: one file per command in `commands/`, local/remote `targets/` |
| `packages/react-native` | `@actable/react-native`. `RuntimeProvider`, hooks, `useNavigationSync`, confirmation queue, dev bridge; Expo adapters at `/expo` |
| `examples/todo/domain` | `@todo/domain`. Todo data (`model/`), `routes.ts`, `actions/` (one per file), `screens/`, `fixtures.ts`, `todo-app.ts` |
| `examples/todo/cli` | `@todo/cli`. The `todo` binary: `todo-cli.ts` is its whole config |
| `examples/todo/mobile` | `@todo/mobile`. The Expo app. See `examples/todo/mobile/AGENTS.md` |
| `examples/todo/scenarios` | JSONL flows, run by tests, the CLI and against the live app |

Dependencies point one way: examples → packages. Packages never import an example.

## Commands

```bash
npm run check                          # lint + typecheck (root, RN package, mobile) + all tests; run before every commit
npx vitest run --project core          # one project: core | node | todo
npx todo actions [--json]              # every action (with JSON Schemas when --json)
npx todo describe todo.create          # one action's schemas
npx todo inspect                       # current screen: route, actions, view model
npx todo run <action> '<json>'         # dispatch; state lives in .todo/state.json
npx todo --fixture demo <command>      # in memory from a fixture, nothing saved
npx todo --as agent:<id> run …         # act as an agent (destructive actions need --yes)
npx todo --ui-strict <command>         # only what a user could do from the current screen
npx todo run-script examples/todo/scenarios/*.jsonl   # replay scenarios (in memory unless --data)

# Remote mode: the live app in the simulator (npm run ios)
npx todo serve                         # the relay (keep it running)
npx todo --remote <command>            # inspect, run, run-script …; the UI updates live
npx todo --remote run-script <file> --delay 1500      # pause between actions to watch them
npx todo devices | watch | screenshot <file.png>
```

`--json` prints one `{ ok, value | error }` document. Errors carry a `code`:
- `invalid_input` (includes the input schema)
- `not_found`, `conflict`, `forbidden`
- `not_on_screen`
- `confirmation_required`, `confirmation_denied`

Remote `run-script` starts with `state.load`, which **replaces the app's data**. Avoid it on a simulator whose data someone cares about.

## Adding a feature (checkpoint loop)

1. **Plan** small slices, each named by the actions and screens it touches.
2. **Actions first.** Add `examples/todo/domain/src/actions/<area>/<verb>-<noun>.ts` with `defineAction` from `../kit`. Every action needs:
   - a clear `description` (agents read it)
   - an object `input` schema and an `output` schema
   - a `risk`
   - `summarize` (writes), `confirmText` (destructive), and `undo` when it can be reversed
   - a synchronous handler that validates first (throws `ActionError`), then calls `setData` once

   Register it in `actions/index.ts`.
3. **View model and guards.** Update the screen in `screens/`. Never compute display data in React. The screen's `actions` map says what its UI offers (`true`, or a guard that returns why not). Keep it in sync with the buttons.
4. **Scenario.** Add or extend a file in `examples/todo/scenarios/`. A test fails if any action is missing from every scenario.
5. **Green.** Run `npm run check`.
6. **UI.** Render the view model and dispatch the action in `examples/todo/mobile`. No logic.
7. **Commit** one checkpoint at a time.

Changing the **framework** (`packages/*`) follows the same loop. Test with the tiny apps in `packages/core/test/support/notes-app.ts` and `packages/node/test/support/counter-app.ts`, never with the todo app.

## Code style

- **One concept per file,** named after it (`create-todo.ts`, `check-permission.ts`, `TodoRow.tsx`). Aim to keep files under ~100 lines.
- **Descriptive names:** `viewModel`, `context`, `theme`, `result`, not `vm`, `ctx`, `t`, `res`.
- **Object arguments** for functions with more than two parameters (`summarize({ input, output, before })`).
- **Pure functions** for state changes (`saveTodo(todo)(data)`, `pushRoute(stack, route)`). Side effects only at the edges (ports).
- **Comments explain why, not what.**

## Conventions and lessons learned

- **Tool input schemas must be objects at the top level** (MCP requires it). Wrap unions, as in `nav.push { route }`.
- **Sorting must be stable,** with ties keeping insertion order. Don't tie-break on random ids.
- **`origin`, `confirmed`, `interactive` and `uiStrict` come from the shell** (a CLI flag, the UI, the MCP host), never from an agent's tool input.
- **Scripts never wait on a human.** Scenario steps dispatch with `interactive: false`, so they get `confirmation_required` instead of a sheet on the device.
- **Strict UI mode rejects anything the current screen doesn't offer** with `not_on_screen`. Reads and `harness` actions (`state.load`, `nav.reset`) are exempt. `happy-path.jsonl` must keep passing in strict mode.
- **The runtime's navigation stack is the source of truth.** React Navigation route keys are minted per visit (`@actable/react-native/navigation/route-keys.ts`), and resets keep the navigator key.
- **`--remote` is a plain flag.** Pick a device with `--device <name>`, because an optional flag value would swallow the next command.
- **Changing the stored data shape needs a migration** (`withMigration`), so existing users keep their data.
- **Run `npm install` before `npx todo`.** If the workspace bin isn't linked, npx fetches an unrelated public `todo` package.
