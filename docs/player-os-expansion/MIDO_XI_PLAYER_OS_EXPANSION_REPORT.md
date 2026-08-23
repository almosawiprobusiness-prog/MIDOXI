# MIDO XI — Player OS expansion report

Research, feasibility and prioritisation. Nothing in here has been built.

**Companion documents**
- [`CURRENT_STATE.md`](CURRENT_STATE.md) — what exists today, feature by feature
- [`VIDEO_INTELLIGENCE.md`](VIDEO_INTELLIGENCE.md) — video AI feasibility and cost
- [`INTEGRATIONS.md`](INTEGRATIONS.md) — every integration, ranked, with the blockers
- [`EXPANSION_MATRIX.md`](EXPANSION_MATRIX.md) — 28 features scored
- [`GAME_CHANGERS.md`](GAME_CHANGERS.md) — the five that matter
- [`REPORT_ENGINE.md`](REPORT_ENGINE.md) — documents, sharing, privacy
- [`PLAYER_DATA_2.md`](PLAYER_DATA_2.md) — the data model that unlocks the rest

---

## 1 · Executive summary

The Player OS is more complete than it looks and less connected than it should
be. Matches, film, development, study, training, check-ins and AI all exist and
all work. What doesn't exist is **any relationship between them**. The player is
the integration layer, and that is a job people quit within a month.

Three findings shaped everything below.

**Video AI is real, cheap, and blocked by the wrong thing.** Native video
understanding costs about five cents for a full match. The obstacle is not
inference cost, model quality or latency — it is that no model can reliably tell
which player on an amateur pitch is *you*, and bandwidth costs eight times more
than the analysis does. Both point at the same answer: **clips, not matches.**

**The integrations everyone asks for are the ones you can't get.** Apple Health
and Health Connect require a native app; MIDO is web-only. Garmin is
partner-only with sign-ups suspended. Veo's API is credential-gated behind a
partnership. Meanwhile calendar sync — unglamorous, trivially available — is
worth more to a player's weekly life than all of them.

**The highest-leverage thing in this research is a database view.** A
chronological player timeline over tables that already exist. It costs one query
and a few indexes, and it is the foundation of reports, memory, career mode,
and the loop that makes the product compound.

The recommendation is not to expand the Player OS outward into new features.
It is to **wire the existing features into a loop**, and to make video good
enough to feed it.

## 2 · Current state — the honest version

Full detail in [`CURRENT_STATE.md`](CURRENT_STATE.md). The findings that matter:

- **Video analysis is thinner than the schema suggests.** It captures 12 JPEG
  stills over a ≤24-second range in the browser and reasons over those. It is
  presented as frame analysis, and it is — but stills cannot see motion, and
  football is motion.
- **No i18n, no PDF, no email, no job queue, no vector store.** Twelve
  dependencies total. That leanness is an asset, and it also means every item in
  §7 that needs one of those is a first-of-its-kind addition.
- **The truth model (`verified` / `analysis` / `observation`) is enforced in the
  AI layer and absent from the database.** [`PLAYER_DATA_2.md`](PLAYER_DATA_2.md)
  closes that.
- **AI cost controls are genuinely good** — tiered routing, prompt caching,
  per-user metering, a global ceiling. Video will not break them.
- The knowledge graph, capability registry and honest-refusal paths are strong
  and underused.

## 3 · Video AI — the verdict

Full analysis in [`VIDEO_INTELLIGENCE.md`](VIDEO_INTELLIGENCE.md).

**Yes — for clips. Not yet for full matches. Never for tracking data.**

| | Verdict |
|---|---|
| Frame-by-frame breakdown of a 30–90s clip | **Build it.** Native video, ~$0.001/clip |
| Tactical read of a phase of play | **Build it.** This is where the value is |
| "What did *I* do here" on amateur footage | **With a hint.** Player states kit/number, or marks themselves once |
| Full 90-minute match analysis | **Later.** $0.05 to analyse, $0.40/view to serve, needs a queue |
| Distance covered, sprints, heatmaps from video | **No.** That is a tracking pipeline, not a prompt |
| Automatic highlight detection | **Later.** Feasible; not the first thing worth doing |

The three claims to never make: that MIDO measures physical output from video;
that it identifies players reliably without help; that it produces
provider-grade event data. All three are things a competitor's marketing says and
none are true of any system a small team can build.

What makes this honest rather than limiting: MIDO already has the vocabulary for
it. `observed` / `inferred` / `uncertain` markers exist, the capability registry
already declines things it can't do, and the metering is built. The video upgrade
is a provider swap into infrastructure that was designed for it.

## 4 · Top five game changers

Full write-ups in [`GAME_CHANGERS.md`](GAME_CHANGERS.md).

1. **The closed loop** — video observation → development goal → study → session →
   next video checks the same thing. Nothing else on the market connects these.
2. **Native clip video understanding** — replace 12 stills with the actual clip.
3. **The player timeline** — one chronological spine; a view over existing data.
4. **Durable player memory** — MIDO stops re-reading and starts remembering.
5. **The report engine** — the first thing a player can hand to a coach.

They share one property: each makes the next month of use more valuable than the
last. That is the only moat a development app can have.

## 5 · Top five integrations

Full ranking in [`INTEGRATIONS.md`](INTEGRATIONS.md).

1. **Calendar (Google / ICS)** — highest frequency of anything researched, trivial
   to build, no partnership required.
2. **Smart import** — photograph a team sheet, a stats screenshot, a training
   plan. This is an AI feature wearing an integration's clothes, and it beats
   every API here because it works with whatever the player already has.
3. **WHOOP / Oura** — self-serve APIs, real recovery data, feeds check-ins.
4. **Video platform export (Veo / Hudl) via file, not API** — the player already
   downloads clips. Accept the file; skip the partnership.
5. **Email/notification out** — technically an integration and worth more than
   most: a product with no way to reach the player has no way to bring them back.

Explicitly blocked, do not plan around: **Apple Health and Health Connect**
(native app required), **Garmin** (partner-only, applications suspended),
**official match-data providers** (enterprise pricing, no amateur coverage).

## 6 · Biggest product opportunity

**The development record.**

Not a feature — the thing all five game changers assemble into. A continuous,
sourced, evidenced account of a player's football development, held over years,
that they own and can show to anybody.

Nothing on the market holds this. Hudl and Veo hold video. Wearables hold load.
Coaching apps hold sessions. Spreadsheets hold statistics. **Nobody holds the
narrative of a player getting better**, with the evidence attached and the
provenance intact.

It is the retention story (two seasons of record is unleavable), the revenue
story (the output is tangible and worth paying for), and the distribution story
(the record leaves the app, branded, and lands in front of coaches).

Everything in §7 is either a way to feed that record or a way to get it out.

## 7 · Twenty-two further opportunities

Not in the brief. Ranked by what they'd be worth against what they'd cost.

1. **Voice match logging.** Two minutes after full time, spoken. Text entry after
   a match is the single biggest data-loss point in the product.
2. **The 30-second check-in.** Not a form — one question, chosen by MIDO based on
   what it wants to know this week.
3. **Opponent memory.** "You've played them three times. Both goals came from
   their left back stepping in." Uses only data the player already entered.
4. **Position-change coaching.** Moving from 8 to 6 is a common youth event with
   no support anywhere. The knowledge graph already has the concepts.
5. **The pre-match brief.** Kickoff time from the calendar, readiness from
   check-ins, focus from goals. One card, morning of.
6. **Injury return pathway.** Structured return-to-play, with the record of the
   absence. Currently the app can't even represent "out".
7. **Trial preparation mode.** A trial in nine days is the highest-intent moment
   in a young player's year, and nothing in the app knows it's happening.
8. **The weekly question.** One thing MIDO doesn't know, asked once a week.
   Fills the profile without a form and feeds memory.
9. **Parent view.** Read-only, permission-scoped. Parents pay for youth football,
   and there is currently no product surface for them at all.
10. **Coach-invites-player.** Distribution: a coach on Touchline is a channel to
    twenty players. Referrals exist; this is the specific high-value shape.
11. **Session-to-goal linking.** Training with no connection to development is
    just attendance.
12. **The "what changed" digest.** Monthly, honest: what moved, what didn't,
    what the evidence actually says.
13. **Film study streaks.** Deliberately last on the gamification list, and the
    only one worth doing — it rewards a behaviour that genuinely helps.
14. **Set-piece library.** Personal, position-specific. High engagement, tiny
    build.
15. **Boot / kit log.** Trivial, and players care enormously. A pinned surface
    that costs nothing.
16. **Compare-to-self.** This month against three months ago. All the value of a
    comparison engine, none of the invented benchmarks.
17. **Match-day timeline.** Wake, meal, arrival, warm-up. A routine tool for
    players who don't have one and don't know they need one.
18. **Highlight reel assembly.** From clips the player already marked. The manual
    version is a week of work; the automatic version is a research project.
19. **Coach's one-liner.** Ask the coach one question after a match. Structured
    external feedback at nearly zero friction.
20. **Study → drill.** Every curated study should end with something to do
    tomorrow. The graph already links them.
21. **Season goal setting, September.** An annual ritual that anchors twelve
    months of use, and a natural renewal moment.
22. **Export everything.** Full data export, structured. Cheap trust, and it
    makes the record feel genuinely owned.

The pattern in this list: **almost none of it needs new data.** It needs the data
already collected to be connected, remembered, and asked about at the right time.

## 8 · Don't build

- **Full-match video in V1.** Serving cost dominates, player ID is unsolved,
  and it needs a job queue the app doesn't have.
- **Any physical metric derived from video.** Distance, sprints, top speed,
  heatmaps. Not possible at this scale, and claiming it would break the product's
  own rules.
- **Multilingual before choosing a market.** Highest frequency score in the
  matrix and still wrong now — it multiplies the cost of everything built after.
- **Comparison against other players or "average" benchmarks.** There is no
  honest amateur dataset to compare against, and inventing one is exactly the
  fake-statistics failure the product exists to avoid.
- **Multi-agent AI architecture.** An implementation detail sold as a feature.
- **Social feed / community expansion.** Attention away from development, and
  moderation liability on a platform with minors.
- **Garmin, Apple Health, Health Connect.** Blocked by platform, not by effort.
- **Own-build computer vision tracking.** A company, not a feature.
- **Gamification beyond study streaks.** Points for logging produce logged
  points, not better footballers.

## 9 · Next implementation sprint

Two weeks, in dependency order. Every item is small; the sequence is what makes
it worth more than the sum.

**Week 1 — the spine**
1. `player_timeline` view + indexes *(1 day)*
2. Timeline UI in the Player OS *(2 days)*
3. Native video for clips — provider swap, 30–90s, identity hint *(2 days)*

**Week 2 — the loop**
4. Observation → concept → development goal mapping, player-confirmed *(2 days)*
5. Re-check: prior observations passed as context to the next clip *(1 day)*
6. Print stylesheet + monthly development report route *(2 days)*

**What that produces:** a player uploads a clip, gets timestamped observations,
confirms one against a development goal, sees it land on their timeline, and at
month end prints a report showing what changed and what the evidence was.

That is the whole product thesis, running end to end, in ten days of work — and
it's mostly connecting things that already exist.

**Deferred to the sprint after:** player memory, share links, smart import,
calendar. All good; none of them are load-bearing for the loop.

## 10 · A week, once this exists

*Written to show the shape, not to promise it.*

**Sunday, 20:40.** The match finished four hours ago. He opens MIDO on the bus
home and talks for ninety seconds — 68 minutes, right eight, the goal came off a
turnover he was late reacting to. It's logged before he's home.

**Monday, 07:50.** Readiness 61. MIDO doesn't tell him to rest; it says his last
three Mondays after 60+ minutes have all looked like this, and suggests the
session he's got planned would go better Tuesday.

**Monday, 19:00.** He uploads forty seconds from the second half. Four
observations come back with timestamps. Two he already knew. The third —
*receives with his body closed at 0:22, forward pass unavailable before the first
touch* — is the fourth time this has come up since April. MIDO says so, and shows
him the other three.

**Tuesday.** He confirms it against **Scanning before receiving**. It attaches as
evidence. A Rodri clip and an eighteen-minute rondo turn up alongside it.

**Wednesday.** Training. The session is in his calendar because MIDO put it
there. He tags it to the goal afterwards — one tap.

**Saturday, 16:20.** Different match, and he uploads a clip specifically to check
the same thing. MIDO knows to look. *Shoulder check at 0:11, before the ball
arrives. This is the first clip where that appears.*

**Sunday.** Month end. He prints the development report — four goals, the
evidence under each, eleven matches, 740 minutes, the film observations in order.
He sends it to his coach, who has never once seen a player do this.

None of that week requires a technology that doesn't exist. It requires the
things in this document to be connected to each other.

---

## 11 · Risks

**The player-identification problem is permanent.** Mitigations reduce it; they
don't remove it. If MIDO ever confidently describes the wrong player, trust is
gone in one screenshot. Every uncertain read must say it's uncertain.

**Storage and egress grow without bound.** Video is 40× the size of everything
else combined. Retention limits and a per-tier storage cap belong in V1, not in
the invoice that discovers the problem.

**The loop can be wrong.** Auto-linking an observation to the wrong concept is
worse than not linking. Player-confirmed, always reversible.

**Provider dependency.** Native video means a specific model family. The provider
interface already exists — keep it real, and keep a second provider viable.

**Youth data leaving the platform.** Reports and share links are the highest-risk
surface in the product. Minimal by default, expiring, revocable.

---

Nothing here is built. The next step is a decision about §9.
