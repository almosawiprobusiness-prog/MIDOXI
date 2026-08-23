# MIDO XI

**One football intelligence platform. Different operating systems depending on who you are.**

MIDO XI is a football intelligence and development system for players, coaches, performance
trainers and clubs. The product transforms around the user's role — navigation, dashboard,
terminology, AI context and workflows all change — over one shared domain core.

## The loop

```
LEARN → TRAIN → PLAY → ANALYSE → ADAPT → REPEAT
```

Studying Harry Kane ends with a session in your training log and a goal in your development map.
Matches feed development. Development shapes training. Studies connect back to real footballers
and coaches through a curated knowledge graph.

## Stack

Next.js 16 (App Router) · React 19 · Tailwind v4 · Supabase (Postgres + RLS + auth + storage) ·
Anthropic Claude · Stripe · YouTube Data API · vitest.

## Running it

```bash
npm install
npm run dev          # real mode — needs .env.local (see .env.example)
```

```bash
npm run dev:demo     # demo mode on :3100 — seed data, no backend, no sign-in
```

Demo mode is the fastest way to review the product: all four operating systems are switchable
from the sidebar, and the whole study loop works against an in-memory store.

Other scripts: `npm run build`, `npm run lint`, `npm test`, `npm run smoke`.

## Environment

`lib/env.ts` is the single source of truth. With no Supabase keys the app runs in **demo mode**
(seed data, no persistence); the moment real keys are present the same code paths use real auth
and database. AI, YouTube, Stripe and email each degrade independently.

## Database

Migrations live in `supabase/migrations/`, applied in order. Everything is owner-only by default;
coaches, trainers and clubs reach other people only through explicit relationship rows
(`coach_players`, `trainer_athletes`, `org_memberships`), enforced by RLS in Postgres rather than
by the interface.

## Documentation

| Doc | What it holds |
|---|---|
| `docs/MIDO_XI_AUDIT.md` | Point-in-time audit of the codebase against the product specification |
| `docs/MIDO_XI_BUILD_PLAN.md` | Phased implementation plan |
| `docs/MIDO_XI_ARCHITECTURE.md` | Layers, the role system, data access, the knowledge graph, the truth model |
| `docs/MIDO_XI_DESIGN_SYSTEM.md` | "The Film Room" — palette, typography, surfaces, honesty rules |
| `docs/MIDO_XI_AI_SYSTEM.md` | Provider, engines, gating, metering, and what MIDO is never allowed to invent |
| `docs/MIDO_XI_PROGRESS.md` | What has shipped, what was verified, what is next |

## Two rules that shape the whole codebase

1. **No fake functionality.** If a feature cannot be real yet, the architecture is built and the
   screen says plainly what is wired and what is not.
2. **Facts and interpretation never blur.** Verified record is curated by hand; anything a model
   writes is labelled MIDO analysis; anything the user records is labelled as theirs.
