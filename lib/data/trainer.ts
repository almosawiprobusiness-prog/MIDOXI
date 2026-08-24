import "server-only";
import { createClient, getAuthUser } from "@/lib/supabase/server";
import { isDemoMode } from "@/lib/env";
import { trainerStore } from "./trainer-store";
import { TESTS, test as testMeta } from "@/lib/knowledge/physical";
import type { QualitySlug } from "@/lib/knowledge/physical";
import type {
  Athlete,
  AthleteInput,
  AthleteNote,
  AthleteNoteKind,
  Assessment,
  AssessmentInput,
  Program,
  ProgramInput,
  ProgramDetail,
  ProgramSessionRow,
  ProgramSource,
  RetestDue,
  SessionIntent,
  ExerciseSlot,
} from "./trainer-types";
import { weeksSince } from "./trainer-types";

/*
  Trainer OS data access. One branch on isDemoMode per function, identical
  shapes both sides — the contract every MIDO XI data module follows.
*/

async function client() {
  return createClient();
}

async function userId(): Promise<string | null> {
  const supabase = await client();
  if (!supabase) return null;
  const user = await getAuthUser();
  return user?.id ?? null;
}

// ── athletes ─────────────────────────────────────────────────

function rowToAthlete(r: Record<string, unknown>): Athlete {
  return {
    id: r.id as string,
    name: (r.display_name as string) ?? "Athlete",
    position: (r.position as string) ?? "",
    dateOfBirth: (r.date_of_birth as string) ?? null,
    objective: (r.objective as string) ?? null,
    limitations: (r.limitations as string) ?? null,
    status: (r.status as Athlete["status"]) ?? "active",
    linked: Boolean(r.athlete_id),
    shareScope: r.athlete_id ? ((r.share_scope as Athlete["shareScope"]) ?? "identity") : null,
    readiness: null,
    createdAt: (r.created_at as string) ?? new Date().toISOString(),
  };
}

/**
 * Readiness from the athlete's own daily check-in — never estimated.
 *
 * Only reachable for a linked athlete sharing at the "full" level; RLS returns
 * nothing for anyone else, so an athlete who has not opted in simply has no
 * readiness rather than a made-up number.
 */
async function attachReadiness(athletes: Athlete[]): Promise<Athlete[]> {
  const shared = athletes.filter((a) => a.linked && a.shareScope === "full");
  if (!shared.length) return athletes;

  const supabase = await client();
  if (!supabase) return athletes;

  const { data: links } = await supabase
    .from("trainer_athletes")
    .select("id, athlete_id")
    .in("id", shared.map((a) => a.id));
  const userIds = (links ?? []).map((l) => l.athlete_id as string).filter(Boolean);
  if (!userIds.length) return athletes;

  const since = new Date(Date.now() - 7 * 864e5).toISOString().slice(0, 10);
  const { data: checkins } = await supabase
    .from("daily_checkins")
    .select("user_id, energy, sleep, soreness, mental, checkin_date")
    .in("user_id", userIds)
    .gte("checkin_date", since)
    .order("checkin_date", { ascending: false });

  const latest = new Map<string, number>();
  for (const c of checkins ?? []) {
    const uid = c.user_id as string;
    if (latest.has(uid)) continue;
    // Four 1-5 scales; soreness is inverted because more sore is less ready.
    const score =
      (Number(c.energy ?? 0) + Number(c.sleep ?? 0) + (6 - Number(c.soreness ?? 3)) + Number(c.mental ?? 0)) / 20;
    latest.set(uid, Math.round(Math.max(0, Math.min(1, score)) * 100));
  }

  const byLink = new Map((links ?? []).map((l) => [l.id as string, l.athlete_id as string]));
  return athletes.map((a) => {
    const uid = byLink.get(a.id);
    const readiness = uid ? (latest.get(uid) ?? null) : null;
    return readiness == null ? a : { ...a, readiness };
  });
}

export async function listAthletes(): Promise<Athlete[]> {
  if (isDemoMode) return trainerStore.listAthletes();
  const supabase = await client();
  if (!supabase) return [];
  const { data } = await supabase.from("trainer_athletes").select("*").order("display_name");
  return attachReadiness((data ?? []).map(rowToAthlete));
}

export async function getAthlete(id: string): Promise<Athlete | null> {
  if (isDemoMode) return trainerStore.getAthlete(id);
  const supabase = await client();
  if (!supabase) return null;
  const { data } = await supabase.from("trainer_athletes").select("*").eq("id", id).maybeSingle();
  return data ? rowToAthlete(data) : null;
}

function athleteColumns(input: AthleteInput) {
  return {
    display_name: input.name,
    position: input.position || null,
    date_of_birth: input.dateOfBirth || null,
    objective: input.objective || null,
    limitations: input.limitations || null,
    status: input.status,
  };
}

export async function createAthlete(input: AthleteInput): Promise<string | null> {
  if (isDemoMode) return trainerStore.createAthlete(input);
  const supabase = await client();
  const uid = await userId();
  if (!supabase || !uid) return null;
  const { data } = await supabase
    .from("trainer_athletes")
    .insert({ trainer_id: uid, ...athleteColumns(input) })
    .select("id")
    .maybeSingle();
  return (data?.id as string) ?? null;
}

export async function updateAthlete(id: string, input: AthleteInput): Promise<boolean> {
  if (isDemoMode) return trainerStore.updateAthlete(id, input);
  const supabase = await client();
  if (!supabase) return false;
  const { error } = await supabase.from("trainer_athletes").update(athleteColumns(input)).eq("id", id);
  return !error;
}

export async function deleteAthlete(id: string): Promise<boolean> {
  if (isDemoMode) return trainerStore.deleteAthlete(id);
  const supabase = await client();
  if (!supabase) return false;
  const { error } = await supabase.from("trainer_athletes").delete().eq("id", id);
  return !error;
}

export async function listAthleteNotes(athleteId: string): Promise<AthleteNote[]> {
  if (isDemoMode) return trainerStore.listNotes(athleteId);
  const supabase = await client();
  if (!supabase) return [];
  const { data } = await supabase
    .from("athlete_notes")
    .select("*")
    .eq("athlete_id", athleteId)
    .order("created_at", { ascending: false });
  return (data ?? []).map((n) => ({
    id: n.id as string,
    athleteId: n.athlete_id as string,
    kind: (n.kind as AthleteNoteKind) ?? "note",
    body: (n.body as string) ?? "",
    createdAt: (n.created_at as string) ?? new Date().toISOString(),
  }));
}

export async function addAthleteNote(
  athleteId: string,
  kind: AthleteNoteKind,
  body: string,
): Promise<boolean> {
  if (isDemoMode) return Boolean(trainerStore.addNote(athleteId, kind, body));
  const supabase = await client();
  const uid = await userId();
  if (!supabase || !uid) return false;
  const { error } = await supabase
    .from("athlete_notes")
    .insert({ athlete_id: athleteId, user_id: uid, kind, body });
  if (error) return false;
  // Objectives and limitations are what the roster shows, so keep them in sync.
  if (kind === "objective") {
    await supabase.from("trainer_athletes").update({ objective: body.slice(0, 140) }).eq("id", athleteId);
  }
  if (kind === "limitation") {
    await supabase.from("trainer_athletes").update({ limitations: body.slice(0, 140) }).eq("id", athleteId);
  }
  return true;
}

export async function deleteAthleteNote(id: string): Promise<boolean> {
  if (isDemoMode) return trainerStore.deleteNote(id);
  const supabase = await client();
  if (!supabase) return false;
  const { error } = await supabase.from("athlete_notes").delete().eq("id", id);
  return !error;
}

// ── programs ─────────────────────────────────────────────────

function rowToProgram(r: Record<string, unknown>): Program {
  return {
    id: r.id as string,
    athleteId: (r.athlete_id as string) ?? null,
    title: (r.title as string) ?? "Program",
    objective: (r.objective as string) ?? "",
    qualities: ((r.qualities as string[]) ?? []) as QualitySlug[],
    weeks: (r.weeks as number) ?? 4,
    sessionsPerWeek: (r.sessions_per_week as number) ?? 2,
    startsOn: (r.starts_on as string) ?? null,
    status: (r.status as Program["status"]) ?? "draft",
    source: (r.source as ProgramSource) ?? "trainer",
    notes: (r.notes as string) ?? "",
    createdAt: (r.created_at as string) ?? new Date().toISOString(),
  };
}

export async function listPrograms(): Promise<Program[]> {
  if (isDemoMode) return trainerStore.listPrograms();
  const supabase = await client();
  if (!supabase) return [];
  const { data } = await supabase.from("programs").select("*").order("created_at", { ascending: false });
  return (data ?? []).map(rowToProgram);
}

export async function listProgramsForAthlete(athleteId: string): Promise<Program[]> {
  if (isDemoMode) return trainerStore.listProgramsForAthlete(athleteId);
  const supabase = await client();
  if (!supabase) return [];
  const { data } = await supabase
    .from("programs")
    .select("*")
    .eq("athlete_id", athleteId)
    .order("created_at", { ascending: false });
  return (data ?? []).map(rowToProgram);
}

export async function getProgram(id: string): Promise<ProgramDetail | null> {
  if (isDemoMode) return trainerStore.getProgram(id);
  const supabase = await client();
  if (!supabase) return null;

  const { data: program } = await supabase.from("programs").select("*").eq("id", id).maybeSingle();
  if (!program) return null;

  const { data: sessions } = await supabase
    .from("program_sessions")
    .select("*")
    .eq("program_id", id)
    .order("week")
    .order("day");
  const sessionIds = (sessions ?? []).map((s) => s.id as string);

  const { data: exercises } = sessionIds.length
    ? await supabase.from("program_exercises").select("*").in("session_id", sessionIds).order("position")
    : { data: [] };

  const rows: ProgramSessionRow[] = (sessions ?? []).map((s) => ({
    id: s.id as string,
    week: (s.week as number) ?? 1,
    day: (s.day as number) ?? 1,
    title: (s.title as string) ?? "Session",
    focus: (s.focus as string) ?? "",
    intent: (s.intent as SessionIntent) ?? null,
    notes: (s.notes as string) ?? "",
    completedAt: (s.completed_at as string) ?? null,
    position: (s.position as number) ?? 0,
    exercises: (exercises ?? [])
      .filter((e) => e.session_id === s.id)
      .map((e) => ({
        id: e.id as string,
        name: (e.name as string) ?? "",
        prescription: (e.prescription as string) ?? "",
        cue: (e.cue as string) ?? "",
        slot: (e.slot as ExerciseSlot) ?? "primary",
        position: (e.position as number) ?? 0,
      })),
  }));

  return { program: rowToProgram(program), sessions: rows };
}

export async function createProgram(
  input: ProgramInput,
  qualities: QualitySlug[] = [],
  source: ProgramSource = "trainer",
): Promise<string | null> {
  if (isDemoMode) return trainerStore.createProgram(input, qualities, source);
  const supabase = await client();
  const uid = await userId();
  if (!supabase || !uid) return null;
  const { data } = await supabase
    .from("programs")
    .insert({
      user_id: uid,
      athlete_id: input.athleteId,
      title: input.title,
      objective: input.objective || null,
      qualities,
      weeks: input.weeks,
      sessions_per_week: input.sessionsPerWeek,
      starts_on: input.startsOn || null,
      status: input.status,
      source,
    })
    .select("id")
    .maybeSingle();
  return (data?.id as string) ?? null;
}

export async function updateProgram(id: string, input: ProgramInput): Promise<boolean> {
  if (isDemoMode) return trainerStore.updateProgram(id, input);
  const supabase = await client();
  if (!supabase) return false;
  const { error } = await supabase
    .from("programs")
    .update({
      athlete_id: input.athleteId,
      title: input.title,
      objective: input.objective || null,
      weeks: input.weeks,
      sessions_per_week: input.sessionsPerWeek,
      starts_on: input.startsOn || null,
      status: input.status,
    })
    .eq("id", id);
  return !error;
}

export async function deleteProgram(id: string): Promise<boolean> {
  if (isDemoMode) return trainerStore.deleteProgram(id);
  const supabase = await client();
  if (!supabase) return false;
  const { error } = await supabase.from("programs").delete().eq("id", id);
  return !error;
}

export interface ScheduleSession {
  week: number;
  day: number;
  title: string;
  focus: string;
  intent: SessionIntent | null;
  exercises: { name: string; prescription: string; cue: string; slot: ExerciseSlot }[];
}

/** Write a whole block at once — how the composer and MIDO both deliver. */
export async function replaceSchedule(
  programId: string,
  sessions: ScheduleSession[],
  qualities: QualitySlug[],
  source: ProgramSource,
): Promise<boolean> {
  if (isDemoMode) {
    trainerStore.replaceSchedule(programId, sessions);
    trainerStore.setProgramQualities(programId, qualities, source);
    return true;
  }

  const supabase = await client();
  const uid = await userId();
  if (!supabase || !uid) return false;

  await supabase.from("program_sessions").delete().eq("program_id", programId);

  for (const [i, s] of sessions.entries()) {
    const { data: created } = await supabase
      .from("program_sessions")
      .insert({
        program_id: programId,
        user_id: uid,
        week: s.week,
        day: s.day,
        title: s.title,
        focus: s.focus || null,
        intent: s.intent,
        position: i,
      })
      .select("id")
      .maybeSingle();
    if (!created) continue;
    if (s.exercises.length) {
      await supabase.from("program_exercises").insert(
        s.exercises.map((e, j) => ({
          session_id: created.id,
          user_id: uid,
          name: e.name,
          prescription: e.prescription || null,
          cue: e.cue || null,
          slot: e.slot,
          position: j,
        })),
      );
    }
  }

  await supabase.from("programs").update({ qualities, source }).eq("id", programId);
  return true;
}

export async function toggleSessionComplete(sessionId: string): Promise<boolean> {
  if (isDemoMode) return trainerStore.toggleSessionComplete(sessionId);
  const supabase = await client();
  if (!supabase) return false;
  const { data } = await supabase
    .from("program_sessions")
    .select("completed_at")
    .eq("id", sessionId)
    .maybeSingle();
  const next = data?.completed_at ? null : new Date().toISOString();
  const { error } = await supabase.from("program_sessions").update({ completed_at: next }).eq("id", sessionId);
  return !error;
}

// ── assessments ──────────────────────────────────────────────

function rowToAssessment(r: Record<string, unknown>): Assessment {
  return {
    id: r.id as string,
    athleteId: r.athlete_id as string,
    test: (r.test as string) ?? "",
    value: Number(r.value ?? 0),
    unit: (r.unit as string) ?? "",
    side: (r.side as Assessment["side"]) ?? null,
    testedOn: (r.tested_on as string) ?? new Date().toISOString().slice(0, 10),
    notes: (r.notes as string) ?? "",
    createdAt: (r.created_at as string) ?? new Date().toISOString(),
  };
}

export async function listAssessments(athleteId?: string): Promise<Assessment[]> {
  if (isDemoMode) return trainerStore.listAssessments(athleteId);
  const supabase = await client();
  if (!supabase) return [];
  let query = supabase.from("assessments").select("*").order("tested_on", { ascending: false });
  if (athleteId) query = query.eq("athlete_id", athleteId);
  const { data } = await query;
  return (data ?? []).map(rowToAssessment);
}

export async function createAssessment(input: AssessmentInput): Promise<string | null> {
  if (isDemoMode) return trainerStore.createAssessment(input);
  const supabase = await client();
  const uid = await userId();
  if (!supabase || !uid) return null;
  const { data } = await supabase
    .from("assessments")
    .insert({
      user_id: uid,
      athlete_id: input.athleteId,
      test: input.test,
      value: input.value,
      unit: input.unit,
      side: input.side,
      tested_on: input.testedOn || new Date().toISOString().slice(0, 10),
      notes: input.notes || null,
    })
    .select("id")
    .maybeSingle();
  return (data?.id as string) ?? null;
}

export async function deleteAssessment(id: string): Promise<boolean> {
  if (isDemoMode) return trainerStore.deleteAssessment(id);
  const supabase = await client();
  if (!supabase) return false;
  const { error } = await supabase.from("assessments").delete().eq("id", id);
  return !error;
}

/**
 * Which tests have gone stale, per athlete. Only for tests tied to a quality
 * the athlete is actually being programmed for — a trainer should not be
 * nagged about a test that has nothing to do with the block.
 */
export async function retestsDue(): Promise<RetestDue[]> {
  const [athletes, programs, assessments] = await Promise.all([
    listAthletes(),
    listPrograms(),
    listAssessments(),
  ]);

  const due: RetestDue[] = [];

  for (const athlete of athletes) {
    if (athlete.status !== "active") continue;
    const qualities = new Set(
      programs.filter((p) => p.athleteId === athlete.id).flatMap((p) => p.qualities),
    );
    if (qualities.size === 0) continue;

    const relevant = TESTS.filter((t) => qualities.has(t.quality));
    for (const t of relevant) {
      const rows = assessments
        .filter((a) => a.athleteId === athlete.id && a.test === t.id)
        .sort((a, b) => b.testedOn.localeCompare(a.testedOn));
      const since = rows.length ? weeksSince(rows[0].testedOn) : null;
      if (since === null || since >= t.retestWeeks) {
        due.push({
          athleteId: athlete.id,
          athleteName: athlete.name,
          test: t.id,
          label: t.label,
          weeksSince: since,
          retestWeeks: t.retestWeeks,
        });
      }
    }
  }

  return due.sort((a, b) => (b.weeksSince ?? 999) - (a.weeksSince ?? 999)).slice(0, 12);
}

/** The unit a test is recorded in — the form never asks the trainer to type it. */
export function unitFor(testId: string): string {
  return testMeta(testId)?.unit ?? "";
}
