# CLAUDE.md

## Commands

```bash
npm run start         # Build in watch mode (dev, both Chrome + Firefox targets)
npm run build         # Production build + zip archives for both targets
npm run check-types   # TypeScript type checking (use this, not npx tsc)
npm run lint          # Lint
npm run lint -- --fix # Lint and auto-fix all auto-fixable errors
npm test              # Run tests
npm test -- --testPathPattern=tabUtil  # Run a single test file by pattern
```

## Architecture

Tab Wrangler is a browser extension with three compiled entry points:

- `app/background.ts` — service worker; owns the tab-closing loop, writes `tabTimes` to
  `chrome.storage.local`, updates the badge
- `app/popup.tsx` / `app/options.tsx` — React UIs; both boot the same `App.tsx` shell

**Build** uses a dual-compiler webpack setup producing `dist/chrome/` (Manifest v3 service worker)
and `dist/firefox/` (Manifest v3 background scripts array). `webpack.config.js` is dev;
`webpack.production.config.js` wraps it and adds a zip plugin.

### Communication between background and UI

There is no message-passing protocol between background and UI (beyond a single `"reload"` command).
All coordination goes through storage events:

- Background writes → storage → UI React Query hooks invalidate → re-render
- UI mutates settings/locks → storage → background `onChanged` listener reacts

### Storage layout

| Area | Key | Contents |
|------|-----|----------|
| `sync` | `persist:settings` | All user settings (pause state, thresholds, whitelist, locked IDs, …) |
| `local` | `persist:localStorage` | Saved/closed tabs, statistics, install date |
| `local` | `tabTimes` | `{ [tabId]: lastAccessedTimestamp }` — written frequently, kept separate |
| `local` | `pausedAt` | Timestamp when paused; absent when running |

`app/js/storage.ts` wraps all storage access. Every mutating function acquires `ASYNC_LOCK`
(5s max) to prevent race conditions. React Query hooks (`useStorageSyncPersistQuery`,
`useStorageLocalPersistQuery`) subscribe to `chrome.storage.onChanged` and self-invalidate.

### Settings system (`app/js/settings.ts`)

Singleton with synchronous `get(key)` / async `set(key, value)` / `subscribe(key, fn)`. Loaded from
`chrome.storage.sync` at startup. In React components, use the `useSetting(key)` hook (backed by
`useSyncExternalStore`) rather than reading `settings.get()` directly, so components re-render on
change.

### Tab-closing logic (`app/js/tabUtil.ts`)

`findTabsToCloseCandidates(tabTimes, tabs)` is the core function. It filters out locked tabs
(pinned, grouped if `filterGroupedTabs`, audible if `filterAudio`, whitelisted, manually locked,
window-locked), respects `minTabs` / `minTabsStrategy` (`"givenWindow"` counts per window;
`"allWindows"` counts across all windows), and returns the oldest eligible tabs up to the configured
`maxTabs` limit.

### UI layer

- `LockTab/` — open-tabs view with countdown timers, lock controls, window grouping
- `CorralTab/` — closed-tabs view; uses `react-virtualized` for large lists
- `OptionsTab/` — settings form
- React Query handles storage-as-server-state; `UndoContext` provides undo for tab operations

### i18n

All user-visible strings go through `chrome.i18n.getMessage(key)`. Messages live in
`_locales/{locale}/messages.json`. When adding a new string, add it to `_locales/en/messages.json`
with a `description` field (used by translators on Crowdin) and `placeholders` for any substitution
values.
