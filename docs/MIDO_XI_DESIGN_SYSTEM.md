# MIDO XI — Design System

**"The Film Room."** Dark-first, cinematic, editorial, football-technical. Elite football
intelligence crossed with a performance laboratory — never SaaS dashboard, never fitness tracker,
never Ultimate Team.

Source of truth: `app/globals.css`. This document explains the intent so new surfaces stay
consistent.

## Palette

| Token | Use |
|---|---|
| `--ink-950 … --ink-600` | The graphite canvas. 950 is the page, 900 panels, 850 raised/inset, 700+ dividers and controls. |
| `--text-hi / --text / --text-dim / --text-faint` | Four steps only. Body copy is `--text-dim`; anything important steps up to `--text-hi`. |
| `--signal` (violet) | The single MIDO signal. Used for the active state, the AI, and one primary action per view. Never decorative. |
| `--positive / --review / --correction` | Football semantics **only** in football contexts: clip sentiment, readiness, availability, provenance. Never generic success/warning chrome. |
| `--info` | Reserved for **verified** information in the Study Engine. |

Provenance colour is load-bearing: blue = verified record, violet = MIDO analysis, green = the
user's own observation. Do not reuse those colours for anything else on a study surface.

## Typography

- `font-display` — headings and figures. Tight tracking, heavy weight, large sizes.
- `.stat-figure` — numerals: tabular, -0.03em, 0.9 line-height. Every KPI uses it.
- `.label-tech` — 10.5px mono, 0.16em tracking, uppercase. Section labels, metadata, eyebrows.
- `.data-mono` — inline numerals inside prose or lists.

Rule of thumb: if it is a number, it is mono or display. If it is a label, it is `label-tech`.
Body copy is never uppercase.

## Surfaces

- `.panel` — the default container: `ink-900`, hairline border, 14px radius.
- `.panel-raised` — gradient `ink-850 → ink-900`, for the one element that should feel lifted.
- `.pitch-grid` — 44px ambient grid, used on the app canvas and inside hero cards at low opacity.
- `.field-glow` — a single violet radial from the top. One per view, maximum.

Avoid glowing borders on every card, and avoid grids of many small rectangles. Negative space is
part of the hierarchy: a view should have one focal element, not eight equal ones.

## Motion

`.rise-in` with a stagger of 60–80ms per element, `cubic-bezier(0.2, 0.8, 0.2, 1)`.
`.pulse-dot` marks live state. Everything collapses under `prefers-reduced-motion`.

## Shared components

| Component | File | Purpose |
|---|---|---|
| `PageHeader`, `StatBand`, `MiniBars`, `ProgressRow`, `Radial`, `FormPips` | `components/ui/kit.tsx` | Page furniture and dependency-free data viz |
| `SectionHeader`, `categoryStyle`, `sentimentStyle`, `Meter` | `components/ui/primitives.tsx` | Section labelling and football semantics |
| `DashboardHero`, `QuickActions`, `EmptyState`, `DemoNote` | `components/dashboards/shared.tsx` | Role dashboard furniture |
| `SectionScaffold` | `components/shell/section-scaffold.tsx` | Honest "building" state that says what will live here |

## Role expression

The design system does **not** re-skin per role. Role is expressed through structure, language and
content: the eyebrow (`PLAYER` / `COACH` / `TRAINER` / `CLUB`), the dashboard title (The Locker /
Touchline / The Lab / HQ), the navigation, and the terminology map in the role registry. One
visual identity, four products.

## Honesty rules (design-level)

- Scaffolded navigation carries a dot and leads to a `SectionScaffold` that states what is planned
  and what is already wired. No dead links, no "coming soon" walls.
- Demonstration data is always footnoted with `DemoNote`.
- Empty states describe the next real action; they never show placeholder numbers.
- Nothing is styled to look like data when it is not data.
