# Report engine

MIDO XI currently has **no way to produce a document.** No PDF library, no email
provider, no share links, no print stylesheet. Everything a player does is
locked behind a login, which means nothing they build here can be shown to the
people whose opinion decides their football career.

That is the gap this document specifies.

---

## 1 · What a report is here

A report is a **rendered view of the timeline**, filtered by date range and by a
privacy policy the player sets. It is not a separate data model, and it must not
become one — a report that can say something the app cannot show is a report
that will drift out of truth.

Every figure in a report carries its provenance marker (§4 of
`PLAYER_DATA_2.md`). A report never states as fact something the player merely
entered, without saying they entered it.

## 2 · The report types

Ordered by how often they'd be produced.

| Report | Audience | Contents | Priority |
|---|---|---|:--:|
| **Monthly development report** | Coach, parent, self | Goals + evidence, minutes, match log, film observations, study, what changed | **V1** |
| **Match report** | Coach, self | One match: line, stats, review answers, clips, observations | **V1** |
| **Player profile** | Trial coach, scout | Bio, position, physical, current club, highlight clips, current focus | V2 |
| **Trial / recruitment CV** | Club, academy, college | Profile + season record + development narrative + contact | V2 |
| **Season review** | Everyone | Full season arc, per-90s where valid, progression | V2 |
| **Physical test report** | Trainer | Assessments over time, retests, programme adherence | V3 |
| **Injury / availability record** | Club medical | Check-in history, absence periods, return timeline | V3 |

Everything past V1 reuses the same engine. If V1 is built as a template system
rather than a page, the rest is content work.

## 3 · How to render it

**Server-rendered HTML → PDF via headless Chrome.**

Considered and rejected:
- **`@react-pdf/renderer`** — a second styling system to maintain. The design
  system is already Tailwind; duplicating it in PDF primitives means every visual
  change happens twice, and they will diverge.
- **`pdfkit` / `jsPDF`** — imperative drawing. Wrong level of abstraction for a
  document that is fundamentally a laid-out page.
- **Client-side `html2canvas`** — rasterises. Text stops being selectable, fonts
  blur at print DPI, and it cannot run for scheduled or emailed reports.

Headless Chrome wins because **the report page is a real route**. `/report/[id]`
renders in the browser for preview, and the same URL renders to PDF. One
template, one styling system, one thing to review.

The cost is a Chromium binary, which does not fit a standard serverless function.
Options: a dedicated rendering endpoint on a fatter runtime, or a hosted
render-to-PDF service. **Recommendation:** ship V1 as *browser print* — a
`@media print` stylesheet and the browser's own "Save as PDF" — which is free,
requires zero infrastructure, and produces a real vector PDF. Add server
rendering only when reports need to be *emailed*, which is the point at which
the app has to make the file itself.

That sequencing matters: it turns a two-week infrastructure task into a
two-day CSS task, and the second half is only paid for when a feature needs it.

## 4 · Branding

Two modes:

- **MIDO XI branded** (default) — the mark, the type, the black. This is the
  distribution mechanism: a development report sitting on a coach's desk with
  MIDO XI on it is the cheapest acquisition channel the product has.
- **Club branded** (Club tier only) — the organisation's crest and name, MIDO XI
  reduced to a small credit line. This is worth paying for and should be priced
  as such.

There is no unbranded mode. A document with no origin is a document nobody trusts.

## 5 · Localisation

Reports are the **first place multilingual matters**, before the UI. A Spanish
academy coach reading an English report is a worse failure than a Spanish player
using an English interface, because the player chose the app and the coach did
not.

Practical shape: the report template takes a locale; numbers, dates and units
format per locale (metric everywhere except US); the narrative prose is either
generated in the target language directly by the model, or omitted. **Do not
machine-translate a generated narrative** — two lossy passes over football
terminology produces text that reads as wrong to anyone who knows the game.

Units deserve their own note: height in cm/ft-in and distance in km/mi are
per-locale, but **never convert a figure the player typed.** Store what they
entered plus its unit; convert only on display.

## 6 · Privacy

Youth football data leaves the platform in these documents. The controls are
part of V1, not a follow-up.

- **Default to minimal.** A new report includes: name, position, club, the date
  range, and the development content. Not date of birth, not contact details,
  not physical measurements.
- **Field-level opt-in.** The player ticks what to add. The preview shows exactly
  what the recipient will see — no hidden fields, no metadata surprises.
- **Under-16 accounts** should require the account holder to confirm before a
  report containing identifying detail can be shared by link.
- **Nothing personal in URLs.** Share tokens are opaque and random; the player's
  name never appears in a query string.
- **Coach feedback is quotable, not silently republished.** If a coach's note
  appears in a report, it is attributed and the player can exclude it.

## 7 · Sharing

| Mechanism | Shape | Notes |
|---|---|---|
| **Download** | PDF, immediate | V1. No infrastructure, no exposure. |
| **Share link** | `/r/<token>`, expiring | V2. Opaque token, default 30-day expiry, revocable, view count shown to the player. |
| **Email** | Sent to a named address | V2. Needs a provider (Resend is the cleanest fit for a Next.js app). Rate-limit hard — this is a spam vector. |
| **QR** | Encodes the share link | V3. For a printed CV or a trial. Points at the same token, so revoking works. |

Share links must be revocable **and** expiring. A recruitment CV that stays live
forever is a permanent public record of a fifteen-year-old.

## 8 · Social graphics

A different thing from reports and worth separating: a square/story image the
player posts. Match result, a milestone, a season line.

Render as an **OG image route** (`ImageResponse`), which is already available in
Next and needs no new dependency. Sizes: 1080×1080 and 1080×1920.

Rules that keep this honest:
- Only real numbers. No invented "performance score" to make a card look good.
- No opponent shaming — the card names the fixture, not a player.
- Watermarked, small.

Realistic assessment: this is a nice-to-have with genuine viral upside and no
retention value. It is priority 12 in the matrix for that reason. Build it after
the loop works, when there is something worth posting about.

## 9 · What V1 actually is

1. `@media print` stylesheet across the app's document routes
2. `/app/reports/monthly/[period]` — a real page, printable
3. `/app/reports/match/[id]` — same
4. A privacy panel that controls which fields render
5. MIDO XI branding, English only

No PDF library. No email provider. No queue. Two routes, a stylesheet and a
permission object — and a player can hand their coach a development report.
