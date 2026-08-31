import "server-only";
import { listMatches } from "@/lib/data/matches";
import { listTraining } from "@/lib/data/training";
import { listGoals } from "@/lib/data/development";
import { getProfileSettings } from "@/lib/data/profile";
import {
  type PublishTemplate,
  type MatchCardData,
  type TrainingCardData,
  type DevelopmentCardData,
  type SeasonCardData,
  type PublishIdentity,
} from "./types";

/*
  MIDO PUBLISH — the data adapters.

  Every template's data is assembled here by WHITELIST: each adapter
  names exactly the fields its artifact shows, and nothing else can
  reach a template because nothing else exists on the returned object.
  No adapter ever spreads a source object — that is the construction
  that makes "private information cannot leak into a share card" a
  property of the code rather than a promise.

  What is deliberately absent: email, date of birth, nationality,
  height/weight, location, private notes, film observation text, AI
  reasoning, health/readiness figures. Reports have field-level opt-in
  for some of those; Publish does not — a social card never needs them.

  Only real logged numbers. No invented "performance score".
*/

async function identity(): Promise<PublishIdentity> {
  const p = await getProfileSettings();
  return {
    name: p.knownAs || p.fullName || "Player",
    position: p.primaryPosition || "",
    club: p.club || "",
    squadNumber: p.squadNumber,
    // The one image on a card: the player's own public avatar. Still a
    // whitelist — the URL points at the public avatars bucket, nothing else.
    avatarUrl: p.avatarUrl || null,
  };
}

export async function buildMatchCard(): Promise<MatchCardData | null> {
  const [id, matches] = await Promise.all([identity(), listMatches()]);
  const m = matches[0];
  if (!m) return null;
  return {
    identity: id,
    opponent: m.opponent,
    competition: m.competition,
    date: m.date.slice(0, 10),
    home: m.home,
    goalsFor: m.goalsFor,
    goalsAgainst: m.goalsAgainst,
    minutes: m.minutes,
    goals: m.goals,
    assists: m.assists,
    rating: m.rating > 0 ? m.rating : null,
  };
}

export async function buildTrainingCard(): Promise<TrainingCardData | null> {
  const [id, sessions] = await Promise.all([identity(), listTraining()]);
  const s = sessions.find((x) => x.durationMin || x.rpe != null) ?? sessions[0];
  if (!s) return null;
  return {
    identity: id,
    title: s.title,
    kind: s.kind,
    durationMin: s.durationMin ?? null,
    rpe: s.rpe ?? null,
    objective: s.objective || null,
    blocks: (s.plan ?? []).slice(0, 5).map((b) => ({ name: b.name, work: b.work })),
  };
}

export async function buildDevelopmentCard(): Promise<DevelopmentCardData | null> {
  const [id, goals] = await Promise.all([identity(), listGoals()]);
  const active = goals.filter((g) => g.status !== "achieved");
  if (!active.length) return null;
  return {
    identity: id,
    goals: active.slice(0, 3).map((g) => ({
      title: g.title,
      progress: g.progress,
      evidence:
        g.evidence.clips + g.evidence.training + g.evidence.study + (g.evidence.matches ?? 0),
    })),
  };
}

export async function buildSeasonCard(): Promise<SeasonCardData | null> {
  const [id, matches] = await Promise.all([identity(), listMatches()]);
  if (!matches.length) return null;
  const totals = matches.reduce(
    (a, m) => ({
      minutes: a.minutes + (m.minutes || 0),
      goals: a.goals + (m.goals || 0),
      assists: a.assists + (m.assists || 0),
    }),
    { minutes: 0, goals: 0, assists: 0 },
  );
  const outcome = (m: (typeof matches)[number]) =>
    m.goalsFor > m.goalsAgainst ? "W" : m.goalsFor < m.goalsAgainst ? "L" : "D";
  const record = matches.reduce(
    (a, m) => {
      a[outcome(m)]++;
      return a;
    },
    { W: 0, D: 0, L: 0 } as Record<"W" | "D" | "L", number>,
  );
  return { identity: id, matches: matches.length, record, ...totals };
}

export async function buildTemplateData(template: PublishTemplate) {
  switch (template) {
    case "match":
      return buildMatchCard();
    case "training":
      return buildTrainingCard();
    case "development":
      return buildDevelopmentCard();
    case "season":
      return buildSeasonCard();
  }
}
