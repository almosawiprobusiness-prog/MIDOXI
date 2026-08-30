# The MIDO XI Thesis

**One sentence:** every competitor owns a segment of a player's week;
MIDO XI owns the loop that connects the segments, and the loop compounds
where segments cannot.

## The loop is the product

```
MATCH → FILM → DEVELOPMENT → STUDY → AI TRAINING → PERFORMANCE
  → PLAYER MEMORY → NEXT BEST ACTION → MATCH
```

Each arrow is a real, coded transition — an event emitted, a
recommendation scored, a memory consulted — not a navigation link
between unrelated features. The goal of every phase of work is **deeper
interconnection, not more features**. A feature that does not feed the
loop or read from it does not belong in the product (see
`FEATURE_DECISIONS.md` and `docs/fable/PLAYER_OS_CUT_LIST.md`).

## Why the loop wins

1. **Segments churn; loops retain.** A drill app is replaceable by a
   cheaper drill app. A record of *your* football — every match, every
   observation, every goal with its evidence — is not replaceable at
   any price. Switching cost grows with every logged week.

2. **The memory is the moat.** `player_memory` + the event log make
   every AI answer specific to this player's actual record. Techne
   cannot say "fourth clip where this happens." We can, and the code
   already derives such claims arithmetically from evidence — never
   generated, so never fabricated.

3. **Honesty is a feature the incumbents can't copy cheaply.** No
   invented statistics, confidence labels on film observations,
   refusals that name the real limit. Products built on demo-reel AI
   claims cannot retrofit this without breaking their marketing.

4. **The player owns the record.** CoachNow's history dies with the
   coach relationship. In MIDO XI the trainer and coach plug into the
   *player's* OS, not the reverse. This ordering is why Player OS ships
   first and Trainer OS is a later phase.

## Who it is for, in order

1. **The committed amateur/academy player (13–23)** — logs matches,
   wants to improve, pays Player tier or is comped by a trainer.
2. **The private trainer** — runs sessions for those players; pays
   Touchline-band pricing because it's a business expense; brings 10–30
   players with them (the real acquisition channel).
3. **Coach and club** — read-mostly consumers of what players produce,
   via share links and squads. Monetized, never prioritized above the
   player.

## What we refuse to be

- **Not a camera company.** We ingest Veo/YouTube/phone footage; we
  never compete on capture hardware.
- **Not a drill library.** MOJO sells content at $60/yr; content is a
  commodity. Our training sessions are *derived* — from goals, film
  observations, readiness, and memory — which a library cannot be.
- **Not a highlight-reel generator that lies.** Player identity on film
  is unsolved (tested, documented); we cap claims at `inferred` and say
  so. The trust this buys is worth more than the demo.
- **Not a social network first.** Community exists to make the loop
  social (shared studies, squad visibility), not to chase feed
  engagement metrics.

## The elite standard

"Elite" means the product behaves like a top club's staff: it knows the
player's record cold, it never invents, it always has one clear next
action, and everything it asks the player to do traces back to a match
that actually happened. The measure of every release is the beta-gate
question: *could 11 real footballers use this weekly, unexplained, and
trust it with their development?*
