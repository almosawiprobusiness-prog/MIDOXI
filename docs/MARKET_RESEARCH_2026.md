# Market Research — August 2026

What exists, what it costs, and where the gap is. Compiled from current
public positioning; sources at the end. This is the research behind
`MIDO_XI_THESIS.md` — read that for what we conclude from it.

## The market splits into three camps, and none of them closes a loop

### 1. Capture hardware (Veo, Hudl Focus, Trace, Pixellot, zone14, XbotGo)

AI cameras that record and auto-follow matches, sold to **clubs and
academies**, not players. Camera + cloud subscription. Veo is the
balanced entry point for grassroots; Hudl is the legacy leader with the
deepest ecosystem at high-school/college level; Trace is soccer-specific
with GPS-wearable player tracking and auto highlight reels, but its
business model has changed several times.

- **Who pays:** the club. The player is the *subject* of the footage,
  not the owner of the insight.
- **What they own:** the moment of capture.
- **What they don't:** everything after the highlight reel. The footage
  goes into a library; nothing turns it into next Tuesday's training.

### 2. Individual training apps (Techne Futbol, Beast Mode Soccer+, Anytime Soccer)

Drill libraries with streaks and leaderboards, sold to **players and
parents**. Techne owns daily technical plans, touch-counting, and
leaderboard motivation. Beast Mode sells personalized weekly session
calendars ("a full week in under two minutes").

- **Who pays:** the player (or their parents), ~$10–20/mo.
- **What they own:** the drill content and the habit loop.
- **What they don't:** the player's actual football. The plan is not
  derived from last Saturday's match, any film, or any stated goal.
  Every user with the same level gets substantially the same week.

### 3. Coach-side software (CoachNow, MOJO, CoachIQ, MyCantera, Vanta)

Sold to **coaches and private trainers**. CoachNow (~$20–40/mo) owns the
coach↔athlete feedback loop — shared video, annotations, drill library —
but notably **does not handle payments**. CoachIQ's whole pitch is
filling that hole: scheduling + payments + athlete self-booking + a
website builder for private coaches. MOJO packages ready-made practices
for volunteer youth coaches at $59.99/yr.

- **Who pays:** the coach, who re-bills athletes off-platform (CoachNow)
  or on-platform (CoachIQ).
- **What they own:** the coach's admin and comms.
- **What they don't:** the player's own development record. When the
  athlete leaves the coach, the history stays with the coach's account.

## The structural gap

Every product above owns **one arc segment** of a player's week:

| Segment | Owned by | Orphaned output |
|---|---|---|
| Match footage | Veo/Hudl/Trace | a library of clips nobody studies |
| Individual training | Techne/Beast Mode | reps disconnected from matches |
| Coach feedback | CoachNow | notes that die with the relationship |
| Trainer business | CoachIQ | payments with no development record |

Nobody sells the **connective tissue**: match → film → development goal
→ study → training that targets the goal → performance evidence → a
memory of the player that compounds → the next best action. That loop is
MIDO XI's existing architecture (event log, recommendation engine, NBA
scorer, player memory) — the market gap and the codebase are already the
same shape.

## Pricing reality check

- Player-paid ceiling for software-only: ~$15–25/mo (Techne/Beast Mode
  band). MIDO XI's Player tier sits inside it.
- Coach/trainer-paid ceiling is higher (~$40/mo CoachNow top tier, more
  for CoachIQ) **because it's a business expense** — the trainer re-bills
  it. Touchline/Club tiers are priced against this band, and a Trainer OS
  with payments competes with CoachIQ's core wedge.
- Hardware players anchor club budgets in the thousands/yr; we do not
  compete there, we ingest their output (a Veo/YouTube link is already a
  first-class Film Room input).

## What the incumbents teach us (adopted into FEATURE_DECISIONS)

1. **Techne's lesson:** streaks and visible volume (touches, minutes)
   drive weekly retention for teenage players. We have the data spine
   for this and under-display it.
2. **Trace's lesson:** auto-generated *individual* highlight reels are
   the single feature players evangelize. Our capture extension +
   study captures are the software-only analogue.
3. **CoachNow's lesson:** annotation-on-video is table stakes for the
   coach relationship (we have annotations, migration 0030).
4. **CoachIQ's lesson:** private trainers will switch platforms for
   integrated payments alone. Stripe Connect is the wedge for Trainer OS.
5. **MOJO's lesson:** volunteer-coach content is a race to the bottom on
   price ($60/yr). We should not compete on drill libraries.

## Sources

- [Veo — sports video camera systems compared (2026)](https://www.veo.com/en-us/article/sports-video-camera-systems-compared)
- [zone14 — best football cameras 2026](https://zone14.ai/en/blog/football-cameras/the-5-best-cameras-for-football-video-analysis-2026/)
- [LevelUp.soccer — Veo vs Hudl vs Trace](https://levelup.soccer/learn/video-analysis-systems)
- [Trace — AI sports cameras for youth games 2026](https://traceup.com/academy/best-ai-sports-cameras-for-automatically-recording-youth-games-in-2026)
- [FSI — best football analysis software 2026](https://fsi.training/en/blogs/best-football-analytics-tools-2026)
- [a-champs — 5 best soccer training apps 2026](https://a-champs.com/blogs/magazine/5-best-soccer-training-apps-2026)
- [Cybernews — best soccer training apps](https://cybernews.com/health-tech/best-soccer-training-apps/)
- [Beast Mode Soccer+](https://beastmodesoccer.com/plus/)
- [Capterra — CoachNow pricing](https://www.capterra.com/p/196441/CoachNow/)
- [CoachIQ — best sports coaching software 2026](https://www.coachiq.io/blog/best-sports-coaching-software)
- [Anytime Soccer — 7 best soccer coaching apps](https://anytime-soccer.com/7-best-soccer-coaching-apps/)
- [Hobbit AI — best soccer coaching apps 2026](https://hobbit.football/tools/best-soccer-coaching-apps)
- [MyCantera — best AI tools for soccer coaches 2026](https://mycantera.com/blog/best-ai-tools-soccer-coaches-2026)
