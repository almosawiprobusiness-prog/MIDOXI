# MIDO XI Capture — Metrics

The extension is a validation instrument: does a serious player, already watching
football, naturally capture observations into their development system? These are
the questions it must answer, and where each answer lives.

## The free-mode decision (v0.2): analytics-silent by design

Free mode phones home for **nothing**. A local capture makes zero network
requests, so there is no install→first-capture telemetry, no library-opened
event, no export counter. This is deliberate: the privacy promise ("your notes
stay on this device") is worth more than a funnel chart, `product_analytics`
requires an authenticated user anyway, and a capture tool that reports on its
users before they trust it never gets the users.

What that costs, and the honest proxies:

| Free-product question | Answer |
|---|---|
| Installs | Chrome Web Store dashboard |
| Install → capture rate | Not measurable without phoning home — proxy: store installs vs users who later connect with a non-empty library |
| Free captures per user, library/export usage | Not measured. The product-level signal is whether free users CONNECT — measured precisely below |

## The connect funnel (measured, server-side)

`capture_saved` now carries `via: "popup" | "import"`. An `import` batch is a
free user converting: the size of their local library at connection is the
free-mode engagement number, delivered exactly once, with consent, at the
moment it matters.

| Question | Answer |
|---|---|
| Free → connected conversions | users whose first `capture_saved` has `via: "import"` |
| How much free usage preceded connecting | count of `via: "import"` rows per user in their first day |
| Connected capture frequency | `capture_saved` with `via: "popup"` per user per week |

## Events

Three additions to the closed `ProductEvent` vocabulary (`lib/analytics/track.ts`),
all recorded server-side in `product_analytics`, none carrying observation text:

| Event | Fired | Props |
|---|---|---|
| `extension_opened` | Authenticated `GET /api/extension/session` — once per popup open | `goals` (count) |
| `capture_saved` | A capture persists (not on dedupe) | `linkedToGoal` (bool), `category` (enum or `"none"`) |
| `capture_opened_in_mido` | "Watch moment" clicked inside the Player OS | `captureId` |

The football record gets `STUDY_MOMENT_CAPTURED` in `mido_events` (subject: study,
payload: videoId/category/goalId) — that one feeds recommendations, not dashboards,
per the two-system boundary.

## The questions, and how to answer them

Queries run with the service role against `product_analytics` (insert-only for
users; reads are admin tooling), joined on `user_id` where needed.

| Question | Answer |
|---|---|
| How many players install it? | Chrome Web Store dashboard (no code can count installs that never open) |
| How many connect their account? | distinct `user_id` with ≥1 `extension_opened` |
| How many capture at least one moment? | distinct `user_id` with ≥1 `capture_saved` |
| How many capture again within 7 days? | users with ≥2 `capture_saved` where the 2nd is ≤7 days after the 1st |
| Moments per active player? | `capture_saved` count / distinct capturing users, per week |
| % of moments connected to goals? | `capture_saved` where `props.linkedToGoal = true` / all |
| Are moments revisited? | distinct `user_id` with ≥1 `capture_opened_in_mido`; and per-moment via `props.captureId` |
| Does usage correlate with returning to MIDO XI? | compare capturing vs non-capturing users on existing events (`study_started`, `checkin_completed`, …) in the same window |

Alternatively, `study_captures` itself answers volume/goal-connection questions
directly (`origin = 'chrome_extension'`), which is the more trustworthy source for
counts since analytics is fire-and-forget.

## What is deliberately NOT tracked

- Popup renders, hovers, keystrokes, category browsing — vanity
- Observation text anywhere in analytics — it is the player's football record
- A separate "auth started/completed" funnel — connection is observable as the
  first authenticated `extension_opened`

## The bar

The behaviour that matters is **captured moments and their revisits**. If players
install but do not capture, or capture but never reconnect the moments to their
development, the extension has answered its question — and the answer is acted on
per `RELEASE_GATE.md`, not hidden behind new features.
