# MIDO XI Capture — Developer Guide

Save football moments from YouTube directly to the MIDO XI Player OS.
Everything lives in `extension/`; the server side is part of the main app.

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
npm test                              # repo unit tests, includes tests/unit/captures.test.ts
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
`&env=local|production`, `&auth=out|offline` (forces the signed-out / offline
views), `&fail=save` (save fails → pending/retry loop).

## Release

```bash
npm run package            # produces mido-xi-capture-<version>.zip
```

Then follow `docs/extension/CHROME_STORE.md`. Do not publish without the owner.
