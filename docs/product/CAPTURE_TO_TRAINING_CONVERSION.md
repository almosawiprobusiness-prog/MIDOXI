# Capture → Training conversion

One deliberately small monetization experiment, added on top of
PLAYER_OS_BETA_RC1. The extension captures the lesson; MIDO XI turns it
into training. This document is the experiment's contract: what was
built, what may be concluded from it, and what would kill it.

## Hypothesis

A player who just saved a football lesson is at their highest-intent
moment — "I noticed something important" is one step from "how do I
train this?". Exposing exactly one bridge at that moment —
**BUILD A TRAINING SESSION** — converts free Capture users into MIDO XI
Player subscribers, and (the part that matters) those subscribers
actually generate and complete the session they paid for.

## The user flow

The CTA appears in two places, and nowhere else:

1. **The saved-success state** — after a real save, as a compact panel
   (never a modal, no urgency, no countdown). Restraint rules:
   - Entitled players always see it — for them it is a product
     capability, and no pricing is ever shown to a paying user.
   - Free/connected users see it until they press "Not now", which
     quiets the automatic surface for 7 days (`TRAIN_CTA_COOLDOWN_MS`).
   - Free Mode (unauthenticated) additionally waits for the 2nd save
     (`LOCAL_MIN_SAVES`) so the first capture stays a clean win.
   - A connected-mode save that fell back to local storage (server
     unreachable) shows no CTA — the bridge it advertises is down.
2. **The library** — a quiet per-moment "Train" action, always
   available regardless of dismissal.

Per state:

| User | Click leads to |
|---|---|
| Connected, entitled | MIDO XI Training opens with `?focus=capture:<id>` — the lesson pre-loaded, nothing retyped |
| Connected, entitled, moment only local | One explicit "Import to MIDO & build?" confirmation, then import + handoff |
| Connected, free | In-popup offer: value copy + canonical price + **Unlock MIDO XI** → `/app/membership?src=capture_training&capture=<id>` |
| Local (no account) | In-popup explainer ("nothing has been uploaded") + **Continue to MIDO XI** → login → membership. The local lesson stays local; import remains a later, explicit action in the library |

## The handoff intent (local → connected without leaking)

A Free Mode lesson cannot ride a URL (privacy) and must not upload
before consent. The mechanism is a **local intent**: when a
not-yet-entitled player presses the conversion button, the extension
stores `{ localId, savedAt }` in `chrome.storage.local` — the lesson's
on-device id, nothing else (validated by `asTrainIntent`, 7-day
expiry). Two writers:

- Free Mode → "Continue to MIDO XI"
- Connected-free with a **local-only** moment → "Unlock MIDO XI"
  (a moment already in MIDO instead rides the checkout success URL as
  `capture=<uuid>`, which is just as content-free)

On any popup open that is **connected and entitled**, a fresh intent
resolves against the local library and surfaces as one banner —
"Your saved lesson … **Use this lesson**" — which imports that single
Moment (idempotent via `clientKey` = local id), records the returned
server id, clears the intent, and opens the Training handoff. Dismiss
clears it; a deleted lesson clears it; import failure keeps both the
local copy and the intent ("Couldn't import this lesson. Your local
copy is safe — try again."). A connected-but-free reconnect keeps the
intent silently — the promise is only surfaced when it is deliverable.
Once imported, server state is authoritative: the training URL works
from any device, no extension tab needs to stay alive.

## Paid flow (the delivery)

- `/app/training?focus=capture:<id>` opens the Generate Session dialog.
- The engine (`lib/ai/session-engine.ts`) fetches the capture by id
  **server-side under RLS** — a foreign or deleted id loads nothing and
  the focus is dropped like any stale link.
- The lesson enters the context block as a `[capture:<id>]` citation,
  explicitly labelled as *the player's own observation, not an AI
  analysis* (the honesty rule: no model watched that footage).
- Both the model path and the free composed fallback honour the focus
  with a dedicated block, so a paying player always gets a session
  built around their lesson even when the model is unavailable.
- Provenance: the brief's `focusKey` (`capture:<id>`) plus the block's
  `sourceKey` citations — no separate extension-side training engine
  exists.

## Checkout, attribution and the purchase return

- The membership page validates `src`/`capture` with
  `sanitizeCheckoutAttribution` (closed source enum + strict UUID) and
  threads them through `startCheckout` → Stripe metadata
  (`source: "capture_training"`). **No lesson content, URL or free text
  can reach Stripe metadata** — the sanitizer only passes an enum and a
  UUID, and the UUID rides only the success URL.
- Success URL: `/app/membership?checkout=success&train_capture=<id>`.
  If the webhook has already recorded the entitlement, the page
  redirects straight to the training handoff; otherwise the success
  banner carries a "Build the session from your saved lesson" button —
  the outcome is one click away either way, immune to webhook timing.
- Cancelled checkout: the capture is untouched (it was never part of
  the checkout), and the cancel banner is the existing one.

## Privacy behavior

- **Free Mode phones home for nothing** — unchanged. The local-mode CTA
  and offer views make zero network requests; no telemetry, no upload.
- The observation never rides a URL, an analytics prop, or Stripe
  metadata. The only cross-boundary identifier is the capture UUID.
- Import to MIDO XI remains explicit: the entitled-user library flow
  requires a second confirming click; the free-user flow leaves import
  to the existing library import banner after signup.

## Events (all in the closed `ProductEvent` vocabulary)

| Event | Fired where | Props |
|---|---|---|
| `capture_training_cta_shown` | Extension → `/api/extension/telemetry` (connected only) | `surface` ("saved"/"library"), `entitled` |
| `capture_training_cta_clicked` | Extension → telemetry route (connected only) | `surface`, `entitled` |
| `capture_training_upgrade_viewed` | Extension offer view (connected), and membership page with `src=capture_training` (covers local-origin arrivals) | `surface` |
| `capture_training_checkout_started` | `startCheckout` server action when attribution present | `plan` |
| `capture_training_purchase_completed` | Stripe webhook, `checkout.session.completed` with `metadata.source=capture_training` (via `trackFor` — webhooks have no user session) | `plan` |
| `capture_training_handoff_opened` | `/app/training` server render with a `capture:` focus | `via` ("extension"/"post_checkout") |
| `capture_training_session_generated` | `generateSession` when the lesson actually loaded into context | `category` |

The telemetry route (`/api/extension/telemetry`) accepts only these
three extension events with two enum/boolean props, bounded at 500
bytes — sanitized by `lib/extension/telemetry.ts`, which is under unit
test.

## The funnel

```
capture_saved
  → capture_training_cta_shown
  → capture_training_cta_clicked
  → capture_training_upgrade_viewed
  → capture_training_checkout_started
  → capture_training_purchase_completed
  → capture_training_handoff_opened
  → capture_training_session_generated
  → training_completed            (existing event)
```

Local-mode users are invisible until they authenticate (by design);
their conversions surface at `capture_training_upgrade_viewed`
(membership page) onward, attributed by `src=capture_training`.

## Reading the funnel (Founding XI — service-role queries, no dashboard)

Run against `product_analytics` with the service role, the same way
every beta metric in `docs/extension/METRICS.md` is read:

```sql
-- The funnel, per stage, last 30 days
select event, count(*) as n, count(distinct user_id) as users
from product_analytics
where event in (
  'capture_saved',
  'capture_training_cta_shown', 'capture_training_cta_clicked',
  'capture_training_upgrade_viewed', 'capture_training_checkout_started',
  'capture_training_purchase_completed', 'capture_training_handoff_opened',
  'capture_training_session_generated'
) and created_at > now() - interval '30 days'
group by event;

-- The true success metric: purchasers who then generated AND completed
select count(distinct p.user_id)
from product_analytics p
where p.event = 'capture_training_purchase_completed'
  and exists (select 1 from product_analytics g
              where g.user_id = p.user_id
                and g.event = 'capture_training_session_generated'
                and g.created_at >= p.created_at)
  and exists (select 1 from product_analytics t
              where t.user_id = p.user_id
                and t.event = 'training_completed'
                and t.created_at >= p.created_at);
```

## Success signal

Players save lessons → request training → subscribe → **generate the
session → start/complete it** (`training_completed` after a
`capture_training_session_generated`). A purchase followed by no
Training use is weak evidence and does not validate the hypothesis.

## Failure signal

- `capture_saved` rate drops after this ships (CTA hurts capture).
- Dismiss-and-never-return dominates (`cta_shown` ≫ `cta_clicked`).
- `checkout_started` ≫ `purchase_completed` (proposition collapses at
  price).
- Purchases without `session_generated` (paid, not delivered — a
  product failure, fix delivery before anything else).
- Support signals that players think Capture itself became paid.

If failing: **do not increase upsell aggression.** Fix the proposition
or remove the CTA.

## Production copy (as shipped)

- CTA: **"Build a training session"** / "Turn this lesson into a
  session built around your game."
- Connected-free offer: **"You saw the lesson. Now train it."** /
  "Your lesson is saved. MIDO XI Player can turn it into a personalized
  training session using your position, development goals, studies and
  recent work." / `$9.99/month` (rendered from the canonical plan
  config; "or $89/year" as the quiet secondary) / **Unlock MIDO XI** /
  "Not now".
- Local offer: **"Build a training session"** / "Your moment is saved
  on this device — nothing has been uploaded. Turning a lesson into a
  session built around your position, goals and development history is
  MIDO XI Player." / **Continue to MIDO XI** / "Not now".

## Known limitations

- `training_started` has no dedicated event — "started" is proxied by
  the accepted session existing (`training_generated` → a
  `training_sessions` row) and "completed" by `training_completed`.
- The AI-path lesson influence (vs the composed fallback) can only be
  QA'd with an entitled account + live model key; the composed path and
  the prompt content are pinned by tests instead.
- `capture_training_upgrade_viewed` can fire on both the in-popup offer
  and the membership arrival for the same user — treat it as
  reached-the-offer, not unique impressions.
- Free Mode is analytics-silent by design, so local-origin conversions
  first become visible at the membership arrival.
- A live purchase (test-card checkout + webhook delivery) needs the
  production/test Stripe environment — code paths are covered by unit
  and integration tests, but the money loop itself needs one manual
  smoke purchase.

## Future copy variants (documented, NOT built — no experimentation framework)

- **A:** "Build a training session — Turn this lesson into work you can
  do today."
- **B:** "Train this — MIDO XI turns what you noticed into a
  personalized session."
- **C:** "Turn this into your game — Build a session around this
  lesson."

Do not A/B test until traffic justifies it.
