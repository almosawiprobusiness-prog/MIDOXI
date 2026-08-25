import "server-only";
import { listMatches } from "@/lib/data/matches";
import { listGoals } from "@/lib/data/development";
import { listTraining } from "@/lib/data/training";
import { getRecovery } from "@/lib/data/recovery";
import { listMidoEvents } from "@/lib/events/emit";
import { recentlyDismissedKinds } from "@/lib/data/recommendations";
import { toPlayerSignals, EVENT_WINDOW_DAYS } from "./signals";
import type { PlayerSignals } from "./next-best-action";

/*
  The fetching half, kept apart from the mapping on purpose.

  `toPlayerSignals` is pure so the date arithmetic can be tested by
  stating a situation rather than mocking four adapters. That only works
  if it is reachable from a test — and a module carrying
  `import "server-only"` is not. Splitting the file is what makes the
  separation real rather than nominal.
*/

/**
 * Read everything the scorer needs for the signed-in player.
 *
 * Never throws: a signal that cannot be read becomes an absent signal,
 * and the scorer already knows how to say "MIDO needs more information"
 * rather than guessing. A dashboard must not fail because one adapter
 * is unhappy.
 */
export async function buildPlayerSignals(now: Date = new Date()): Promise<PlayerSignals> {
  const since = new Date(now.getTime() - EVENT_WINDOW_DAYS * 86_400_000).toISOString();

  const [matches, goals, training, recovery, events, dismissedKinds] = await Promise.all([
    listMatches().catch(() => []),
    listGoals().catch(() => []),
    listTraining().catch(() => []),
    getRecovery(30).catch(() => null),
    listMidoEvents({
      types: ["STUDY_COMPLETED", "FILM_OBSERVATION_CREATED"],
      since,
      limit: 100,
    }).catch(() => []),
    // Closes the dismissal loop: the scorer halves what was waved away.
    recentlyDismissedKinds(now).catch(() => []),
  ]);

  return toPlayerSignals(
    {
      matches: matches.map((m) => ({ id: m.id, date: m.date, reviewed: m.reviewed })),
      goals: goals.map((g) => ({ id: g.id, title: g.title, status: g.status })),
      training: training.map((t) => ({ scheduledAt: t.scheduledAt })),
      checkins: (recovery?.days ?? []).map((d) => ({ date: d.date, readiness: d.readiness })),
      events: events.map((e) => ({
        type: e.type,
        occurredAt: e.occurredAt,
        payload: e.payload,
      })),
      dismissedKinds,
    },
    now,
  );
}
