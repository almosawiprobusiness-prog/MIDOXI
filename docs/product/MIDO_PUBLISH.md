# MIDO PUBLISH — as built

Status 2026-08-30. Player progress as a professional artifact, plus
the document engine's elevation. No new dependencies.

## The image engine

One `ImageResponse` route (`/app/publish/image`), four templates
(match performance, training complete, development progress, season
snapshot), three format presets (1080², 1080×1920, 1200×630) sharing
one scale system. Owner-only: auth-gated, renders only the signed-in
user's record, accepts no id — there is no other player's card to
request.

**Privacy is construction, not policy.** `lib/publish/data.ts`
adapters assemble template data by WHITELIST — each names exactly the
fields its artifact shows, and no adapter spreads a source object.
Email, DOB, location, health, film observation text and AI reasoning
are not filtered out; they are inexpressible. The preview IS the
artifact: same route, same pixels.

**Sharing:** download + `navigator.share` file sheet where the browser
offers one. No posting OAuth — the artifact matters more than the
posting (directive §42, honoured).

**Visual rules:** black/graphite/off-white, one restrained accent,
large intentional type, small MIDO XI signature. Only real logged
numbers; no invented performance score; the fixture is named, no
opponent-player shaming is possible because opposing players are not
in the vocabulary.

Typeface note: ImageResponse renders with its bundled default face.
Loading Big Shoulders into the renderer means fetching font bytes at
render time; deferred until the cards' typography is the weakest thing
about them.

## The document engine

Browser print stays the PDF mechanism — it produces real vector PDFs
with selectable text, and `FEATURE_DECISIONS.md`'s "no PDF engine"
stands reinterpreted: the work was document design, not a library.

- **Training plan** (`/app/reports/session/[id]`): the directive-§45
  structure — identity, objective, WHY THIS SESSION (block citations
  in words), numbered blocks with prescriptions, REFLECTION with RPE
  and write-in lines. Linked from every planned session.
- Monthly development / training / film reports: existing, untouched.
- Training report can now CREATE share links (the renderer existed
  since 0022; creation did not). `/r/[token]` serves NotValid for any
  kind without a renderer — closing the latent film-share NaN bug.
- **QR:** evaluated, deferred. The only honest target today is an
  authed route; a QR that scans to a login screen is decoration.
  Revisit when per-session share links exist.
- Server-side PDF (for email): explicitly the trigger point recorded
  in REPORT_ENGINE.md; still not needed.

## Measurement

`vision_job_*` joined analytics this phase; publish/share respectively
ride `report`-side events and can be extended when the loop metrics
demand it. Nothing about footage or card contents is logged.
