import "server-only";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/session";
import { isDemoMode } from "@/lib/env";
import { listSquad, listSessionPlans, listOppositionReports } from "./coach";
import type { SquadPlayer, SessionPlan } from "./coach-types";
import { listAthletes, listPrograms, getProgram, retestsDue } from "./trainer";
import type { Athlete, RetestDue } from "./trainer-types";

/*
  Role dashboard adapters — coach and trainer.

  The club dashboard reads from lib/data/club.ts, which owns the organization
  layer outright.

  Same contract as every other data module: one branch on isDemoMode, identical
  shapes on both sides, so the dashboards never know where the rows came from.
  Real accounts start empty on purpose; the dashboards render honest empty
  states rather than invented squads.
*/

export interface CoachDashboard {
  isDemo: boolean;
  teamName: string;
  squad: SquadPlayer[];
  nextMatch: {
    opponent: string;
    competition: string;
    home: boolean;
    daysRemaining: number;
    reportId: string;
    hasPlan: boolean;
  } | null;
  sessionsThisWeek: number;
  nextSession: SessionPlan | null;
  /** Opposition reports with observations but no match plan yet. */
  reportsWithoutPlan: number;
  /** Players with no development focus recorded. */
  needsAttention: SquadPlayer[];
}

export interface TrainerWeekSession {
  programId: string;
  programTitle: string;
  athleteName: string;
  week: number;
  day: number;
  title: string;
  focus: string;
  completed: boolean;
}

export interface TrainerDashboard {
  isDemo: boolean;
  practice: string;
  athletes: Athlete[];
  /** Sessions scheduled in the current week of each running block. */
  thisWeek: TrainerWeekSession[];
  retests: RetestDue[];
  /** Recorded limitations and missing objectives — never invented readiness. */
  flags: { id: string; athlete: string; reason: string; kind: "limitation" | "objective" }[];
}

// ── coach ────────────────────────────────────────────────────

export async function getCoachDashboard(): Promise<CoachDashboard> {
  // The Coach OS owns squad, sessions and opposition; the dashboard is a read
  // over those modules rather than a second source of truth.
  const [squad, plans, reports] = await Promise.all([
    listSquad(),
    listSessionPlans(),
    listOppositionReports(),
  ]);

  const now = Date.now();
  const weekAhead = now + 7 * 864e5;
  const sessionsThisWeek = plans.filter((p) => {
    if (!p.scheduledAt) return false;
    const t = new Date(p.scheduledAt).getTime();
    return t >= now - 864e5 && t <= weekAhead;
  }).length;

  const nextReport = reports
    .filter((r) => r.matchDate && new Date(r.matchDate).getTime() >= now - 864e5)
    .sort((a, b) => (a.matchDate ?? "").localeCompare(b.matchDate ?? ""))[0];

  let teamName = isDemoMode ? "Northgate FC · First team" : "Your team";
  if (!isDemoMode) {
    const user = await getCurrentUser();
    const supabase = await createClient();
    if (user && supabase) {
      const { data: cp } = await supabase
        .from("coach_profiles")
        .select("team, club")
        .eq("user_id", user.id)
        .maybeSingle();
      teamName = [cp?.team, cp?.club].filter(Boolean).join(" · ") || "Your team";
    }
  }

  return {
    isDemo: isDemoMode,
    teamName,
    squad,
    nextMatch: nextReport
      ? {
          opponent: nextReport.opponent,
          competition: nextReport.competition,
          home: nextReport.home ?? true,
          daysRemaining: Math.max(
            0,
            Math.round((new Date(nextReport.matchDate as string).getTime() - now) / 864e5),
          ),
          reportId: nextReport.id,
          hasPlan: Boolean(nextReport.plan),
        }
      : null,
    sessionsThisWeek,
    nextSession: plans
      .filter((p) => p.scheduledAt && new Date(p.scheduledAt).getTime() >= now - 3600_000)
      .sort((a, b) => (a.scheduledAt ?? "").localeCompare(b.scheduledAt ?? ""))[0] ?? null,
    reportsWithoutPlan: reports.filter((r) => !r.plan).length,
    needsAttention: squad.filter((p) => !p.focus && p.status !== "left"),
  };
}

// ── trainer ──────────────────────────────────────────────────

/**
 * The trainer's practice name — their brand, stamped on what leaves
 * the Lab (program pages, and eventually shared plans and invoices).
 * One reader so the dashboard and every output surface agree on it.
 */
export async function getTrainerPractice(): Promise<string> {
  if (isDemoMode) return "Northgate Performance";
  const user = await getCurrentUser();
  const supabase = await createClient();
  if (!user || !supabase) return "Your practice";
  const { data: tp } = await supabase
    .from("trainer_profiles")
    .select("practice")
    .eq("user_id", user.id)
    .maybeSingle();
  return tp?.practice || "Your practice";
}

export async function getTrainerDashboard(): Promise<TrainerDashboard> {
  // The Trainer OS owns athletes, programs and assessments; the dashboard reads
  // over those modules rather than keeping a second dataset.
  const [athletes, programs, retests] = await Promise.all([
    listAthletes(),
    listPrograms(),
    retestsDue(),
  ]);

  const byId = new Map(athletes.map((a) => [a.id, a]));
  const thisWeek: TrainerWeekSession[] = [];

  for (const program of programs) {
    if (program.status !== "active" || !program.startsOn) continue;
    const started = new Date(program.startsOn).getTime();
    if (Number.isNaN(started)) continue;
    const week = Math.floor((Date.now() - started) / (7 * 864e5)) + 1;
    if (week < 1 || week > program.weeks) continue;

    const detail = await getProgram(program.id);
    if (!detail) continue;
    for (const session of detail.sessions.filter((s) => s.week === week)) {
      thisWeek.push({
        programId: program.id,
        programTitle: program.title,
        athleteName: program.athleteId ? (byId.get(program.athleteId)?.name ?? "Unassigned") : "Template",
        week: session.week,
        day: session.day,
        title: session.title,
        focus: session.focus,
        completed: Boolean(session.completedAt),
      });
    }
  }

  const flags: TrainerDashboard["flags"] = [];
  for (const a of athletes) {
    if (a.status !== "active") continue;
    if (a.limitations) {
      flags.push({ id: `${a.id}-lim`, athlete: a.name, reason: a.limitations, kind: "limitation" });
    }
    if (!a.objective) {
      flags.push({
        id: `${a.id}-obj`,
        athlete: a.name,
        reason: "No football objective recorded — physical work has nothing to serve.",
        kind: "objective",
      });
    }
  }

  const practice = await getTrainerPractice();

  return {
    isDemo: isDemoMode,
    practice,
    athletes,
    thisWeek: thisWeek.sort((a, b) => a.day - b.day),
    retests,
    flags,
  };
}
