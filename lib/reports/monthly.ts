import "server-only";
import { getTimeline } from "@/lib/data/timeline";
import { getProfileSettings } from "@/lib/data/profile";
import { listGoals, getGoalDetail } from "@/lib/data/development";
import { countByKind, minutesPlayed, type TimelineEntry } from "@/lib/data/timeline-types";
import { listAnalyses } from "@/lib/data/analyses";
import type { AnalysisObservation } from "@/lib/video/provider";
import type { DevelopmentGoal } from "@/lib/types";
import { periodLabel, periodRange } from "./period";

/*
  The monthly development report.

  Assembled entirely from the timeline and the development board — the same
  rows the app shows on screen. That is not an implementation detail, it is the
  guarantee: a report cannot state something the player cannot go and look at,
  because there is nowhere for it to come from.

  Nothing here is generated prose. The numbers are counted, the evidence is
  quoted, and where MIDO's own reading appears it is labelled as MIDO's reading
  with the confidence it was recorded with.
*/

export interface ReportGoal {
  goal: DevelopmentGoal;
  /** Evidence added within the period only — this is a report on a month. */
  evidence: { kind: string; note: string; createdAt: string; concept?: string }[];
}

export interface ReportObservation extends AnalysisObservation {
  videoId: string;
  on: string;
  /** Whether it came from a video read or a stills read. */
  from: "video" | "frames";
}

export interface MonthlyReport {
  source: "demo" | "yours";
  period: string;
  periodLabel: string;
  player: {
    name: string;
    knownAs: string;
    position: string;
    club: string;
    league: string;
    season: string;
    level: string;
    dateOfBirth: string;
    nationality: string;
    heightCm: number | null;
    weightKg: number | null;
    email: string;
    squadNumber: number | null;
    avatarUrl: string;
    transfermarktUrl: string;
  };
  totals: {
    matches: number;
    minutes: number;
    goals: number;
    assists: number;
    started: number;
    sessions: number;
    filmReads: number;
    clips: number;
    studies: number;
    checkins: number;
    evidence: number;
  };
  goals: ReportGoal[];
  goalsReached: TimelineEntry[];
  matches: TimelineEntry[];
  observations: ReportObservation[];
  checkins: TimelineEntry[];
  feedback: TimelineEntry[];
  /** True when the month has nothing in it at all. */
  empty: boolean;
}

/**
 * @param forUser build the report for somebody else, with the service role.
 *
 * Only the public share route passes this, with an id taken from a token it
 * validated. Every adapter below applies an explicit `user_id` filter on that
 * path, because RLS is bypassed and the filter becomes the whole isolation.
 */
export async function getMonthlyReport(period: string, forUser?: string): Promise<MonthlyReport> {
  const { from, to } = periodRange(period);

  const [view, profile, allGoals] = await Promise.all([
    getTimeline({ from, to, limit: 1000, forUser }),
    getProfileSettings(forUser),
    listGoals(forUser),
  ]);

  const entries = view.entries;
  const counts = countByKind(entries);
  const matches = entries.filter((e) => e.kind === "match");

  // Only goals with something in this month, plus anything still open — a
  // report on a month should not list a goal nobody touched, but it should
  // show what is being worked on.
  const evidenceEntries = entries.filter((e) => e.kind === "evidence");
  const touched = new Set(
    evidenceEntries.map((e) => String(e.meta.goalId ?? "")).filter(Boolean),
  );

  const relevant = allGoals.filter((g) => touched.has(g.id) || g.status === "active");
  const goals: ReportGoal[] = await Promise.all(
    relevant.map(async (g) => {
      const detail = await getGoalDetail(g.id, forUser);
      const inPeriod = (detail?.evidence ?? []).filter(
        (e) => e.createdAt >= from && e.createdAt <= to,
      );
      return {
        goal: g,
        evidence: inPeriod.map((e) => ({
          kind: e.kind,
          note: e.note,
          createdAt: e.createdAt,
        })),
      };
    }),
  );

  const observations = await observationsIn(entries, from, to, forUser);

  return {
    source: view.source,
    period,
    periodLabel: periodLabel(period),
    player: {
      name: profile.fullName,
      knownAs: profile.knownAs,
      position: profile.primaryPosition,
      club: profile.club,
      league: profile.league,
      season: profile.season,
      level: profile.level,
      dateOfBirth: profile.dateOfBirth,
      nationality: profile.nationality,
      heightCm: profile.heightCm,
      weightKg: profile.weightKg,
      email: profile.email,
      squadNumber: profile.squadNumber,
      avatarUrl: profile.avatarUrl,
      transfermarktUrl: profile.transfermarktUrl,
    },
    totals: {
      matches: matches.length,
      minutes: minutesPlayed(entries),
      goals: sum(matches, "goals"),
      assists: sum(matches, "assists"),
      started: matches.filter((m) => m.meta.started !== false).length,
      sessions: counts.training,
      filmReads: counts.analysis,
      clips: counts.clip,
      studies: counts.study + counts.study_session,
      checkins: counts.checkin,
      evidence: counts.evidence,
    },
    goals: goals.sort((a, b) => b.evidence.length - a.evidence.length),
    goalsReached: entries.filter((e) => e.kind === "goal_reached"),
    matches,
    observations,
    checkins: entries.filter((e) => e.kind === "checkin"),
    feedback: entries.filter((e) => e.kind === "feedback"),
    empty: entries.length === 0,
  };
}

function sum(entries: TimelineEntry[], key: string): number {
  return entries.reduce((total, e) => total + (Number(e.meta[key]) || 0), 0);
}

/*
  The timeline carries one row per analysis, with a count. A report wants the
  observations themselves, so they are fetched per video — bounded by the
  number of videos read in one month, which is small.
*/
async function observationsIn(
  entries: TimelineEntry[],
  from: string,
  to: string,
  forUser?: string,
): Promise<ReportObservation[]> {
  const videoIds = [
    ...new Set(
      entries
        .filter((e) => e.kind === "analysis")
        .map((e) => String(e.meta.videoId ?? ""))
        .filter(Boolean),
    ),
  ].slice(0, 20);

  const out: ReportObservation[] = [];
  for (const videoId of videoIds) {
    for (const analysis of await listAnalyses(videoId, forUser)) {
      if (analysis.createdAt < from || analysis.createdAt > to) continue;
      for (const o of analysis.observations) {
        out.push({
          ...o,
          videoId,
          on: analysis.createdAt,
          from: analysis.kind === "video" ? "video" : "frames",
        });
      }
    }
  }
  return out.sort((a, b) => (a.on < b.on ? 1 : -1));
}
