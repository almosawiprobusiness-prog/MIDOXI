import type {
  Athlete,
  AthleteInput,
  AthleteNote,
  AthleteNoteKind,
  Assessment,
  AssessmentInput,
  Program,
  ProgramInput,
  ProgramSessionRow,
  ProgramExerciseRow,
  ProgramSource,
  SessionIntent,
} from "./trainer-types";
import type { QualitySlug } from "@/lib/knowledge/physical";

/*
  Trainer OS demo store.

  Same contract as the coach store: an in-memory, globalThis-cached database so
  demo mode is genuinely functional — add an athlete, build a six-week block,
  record a test, watch the trend move.
*/

type StoredSession = Omit<ProgramSessionRow, "exercises"> & { programId: string };
type StoredExercise = ProgramExerciseRow & { sessionId: string };

interface TrainerDB {
  athletes: Athlete[];
  notes: AthleteNote[];
  programs: Program[];
  sessions: StoredSession[];
  exercises: StoredExercise[];
  assessments: Assessment[];
  seq: number;
}

const SHAPE: (keyof TrainerDB)[] = [
  "athletes",
  "notes",
  "programs",
  "sessions",
  "exercises",
  "assessments",
  "seq",
];

function iso(daysFromNow: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  d.setHours(9, 0, 0, 0);
  return d.toISOString();
}

const date = (daysFromNow: number) => iso(daysFromNow).slice(0, 10);

function seedAthletes(): Athlete[] {
  const rows: Omit<Athlete, "id" | "createdAt" | "shareScope" | "readiness">[] = [
    { name: "M. Al-Rashid", position: "CF", dateOfBirth: "2005-03-14", objective: "Explosive separation over 5-10m", limitations: null, status: "active", linked: true },
    { name: "T. Okafor", position: "RW", dateOfBirth: "2004-11-02", objective: "Hold sprint quality into the last 20 minutes", limitations: "Left ankle — taped for training", status: "active", linked: false },
    { name: "R. Bekele", position: "RCB", dateOfBirth: "2002-06-21", objective: "Return to play — hamstring, stage 3", limitations: "No maximum-velocity running until cleared", status: "active", linked: false },
    { name: "S. Moreau", position: "LB", dateOfBirth: "2003-01-30", objective: "Posterior chain strength", limitations: null, status: "active", linked: false },
    { name: "K. Adeyemi", position: "8", dateOfBirth: "2006-09-08", objective: "Aerobic base before pre-season", limitations: null, status: "paused", linked: false },
  ];
  return rows.map((r, i) => ({
    ...r,
    id: `at${i + 1}`,
    // Demo mode has no linked check-ins, so readiness stays honestly empty.
    shareScope: r.linked ? ("development" as const) : null,
    readiness: null,
    createdAt: iso(-60 + i * 3),
  }));
}

function seedNotes(): AthleteNote[] {
  return [
    { id: "an1", athleteId: "at1", kind: "objective", body: "Football objective is separation in the first three steps — everything in the block serves that.", createdAt: iso(-30) },
    { id: "an2", athleteId: "at1", kind: "session", body: "Sled work moving well. Sprint times holding across all six reps for the first time.", createdAt: iso(-5) },
    { id: "an3", athleteId: "at2", kind: "limitation", body: "Left ankle taped. Avoid deep dorsiflexion loading and lateral bounds on that side this block.", createdAt: iso(-14) },
    { id: "an4", athleteId: "at3", kind: "flag", body: "Stage 3 only. Progress high-speed running by criteria, not by the fixture list.", createdAt: iso(-9) },
  ];
}

function seedProgram(): {
  programs: Program[];
  sessions: StoredSession[];
  exercises: StoredExercise[];
} {
  const programs: Program[] = [
    {
      id: "pr1",
      athleteId: "at1",
      title: "Acceleration block — 6 weeks",
      objective: "Explosive separation over the first 5-10 metres",
      qualities: ["acceleration", "lower-body-strength"] as QualitySlug[],
      weeks: 6,
      sessionsPerWeek: 2,
      startsOn: date(-21),
      status: "active",
      source: "trainer",
      notes: "Runs alongside two football days. Speed always before strength.",
      createdAt: iso(-22),
    },
  ];

  const sessions: StoredSession[] = [];
  const exercises: StoredExercise[] = [];
  let sid = 1;
  let eid = 1;

  const intents: SessionIntent[] = ["build", "build", "build", "deload", "build", "test"];
  for (let week = 1; week <= 6; week++) {
    for (let day = 1; day <= 2; day++) {
      const id = `ps${sid++}`;
      const intent = week === 4 ? "deload" : week === 6 && day === 2 ? "test" : intents[week - 1];
      sessions.push({
        id,
        programId: "pr1",
        week,
        day,
        title: day === 1 ? `Week ${week} · Speed + strength` : `Week ${week} · Power + accessory`,
        focus: day === 1 ? "Acceleration mechanics into heavy strength" : "Elastic quality and single-leg work",
        intent,
        notes: "",
        completedAt: week <= 3 ? iso(-21 + (week - 1) * 7 + day) : null,
        position: day - 1,
      });

      const load = week === 4 ? "60%" : `${72 + week * 2}%`;
      const reps = week === 4 ? 4 : 5 + Math.min(week, 3);
      const block: Omit<ProgramExerciseRow, "id" | "position">[] =
        day === 1
          ? [
              { name: "Wall drill — single exchange", prescription: "3 x 5 each side", cue: "Punch the ground away", slot: "prep" },
              { name: "Falling start sprint 10m", prescription: `${reps} x 10m · walk-back recovery`, cue: "Long and low out of the first step", slot: "primary" },
              { name: "Resisted sled push 15m", prescription: `${week === 4 ? 3 : 5} x 15m · heavy`, cue: "Shin angle low", slot: "primary" },
              { name: "Back squat", prescription: `4 x 5 @ ${load} · 3 min rest`, cue: "Same depth every rep", slot: "secondary" },
              { name: "Copenhagen adduction", prescription: "3 x 8 each side", cue: "Slow and controlled", slot: "accessory" },
            ]
          : [
              { name: "Pogo hops", prescription: "4 x 10 · stiff ankle", cue: "Minimum ground time", slot: "prep" },
              { name: "Trap-bar jump", prescription: "4 x 3 @ 30% 1RM", cue: "Fast intent every rep", slot: "primary" },
              { name: "Rear-foot elevated split squat", prescription: "3 x 8 each side", cue: "Vertical torso", slot: "secondary" },
              { name: "Nordic hamstring", prescription: "3 x 4 eccentric", cue: "Fight the last 20 degrees", slot: "accessory" },
              { name: "Extensive tempo 100m", prescription: "8 x @ 70% · walk back", cue: "Comfortable and repeatable", slot: "conditioning" },
            ];

      block.forEach((ex, i) => {
        exercises.push({ ...ex, id: `pe${eid++}`, sessionId: id, position: i });
      });
    }
  }

  return { programs, sessions, exercises };
}

function seedAssessments(): Assessment[] {
  const rows: [string, string, number, string, number][] = [
    // athleteId, test, value, unit, daysAgo
    ["at1", "sprint-10m", 1.79, "s", 84],
    ["at1", "sprint-10m", 1.76, "s", 42],
    ["at1", "sprint-10m", 1.72, "s", 7],
    ["at1", "cmj", 41.2, "cm", 84],
    ["at1", "cmj", 43.8, "cm", 42],
    ["at1", "cmj", 45.1, "cm", 7],
    ["at1", "squat-1rm", 132, "kg", 84],
    ["at1", "squat-1rm", 145, "kg", 21],
    ["at2", "rsa-decrement", 7.4, "%", 70],
    ["at2", "rsa-decrement", 6.1, "%", 21],
    ["at3", "nordic-break-point", 38, "deg", 56],
    ["at3", "nordic-break-point", 46, "deg", 14],
    ["at4", "trap-bar-1rm", 150, "kg", 60],
    ["at4", "trap-bar-1rm", 167, "kg", 12],
  ];
  return rows.map(([athleteId, test, value, unit, daysAgo], i) => ({
    id: `as${i + 1}`,
    athleteId,
    test,
    value,
    unit,
    side: null,
    testedOn: date(-daysAgo),
    notes: "",
    createdAt: iso(-daysAgo),
  }));
}

function createDB(): TrainerDB {
  const { programs, sessions, exercises } = seedProgram();
  return {
    athletes: seedAthletes(),
    notes: seedNotes(),
    programs,
    sessions,
    exercises,
    assessments: seedAssessments(),
    seq: 200,
  };
}

const g = globalThis as unknown as { __midoTrainerDB?: TrainerDB };
if (!g.__midoTrainerDB || SHAPE.some((k) => g.__midoTrainerDB![k] === undefined)) {
  g.__midoTrainerDB = createDB();
}
const db: TrainerDB = g.__midoTrainerDB;

const nextId = (prefix: string) => `${prefix}${db.seq++}`;

function withExercises(s: StoredSession): ProgramSessionRow {
  return {
    ...s,
    exercises: db.exercises
      .filter((e) => e.sessionId === s.id)
      .sort((a, b) => a.position - b.position),
  };
}

export const trainerStore = {
  // ── athletes ───────────────────────────────────────────────
  listAthletes(): Athlete[] {
    return [...db.athletes].sort((a, b) => a.name.localeCompare(b.name));
  },
  getAthlete(id: string): Athlete | null {
    return db.athletes.find((a) => a.id === id) ?? null;
  },
  createAthlete(input: AthleteInput): string {
    const id = nextId("at");
    db.athletes.push({
      id,
      name: input.name,
      position: input.position,
      dateOfBirth: input.dateOfBirth || null,
      objective: input.objective || null,
      limitations: input.limitations || null,
      status: input.status,
      linked: false,
      shareScope: null,
      readiness: null,
      createdAt: new Date().toISOString(),
    });
    return id;
  },
  updateAthlete(id: string, input: AthleteInput): boolean {
    const a = db.athletes.find((x) => x.id === id);
    if (!a) return false;
    Object.assign(a, {
      name: input.name,
      position: input.position,
      dateOfBirth: input.dateOfBirth || null,
      objective: input.objective || null,
      limitations: input.limitations || null,
      status: input.status,
    });
    return true;
  },
  deleteAthlete(id: string): boolean {
    const i = db.athletes.findIndex((a) => a.id === id);
    if (i < 0) return false;
    db.athletes.splice(i, 1);
    db.notes = db.notes.filter((n) => n.athleteId !== id);
    db.assessments = db.assessments.filter((a) => a.athleteId !== id);
    return true;
  },

  listNotes(athleteId: string): AthleteNote[] {
    return db.notes
      .filter((n) => n.athleteId === athleteId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },
  addNote(athleteId: string, kind: AthleteNoteKind, body: string): string {
    const id = nextId("an");
    db.notes.push({ id, athleteId, kind, body, createdAt: new Date().toISOString() });
    const athlete = db.athletes.find((a) => a.id === athleteId);
    if (athlete && kind === "objective") athlete.objective = body.slice(0, 140);
    if (athlete && kind === "limitation") athlete.limitations = body.slice(0, 140);
    return id;
  },
  deleteNote(id: string): boolean {
    const i = db.notes.findIndex((n) => n.id === id);
    if (i < 0) return false;
    db.notes.splice(i, 1);
    return true;
  },

  // ── programs ───────────────────────────────────────────────
  listPrograms(): Program[] {
    return [...db.programs].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },
  listProgramsForAthlete(athleteId: string): Program[] {
    return db.programs.filter((p) => p.athleteId === athleteId);
  },
  getProgram(id: string): { program: Program; sessions: ProgramSessionRow[] } | null {
    const program = db.programs.find((p) => p.id === id);
    if (!program) return null;
    const sessions = db.sessions
      .filter((s) => s.programId === id)
      .sort((a, b) => a.week - b.week || a.day - b.day)
      .map(withExercises);
    return { program, sessions };
  },
  createProgram(input: ProgramInput, qualities: QualitySlug[], source: ProgramSource): string {
    const id = nextId("pr");
    db.programs.push({
      id,
      athleteId: input.athleteId,
      title: input.title,
      objective: input.objective,
      qualities,
      weeks: input.weeks,
      sessionsPerWeek: input.sessionsPerWeek,
      startsOn: input.startsOn || null,
      status: input.status,
      source,
      notes: "",
      createdAt: new Date().toISOString(),
    });
    return id;
  },
  updateProgram(id: string, input: ProgramInput): boolean {
    const p = db.programs.find((x) => x.id === id);
    if (!p) return false;
    Object.assign(p, {
      athleteId: input.athleteId,
      title: input.title,
      objective: input.objective,
      weeks: input.weeks,
      sessionsPerWeek: input.sessionsPerWeek,
      startsOn: input.startsOn || null,
      status: input.status,
    });
    return true;
  },
  deleteProgram(id: string): boolean {
    const i = db.programs.findIndex((p) => p.id === id);
    if (i < 0) return false;
    db.programs.splice(i, 1);
    const sessionIds = db.sessions.filter((s) => s.programId === id).map((s) => s.id);
    db.sessions = db.sessions.filter((s) => s.programId !== id);
    db.exercises = db.exercises.filter((e) => !sessionIds.includes(e.sessionId));
    return true;
  },
  setProgramQualities(id: string, qualities: QualitySlug[], source: ProgramSource): void {
    const p = db.programs.find((x) => x.id === id);
    if (!p) return;
    p.qualities = qualities;
    p.source = source;
  },

  /** Replace a program's whole schedule — used when MIDO or the library builds it. */
  replaceSchedule(
    programId: string,
    sessions: {
      week: number;
      day: number;
      title: string;
      focus: string;
      intent: SessionIntent | null;
      exercises: { name: string; prescription: string; cue: string; slot: ProgramExerciseRow["slot"] }[];
    }[],
  ): void {
    const oldIds = db.sessions.filter((s) => s.programId === programId).map((s) => s.id);
    db.sessions = db.sessions.filter((s) => s.programId !== programId);
    db.exercises = db.exercises.filter((e) => !oldIds.includes(e.sessionId));

    sessions.forEach((s, i) => {
      const id = nextId("ps");
      db.sessions.push({
        id,
        programId,
        week: s.week,
        day: s.day,
        title: s.title,
        focus: s.focus,
        intent: s.intent,
        notes: "",
        completedAt: null,
        position: i,
      });
      s.exercises.forEach((ex, j) => {
        db.exercises.push({ ...ex, id: nextId("pe"), sessionId: id, position: j });
      });
    });
  },

  toggleSessionComplete(sessionId: string): boolean {
    const s = db.sessions.find((x) => x.id === sessionId);
    if (!s) return false;
    s.completedAt = s.completedAt ? null : new Date().toISOString();
    return true;
  },

  // ── assessments ────────────────────────────────────────────
  listAssessments(athleteId?: string): Assessment[] {
    const rows = athleteId ? db.assessments.filter((a) => a.athleteId === athleteId) : db.assessments;
    return [...rows].sort((a, b) => b.testedOn.localeCompare(a.testedOn));
  },
  createAssessment(input: AssessmentInput): string {
    const id = nextId("as");
    db.assessments.push({
      id,
      athleteId: input.athleteId,
      test: input.test,
      value: input.value,
      unit: input.unit,
      side: input.side,
      testedOn: input.testedOn || new Date().toISOString().slice(0, 10),
      notes: input.notes,
      createdAt: new Date().toISOString(),
    });
    return id;
  },
  deleteAssessment(id: string): boolean {
    const i = db.assessments.findIndex((a) => a.id === id);
    if (i < 0) return false;
    db.assessments.splice(i, 1);
    return true;
  },
};
