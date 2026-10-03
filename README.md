# Actable

**Make your React Native app usable by people and AI agents alike.**

Actable is an agent-addressable app architecture for React Native, plus a todo app built on it. Everything an app can do becomes an **action**, so anyone can act on it. Humans and AI agents use the same app through the same capability surface:

- a person taps the UI,
- a coding agent runs and tests the app from a CLI, with or without a simulator,
- a user's assistant (for example, Claude through MCP) works in the app on the person's behalf.

It is based on Shopify Engineering's [*"Back to native"*](https://shopify.engineering/back-to-native) (2026-09-10). Shopify moved to Swift and Kotlin; this project keeps React Native and copies the architecture that made their agents effective:

- business logic that runs without the UI,
- a CLI that can inspect the app, navigate and perform actions without touching the UI,
- a **remote mode** that drives the running app on a simulator with the same commands.

> **Status: experimental (0.x).** The architecture works end to end (headless runtime, CLI, Expo app, remote mode), but the APIs will change and nothing is published to npm yet.
>
> Known limitations:
> - Actions are synchronous and local, with no backend or async support yet.
> - Navigation sync supports React Navigation's stack only.
> - It has only been tested under Expo.
> - MCP for user agents is next.

## Repository layout

```
packages/                 The architecture: reusable, knows nothing about todos
  core/                   @actable/core          runtime: actions, dispatch pipeline, screens, navigation, journal/undo, scenarios
  bridge/                 @actable/bridge        remote-mode protocol, app host and client (platform-free)
  node/                   @actable/node          Node adapters (file storage, ids) and the relay server
  cli/                    @actable/cli           builds a CLI for any app: runCli({ name, app })
  react-native/           @actable/react-native  provider, hooks, navigation sync, confirmations, dev bridge, Expo adapters

examples/todo/            The POC app built on it
  domain/                 @todo/domain           data, actions, screens, fixtures (pure TypeScript)
  cli/                    @todo/cli              the `todo` binary: one config object
  mobile/                 @todo/mobile           Expo app that renders the domain's screens
  scenarios/              JSONL flows run by tests, the CLI and agents
```

The dependency direction is one-way. Apps depend on packages; packages never depend on an app. `core`, `bridge` and `todo/domain` are platform-free, which lint enforces, so they run in Node and React Native.

## Quick start

```bash
npm install
npm run check                                   # lint + typecheck + tests

npx todo actions                                # the app's whole API
npx todo run todo.create '{"title":"Buy milk"}' # state lives in .todo/state.json
npx todo inspect                                # current screen as JSON
npx todo --as agent:claude run todo.delete '{"id":"t_…"}'   # blocked until a human approves (--yes)
npx todo run-script examples/todo/scenarios/*.jsonl         # replay flows headlessly (~10ms each)
npx todo --ui-strict run-script examples/todo/scenarios/happy-path.jsonl   # only what a user could tap

npm run ios                                     # the Expo app in the iOS simulator (Expo Go)
npm run e2e:ios                                 # Maestro UI smoke flows against it

npx todo serve                                  # relay: lets the CLI and agents drive the live app
npx todo --remote inspect                       # the simulator's current screen
npx todo --remote --as agent:claude run todo.delete '{"id":"t_…"}'   # the phone asks the user
npx todo --remote run-script examples/todo/scenarios/happy-path.jsonl --delay 1500   # watch it play (replaces app data)
npx todo watch                                  # live feed of every action in the app
npx todo screenshot shot.png
```

Run `npm install` before `npx todo`. If the workspace bin isn't linked, npx fetches an unrelated public package with the same name.

## How it works

```
 humans ─────── taps ─────────┐
 coding agents ─ CLI, remote ─┼─►  runtime.dispatch(action, input, { origin })  ─►  app data, navigation, journal
 user agents ── MCP, in-app ──┘        validate → strict UI? → policy/confirm → execute → journal → events
```

1. **Headless first.** All behavior lives in plain TypeScript that runs in Node. The phone is one shell among several.
2. **Actions are the only way to change state.** Taps, the CLI, agents and tests all call the same actions.
3. **Navigation is state**, owned by the runtime. React Navigation only renders it.
4. **Screens are projections.** Each screen is a pure view model plus the actions its UI offers. React draws the view model, and agents read the same thing as JSON.
5. **Self-describing.** Actions carry descriptions, zod schemas and risk levels. CLI help and agent tools are generated from them.
6. **Every change records its origin** (`user`, `agent:<id>`, `system`). That gives the Activity feed, undo and permission checks.
7. **Platform code sits behind ports** (storage, clock, ids, confirmation), with small Node and Expo adapters.

**Safety for agents:** reads run freely, writes are journaled and undoable, and destructive actions need the user's approval (a sheet on the phone, a prompt in the terminal). Agents can be limited to scopes, and idempotency keys make retries safe. **Strict UI mode** (`--ui-strict`) only allows what a user could do from the current screen.

## Using it in another app

See **[`docs/adding-to-an-app.md`](docs/adding-to-an-app.md)**. In short:

1. Write a domain package: data schema, routes, actions and screens with `createAppKit<Data, Route>()`, then `defineApp(...)`.
2. Get a CLI with one config: `runCli({ name: 'myapp', app: myApp }, argv, processIO())`.
3. In React Native, wrap the app in `<RuntimeProvider app={myApp} ports={…}>`. Render screens with `useViewModel`, dispatch with `useDispatch`, and sync navigation with `useNavigationSync`.

The todo example is the reference. `examples/todo/domain` is about 30 small files (one action or screen per file), and the CLI is a single config object.

## Docs

| Doc | Contents |
|---|---|
| [`packages/README.md`](packages/README.md) | The packages: what they are, why use them, what each one does, how they fit together |
| [`docs/adding-to-an-app.md`](docs/adding-to-an-app.md) | Step-by-step guide: domain, CLI, React Native shell, remote mode |
| [`docs/architecture-proposal.md`](docs/architecture-proposal.md) | The original proposal: principles, layers, agents as users, testing, trade-offs |
| [`docs/poc-plan.md`](docs/poc-plan.md) | POC milestones and success criteria |
| [`AGENTS.md`](AGENTS.md) | How to work in this repo (humans and coding agents) |

## Milestones

| Milestone | Deliverable | Status |
|---|---|---|
| M0 Skeleton | Monorepo, headless lint guardrail, `AGENTS.md` | ✅ |
| M1 Headless core | Runtime: actions, dispatch pipeline, navigation, view models, journal | ✅ |
| M2 CLI | `inspect`, `run`, `run-script`, scenarios in CI | ✅ |
| M3 Mobile shell | Expo app rendering view models, navigation sync, SQLite, Activity | ✅ |
| M4 Remote mode | Relay, `--remote`, `watch`, `screenshot`, approval on the device | ✅ |
| — Restructure | Reusable `@actable/*` packages and the todo app as an example | ✅ |
| M5 MCP | Agent tools generated from actions; the headline demo | next |
| M6 Stretch | In-app assistant using the same actions | — |

**Headline demo (M5).** With the app open, the user tells Claude: *"Add 'buy milk' and 'call mom' to my inbox, and clear everything I finished."*

1. The todos appear live.
2. The delete asks for approval on the phone.
3. Activity shows "Claude …" with Undo.

## License

[MIT](LICENSE) © Victor Hugo
