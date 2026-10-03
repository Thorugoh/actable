This is an Expo/React Native mobile application. Prioritize mobile-first patterns, performance, and cross-platform compatibility.

## Expo has changed — do not trust your training data

Expo ships breaking changes every SDK release. APIs you remember are likely renamed, moved, or removed. Before writing any code that touches an Expo, EAS, or React Native API:

1. Read the major version of the `expo` package in `package.json`.
2. Fetch the matching versioned docs: `https://docs.expo.dev/versions/v<major>.0.0/`
3. For anything else, fetch https://docs.expo.dev/llms.txt — an index of all Expo docs with corrections to common LLM misconceptions. Follow its links to the specific page you need; never answer from memory.

## Commands

Use `bunx` instead of `npx` if the project uses bun (`bun.lock` present).

```bash
npx expo install <package>  # ALWAYS use instead of npm/yarn/pnpm/bun add — resolves SDK-compatible versions
npx expo start              # start the dev server
npx expo lint               # lint
npx tsc --noEmit            # typecheck
npx expo-doctor             # diagnose dependency and config issues
npx expo install --fix      # fix incompatible package versions
```

Run lint and typecheck before declaring any task done.

## Architecture (read the root `AGENTS.md` first)

This app is a **thin shell** over the todo domain (`@todo/domain`) and the runtime (`@actable/core`). All state, rules and navigation live there and run headlessly in Node. This app only renders and dispatches, using `@actable/react-native`.

```
src/
  app/TodoApp.tsx          root: RuntimeProvider, navigator, confirmation sheet, dev bridge
  runtime/                 ports (SQLite, ids, clock, confirmations), stored-state migration, useUserDispatch
  navigation/              TodoNavigator (useNavigationSync) and StackParams
  screens/<screen>/        one folder per screen: the screen and its rows/cards
  components/              shared UI (Card, Checkbox, TextEntry, SegmentedControl, ConfirmationSheet…)
  dev/DevBridge.tsx        remote mode (dev only) and the "● remote" badge
  theme/, format/          colors and date formatting
```

- **Reading data:** use `useViewModel<ListViewModel>(route)`, with the types exported by `@todo/domain`. Never compute display data in components; add it to the domain's view model instead.
- **Changing data:** use `useUserDispatch()(action, input)`. It's the same pipeline the CLI and agents use, tagged `origin: "user"`, and failures show an alert.
- **One component per file,** named after it. Screen-specific pieces live next to their screen.

## Navigation & Routing (overrides the Expo template default)

- **Do not use Expo Router here.** The runtime owns navigation (driven by `nav.*` actions), so file-based routing would be a second source of truth. `TodoNavigator` renders the runtime's stack with React Navigation's native stack (which Expo Router uses internally), synced by `useNavigationSync` from `@actable/react-native`.
- **Never call `navigation.navigate`.** Dispatch `nav.push` or `nav.back`. Native back gestures are synced into the runtime automatically.
- **To add a screen:**
  1. Add the route to `examples/todo/domain/src/routes.ts`.
  2. Add the screen, with its view model and guards, in `domain/src/screens/`.
  3. Add it to `StackParams` and `TodoNavigator`.

## Testing

```bash
npm run ios                          # from the repo root: Metro + Expo Go on the iOS simulator
maestro test examples/todo/mobile/e2e
```

- Give tappable elements a `testID`. Pressable rows with `accessibilityRole="button"` merge their children into one accessibility label, so match their text by prefix regex (`"Name.*"`). Escape `?` in Maestro text matchers, because they are regexes.
- Prefer headless scenarios (`examples/todo/scenarios`) for behavior. Use Maestro only for what's UI-specific: gestures, rendering and native navigation sync.

## Building with EAS

Use EAS to build, sign, and submit the app in the cloud (`eas build`, `eas submit`) and to ship over-the-air updates (`eas update`) — no local Xcode or Android Studio required. Run EAS CLI as `bunx eas-cli <command>` in Bun projects, or `npx eas-cli@latest <command>` otherwise; substitute that for bare `eas` in docs examples.
Docs: https://docs.expo.dev/eas/index.md

## Rules

- If `ios/` and `android/` directories do not exist, they are generated (Continuous Native Generation). Never create or edit them by hand — configure native behavior in `app.json` and config plugins.
- Expo Go only includes its bundled native modules. After adding a library with native code, the app needs a development build: `npx expo run:ios|android` locally, or `eas build --profile development`.
- Prefer recommended Expo modules over third-party libraries, and check your available skills before adding dependencies. Docs: https://docs.expo.dev/versions/latest/index.md
