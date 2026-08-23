# Integrations — ranked by real feasibility

Researched 2026-08-22. The ranking is driven by what is actually obtainable, not
by what would be nice.

## The constraint that decides most of this

**MIDO XI is a web app. Apple Health and Health Connect are on-device APIs that
require a native app.** There is no server-to-server Apple Health API. Any
roadmap that assumes "import from Apple Health" is really proposing an iOS app.

That single fact removes the two largest wearable ecosystems from Tier 1 and
should be stated plainly before anyone plans around them.

## Tier 1 — build these

### 1. Calendar (Google / Outlook, CalDAV for Apple)
**Data:** training times, fixtures, gym, school, travel.
**Why it matters most:** the briefing already answers "what needs me today" but
is blind to the player's actual week. Schedule context turns a good briefing into
the reason they open the app. It also makes every recommendation load-aware —
"you have a match in 4 days and training tonight" changes the answer.
**Feasibility:** OAuth 2.0, well-documented, free, no approval. **Easy.**

### 2. Manual/CSV import + smart import
**Data:** whatever the player already has — a coach's spreadsheet, a fitness
test PDF, a screenshot of match stats.
**Why:** it works with *every* provider without a single partnership, including
the ones that will never give access. A photo of a whiteboard parsed into a
training session is worth more than a Garmin integration nobody is approved for.
**Feasibility:** already have a multimodal model. **Easy.** Highest value per
unit of effort in this list.

### 3. YouTube (deepen the existing one)
**Data:** the player's own uploads, unlisted match footage.
**Why:** most amateur footage already lives there, and importing by URL avoids
the storage and egress costs that dominate the video model.
**Feasibility:** already integrated for search; extend to import. **Easy.**

## Tier 2 — worth doing, in order

### 4. WHOOP
Self-serve developer access, OAuth. Sleep, recovery, strain, HRV. Genuinely
useful for football load management and the audience skews serious.

### 5. Oura
Self-serve, OAuth, good sleep and readiness data. Same shape as WHOOP.

### 6. Strava
OAuth, but **restructured in June 2026**: the standard tier caps at 10 users
without approval and requires the developer to hold a Strava subscription.
Access tokens expire in 6 hours. Fine for a pilot, a real constraint at scale.

## Tier 3 — blocked, partner-gated, or low value

### Garmin — **currently blocked**
Partner-approval only, no self-serve key, and as of 2026 new sign-ups are
reportedly on hold with the request form removed. Do not plan around it.

### Veo / Hudl / Trace
Veo does publish an API (videos, users, groups, comments, transcripts) but access
is issued per-environment via client ID and secret — a partnership, not a signup.
Strategically the most interesting integration in football video: it would give
MIDO real tracking data and let players import footage they already have.
**Pursue as a partnership conversation, not an engineering task.**

### STATSports / Catapult / Playermaker
Enterprise GPS. No public API worth planning against. A club buys these; a player
rarely owns the data. **Accept CSV export instead** — that is how players
actually get their numbers out.

### Match data providers (Opta, Wyscout, Sportmonks, StatsPerform)
Licensed, expensive, and overwhelmingly weighted to professional leagues. MIDO's
users are academy and amateur — the fixtures simply are not covered. Sportmonks
is the cheapest route if fixture auto-population is ever wanted, but the coverage
question kills it for the target user.

### Social auto-posting
Instagram and TikTok do not offer free automated posting for this use case.
**Generate the image, let the player post it.** That is also better product —
they choose the caption and the moment.

## Tier 4 — ignore for now

Fitbit (declining, Google-absorbed), Polar (small share), cloud storage
(Drive/Dropbox — the upload flow already covers this), Apple Health and Health
Connect (until there is a native app).

## The honest summary

The wearable integrations everyone asks for are the ones that are hardest to get
and the least differentiating. **Calendar and smart import are easy, unglamorous,
and worth more than all the wearables combined**, because they attack the actual
friction: MIDO does not know what the player's week looks like, and getting data
in is tedious.
