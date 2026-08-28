# MIDO XI Capture — Developer Guide

Save timestamped football moments from YouTube — locally for free (My Moments
library, search, export), or into the MIDO XI Player OS when connected. The
session picks a mode; capturing is never gated on a login. Everything lives in
`extension/`; the server side is part of the main app.

## Install

```bash
cd extension
npm install
```

## Build

```bash
npm run build        # one production build → extension/dist/
npm run watch        # rebuild on change
npm run typecheck    # tsc --noEmit
npm run package      # build + mido-xi-capture-<version>.zip (store upload)
```

The build bundles `src/popup.ts` with esbuild. It imports the shared capture
contract straight from `../lib/data/capture-types.ts`, so the extension and the
API validate identically by construction.

## Load unpacked

1. `npm run build`
2. Chrome → `chrome://extensions` → enable **Developer mode**
3. **Load unpacked** → select `extension/dist/`
4. The id will be `fkdfojkjedbkikagcmgpioacioojelja` (pinned by the manifest `key`).

Keyboard shortcut: **Alt+Shift+M** opens the popup (customisable at
`chrome://extensions/shortcuts`).

## Point it at a local MIDO XI

The popup talks to production (`https://mido-xi.vercel.app`) by default.
To develop against localhost:

1. Run the app: `npm run dev` (port 3000 per `.env.local`) or `npm run dev:demo`
   (port 3100, **demo mode** — no keys, no sign-in, full loop on seed data).
2. In the popup: gear icon → **Environment** → `localhost:3100`.

Demo mode is the fastest way to see the whole capture → Film Room loop working.

## Server environment

- `MIDO_EXTENSION_IDS` — comma-separated extension ids allowed to call
  `/api/extension/*`. Unset = any extension origin (dev). Set in production.
- The migration `supabase/migrations/0035_study_captures.sql` must be applied
  (Supabase SQL editor, same as 0031–0034 — see `docs/beta/APPLY_MIGRATIONS.md`).
  `npm run verify:db` confirms it afterwards.

## Tests

```bash
npm test                              # repo unit tests: tests/unit/captures.test.ts (the wire
                                      # contract) + tests/unit/extension-library.test.ts (the
                                      # local library: search, export formats, v0.1 migration)
node scripts/verify-extension-api.mjs # integration: contract, origins, idempotency,
                                      # surfacing — against a RUNNING server (use dev:demo)
```

## UI harness (no extension loading loop)

The real built popup, with `chrome.*` shimmed, in a plain tab:

```bash
node harness/serve.mjs     # from extension/ — serves on :3000 (an allowed origin)
# → http://localhost:3000/harness/harness.html
```

Scenarios via query params: `?page=watch|shorts|none|novideo`, `&seconds=2057`,
`&env=local|production`, `&auth=out|offline` (forces local mode / an
unreachable MIDO), `&fail=save` (connected save fails → "Save locally instead").

Free Mode against a REAL 401 (the honest free-user experience): run
`mido-xi-real-3100` (real keys, no cookies in the pane) with `&env=local`.
Connected Mode: run `dev:demo` instead — the demo server authenticates without
a login, goals load, and imports land in its in-memory film room.

## Release

```bash
npm run package            # produces mido-xi-capture-<version>.zip
```

Then follow `docs/extension/CHROME_STORE.md`. Do not publish without the owner.
