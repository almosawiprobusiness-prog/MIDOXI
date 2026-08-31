# Founding Player Beta — plan, definitions, success and failure

Written BEFORE results, 2026-08-31, so the results cannot bend the bar.

## Who
A small group of serious players: train outside team sessions, watch
football intentionally, have footage or study habits, will use MIDO
repeatedly and say where it fails. Behavior over signups. No mass
onboarding, no marketing.

## Access
Existing signup at mido11.com is open; no allowlist needed at this
scale. The owner sends invites personally. Admin visibility is the
Founding XI dashboard (/app/admin/beta — gated by MIDO_ADMIN_EMAILS),
which already shows per-player core-loop progress, feature reach, the
NBA funnel, AI health, and the feedback inbox with triage.

## First session success (minimum)
Create profile → set one development focus (or accept a suggested
goal) → see the Locker's Next Best Action → complete ONE meaningful
action (a study, a training log/draft, film added + one observation).
Nothing requires configuring the whole OS first.

## TIME_TO_FIRST_VALUE
signup (auth.users.created_at) → first MEANINGFUL event, defined as any
of: study_completed, training_completed, training_generated,
film_uploaded, annotation_saved, clip_created, vision_quick_read,
vision_deep_read, film_observation_filed, goal_created, match_logged,
community_post_created. Page views and avatar changes deliberately
excluded. Measured with the queries in docs/beta/FOUNDING_XI_METRICS.md.

## ACTIVATION (definition)
A player is ACTIVATED when they have completed **two meaningful events
across two different surfaces** (surface = the event's family: study,
training, film/vision, match, development, community). Example:
film_uploaded + training_completed. Rationale: one action is curiosity;
two surfaces is the loop starting.

## RETENTION (definition)
Day buckets D1/D3/D7/D14/D30 from signup. Two tiers, reported
separately: **returned** (any product_analytics event that day) and
**worked** (a meaningful event as defined above). The primary number is
WORKED retention; login-only days count for nothing.

## SUCCESS SIGNALS (pre-committed)
- At least half of founding players activate within 7 days without
  hand-holding beyond the invite.
- Players return to do meaningful work (worked-D7 above zero for most;
  unprompted worked-D14 is a strong signal at this scale).
- Some players connect surfaces: film_observation_filed, study →
  training, or NBA completed followed by a meaningful event.
- training_generated → training_completed conversion is real — drafted
  sessions get done, not admired.
- Vision corrections stay rare relative to reads, and abstention is
  accepted rather than complained about.
- The NBA completed-to-dismissed ratio does not collapse toward
  all-dismissed.
- At least one player names a specific capability they would miss.

## FAILURE SIGNALS (equally pre-committed)
Signups with zero meaningful events; one-shot Vision tourism (reads
with no downstream action); training drafted but never completed;
players needing repeated explanation; "feels like homework" feedback;
community silent because posting development publicly feels wrong.
Each of these is a FINDING to report, not to hide.

## The two beta questions (asked personally, never automated)
After genuine usage — never the first session, never repeatedly:
1. "If MIDO XI disappeared tomorrow, what part would you actually miss?"
2. Later: "What still feels like work?"
Log the answers verbatim as triage notes on the feedback inbox.

## Friction watchlist (a query exists for each)
study_started without study_completed; training_generated without
training_completed; film_uploaded with no read or annotation; vision
reads with no filed observation; recommendation_dismissed streaks;
community opened but never posted (reach table); publish_exported never
repeated.

## Beta operating loop
player uses MIDO → data (product_analytics + beta_feedback) → identify
problem → verify (reproduce or query) → fix (only under RC1's change
policy) → measure again. New ideas go to BETA_BACKLOG.md, not to
production.
