# Game changers

Five. Not twenty. Everything else in this research is good product work; these
are the things that would make MIDO XI structurally different from anything else
a footballer can buy.

They share a property: **each one makes the next month of use more valuable than
the last.** That is the only durable moat a development app can have.

---

## 1 · The closed loop — video observation becomes a development goal becomes training becomes the next video

**Problem.** Every football app is a filing cabinet. Video sits in one drawer,
goals in another, training in a third. The player is the integration layer, and
they stop doing that job within a month.

**Solution.** An observation from a video is not a note. It is an event that
attaches to a development goal, moves its progress, pulls a curated study, and
generates a session — and the next video the player uploads is checked against
that same concept.

**Experience.**
> Clip from Saturday, 0:42 — *"Receives with body closed to the touchline; the
> forward pass is unavailable before the first touch."* `observed`
>
> This is your goal **Scanning before receiving** — 3rd piece of evidence.
> → Study: Rodri, *Receiving on the half-turn*
> → Session: *Body-shape rondo*, 20 min
> → Next clip you upload, MIDO checks this first.

**Why it matters.** It is the only feature here that gets better with use.
Twenty observations against one concept is a coaching record no other tool holds.

**Competitors.** Hudl and Veo store and clip video. Nobody connects an
observation to a development plan and closes the loop.

**Technical.** Mostly assembly: `clip_analyses.observations` already carries
timestamped items; `development_evidence` already accepts `kind: 'film'`; the
knowledge graph already maps concepts to drills and people. The missing piece is
a mapper from observation → concept → goal, and a *re-check* prompt that passes
prior observations as context.

**Cost.** Under a cent per clip. **Risk:** mapping wrongly is worse than not
mapping — every link must be reviewable and reversible by the player.

**MVP.** Clip analysis suggests a concept; the player confirms; it attaches as
evidence. **Long term:** MIDO tracks whether the behaviour changed across clips
and says so.

---

## 2 · Native video understanding for clips

**Problem.** MIDO currently reads 12 still frames over ≤24 seconds. Football is
motion. Stills cannot see a shoulder check *before* a pass, and that is exactly
the kind of thing worth seeing.

**Solution.** Send the clip itself. Models now sample at 1 fps, reason across
time, and answer about specific timestamps.

**Experience.** Upload a 45-second clip, name what you want looked at, get five
timestamped observations, each marked `observed` / `inferred` / `uncertain`.

**Why it matters.** It converts the most-requested feature from a demo into a
tool, and it is the input to everything in #1.

**Technical.** Replace the frame-capture path with a native video call. The
provider interface, the confidence markers, the metering and the honest gates all
already exist and were built for this.

**Cost.** $0.0009 for 30 seconds. Storage and egress dominate, not inference.

**Risk — and the honest limit.** Identifying *which player is you* is unsolved on
amateur footage. Mitigate by asking ("number 9, blue") or having the player mark
themselves once. On anything ambiguous, say so.

**MVP.** Clips only, 30–90s, player-identity hint in the prompt.

---

## 3 · The player timeline

**Problem.** A player's football history is scattered across nine tables and
visible nowhere. After a season of use, MIDO can't show them what happened.

**Solution.** One chronological spine — matches, training, check-ins, clips,
observations, studies, goals reached, tests — assembled from data already stored.

**Experience.**
> **20 Aug** · Match vs Lakeville · 70 min, 1 assist
>  ↳ 3 clips uploaded · 2 observations · *Scanning* +1 evidence
> **21 Aug** · Readiness 62 — *manage load* · Rodri study, 18 min
> **22 Aug** · Striker session, 45 min

**Why it matters.** It is the switching cost. A player with two seasons of
timeline does not start again somewhere else. It also makes every report and
share generate itself from one source.

**Technical.** A union query over existing tables plus one index. **No new data
model.** Cheapest item in this document by a distance.

**Risk.** Almost none. **MVP:** last 90 days, filterable.

---

## 4 · Durable player memory

**Problem.** MIDO reassembles context from SQL on every call. It does not
*remember* — it re-reads. A player who explained an ankle problem in March gets
asked again in April.

**Solution.** A written memory of stable facts: recurring weaknesses, what has
been tried, coach feedback, constraints, preferences, what MIDO already
recommended and whether it was taken.

**Experience.** Over months the recommendations narrow and stop repeating things
that didn't work. *"You've tried this twice — let's approach it differently."*

**Why it matters.** It is the difference between a tool that answers and one that
knows you. It is also what makes the product thesis true: *does this understand
my football life better than anything else I use?*

**Technical.** A `player_memory` table of typed facts with provenance and
recency, injected into system prompts — which are already cached, so the marginal
cost is near zero. A vector store is **not** needed at this scale; typed rows are
more honest and more debuggable.

**Risk.** Memory that is wrong is worse than no memory. Every fact must be
visible and editable by the player. **MVP:** MIDO proposes a memory, player
confirms.

---

## 5 · The report engine

**Problem.** A player cannot show anyone what they have done. No CV, no
development report, nothing to send a coach, a trial, or a parent. Everything is
locked behind a login.

**Solution.** One engine, many documents, all generated from the timeline and
profile: monthly development report, match report, player profile, trial CV.
Branded, field-level privacy control, shareable by expiring link.

**Experience.** *"Send my July development report to my coach"* → a document
that looks like it came from a performance department, with the player choosing
what appears.

**Why it matters.** It is the strongest **revenue and distribution** feature
here. Reports leave the app with MIDO's name on them, in front of coaches and
clubs. It is also the clearest thing a player will pay for — the output is
tangible.

**Technical.** No PDF library exists yet. Server-rendered HTML → PDF is the
right choice: the design system is already built and reusable.

**Cost.** Rendering is negligible. Email needs a provider.

**Risk.** Youth data leaving the platform. Privacy controls are part of the MVP,
not a follow-up — default to minimal disclosure and let the player add fields.

**MVP.** Monthly development report, download only. **Later:** share links,
email, QR profile.

---

## Deliberately not on this list

**Full-match analysis.** Cheap to run, expensive to serve, and it cannot tell
which player is you. Clips first; earn it.

**Multilingual.** Real market expansion, not a game changer, and it multiplies
the cost of everything built after it. Decide the market first.

**Career mode, comparison engine, agent tooling.** Real products, wrong order.
They serve the player who has already got value from the loop above.

**AI agent architecture.** An implementation detail sold as a feature. One MIDO.
