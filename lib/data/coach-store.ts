import type {
  SquadPlayer,
  SquadPlayerInput,
  PlayerNote,
  PlayerNoteKind,
  SessionPlan,
  SessionPlanInput,
  SessionBlock,
  SessionBlockInput,
  OppositionReport,
  OppositionReportInput,
  MatchPlan,
} from "./coach-types";

/*
  Coach OS demo store.

  The same contract as `lib/data/store.ts`: an in-memory, globalThis-cached
  database so demo mode is genuinely functional — a coach can add a player,
  plan a session, draw a board and write a match plan without a backend, and
  every screen reads it back.

  Shape changes invalidate the cache (dev HMR keeps the old object otherwise,
  which then crashes on a missing collection).
*/

/** Blocks carry their plan id in the store; the UI shape never needs it. */
type StoredBlock = SessionBlock & { planId: string };

interface CoachDB {
  squad: SquadPlayer[];
  notes: PlayerNote[];
  plans: SessionPlan[];
  blocks: StoredBlock[];
  reports: OppositionReport[];
  seq: number;
}

const SHAPE: (keyof CoachDB)[] = ["squad", "notes", "plans", "blocks", "reports", "seq"];

function iso(daysFromNow: number, hour = 10, minute = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}

function seedSquad(): SquadPlayer[] {
  const rows: Omit<SquadPlayer, "id" | "createdAt" | "shareScope">[] = [
    { name: "M. Al-Rashid", position: "CF", squadNumber: 9, status: "active", focus: "Movement between the lines", linked: true },
    { name: "T. Okafor", position: "RW", squadNumber: 7, status: "active", focus: "Decision in the final third", linked: false },
    { name: "J. Lindqvist", position: "6", squadNumber: 4, status: "active", focus: "Receiving on the half-turn", linked: true },
    { name: "R. Bekele", position: "RCB", squadNumber: 5, status: "injured", focus: "Return to play — week 3", linked: false },
    { name: "S. Moreau", position: "LB", squadNumber: 3, status: "active", focus: "Defending the inside channel", linked: false },
    { name: "K. Adeyemi", position: "8", squadNumber: 8, status: "active", focus: null, linked: false },
    { name: "P. Novak", position: "GK", squadNumber: 1, status: "active", focus: "Distribution under press", linked: false },
    { name: "L. Ferreira", position: "LW", squadNumber: 11, status: "trial", focus: null, linked: false },
  ];
  return rows.map((r, i) => ({
    ...r,
    id: `sp${i + 1}`,
    shareScope: r.linked ? ("development" as const) : null,
    createdAt: iso(-30 + i),
  }));
}

function seedNotes(): PlayerNote[] {
  return [
    { id: "cn1", playerId: "sp1", kind: "focus", body: "Movement between the lines — drop, layoff, spin. Reinforce in every possession game.", createdAt: iso(-12) },
    { id: "cn2", playerId: "sp1", kind: "match", body: "Halton away: two clean drops in the first half, disappeared onto the last line after 60 minutes.", createdAt: iso(-4) },
    { id: "cn3", playerId: "sp1", kind: "session", body: "Third-man pattern work — timing improving, still arriving a beat late on the layoff.", createdAt: iso(-2) },
    { id: "cn4", playerId: "sp2", kind: "focus", body: "Final-third decision: shoot / cut back / hold. Too often the third option by default.", createdAt: iso(-10) },
    { id: "cn5", playerId: "sp4", kind: "note", body: "Hamstring — week 3 of return to play. No max sprint until cleared by the performance staff.", createdAt: iso(-6) },
  ];
}

function seedPlans(): { plans: SessionPlan[]; blocks: StoredBlock[] } {
  const plans: SessionPlan[] = [
    {
      id: "pl1",
      title: "MD-3 · Defending transitions",
      scheduledAt: iso(0, 10, 30),
      durationMin: 75,
      objective: "React in the first five seconds after losing the ball — nearest player presses, next two close the passing lanes.",
      playersCount: 18,
      pitch: "Two thirds",
      intensity: "high",
      status: "planned",
      source: "coach",
      notes: "",
      createdAt: iso(-2),
    },
    {
      id: "pl2",
      title: "MD-2 · Opposition shape",
      scheduledAt: iso(1, 10, 30),
      durationMin: 60,
      objective: "Rehearse breaking a mid-block: attract on one side, switch, isolate the far winger.",
      playersCount: 18,
      pitch: "Full pitch",
      intensity: "moderate",
      status: "draft",
      source: "coach",
      notes: "",
      createdAt: iso(-1),
    },
  ];

  const blocks: StoredBlock[] = [
    {
      id: "bl1", planId: "pl1", phase: "warmup", name: "Rondo 5v2 — two-touch", durationMin: 12,
      organisation: "12x12m, two grids. Losing pair goes in. Two-touch limit.",
      coachingPoints: ["Body open before receiving", "Scan before the ball arrives"],
      progression: "One touch for the escape pass", regression: "Free touch", position: 0,
    },
    {
      id: "bl2", planId: "pl1", phase: "technical", name: "Counter-press triggers", durationMin: 15,
      organisation: "30x25m. Ball is served to a target; the losing team has five seconds to win it back.",
      coachingPoints: ["Nearest player presses the ball", "Second and third close the lanes, not the ball", "Go together or not at all"],
      progression: "Reduce to four seconds", regression: "Add a neutral player", position: 1,
    },
    {
      id: "bl3", planId: "pl1", phase: "conditioned-game", name: "5-second rule game", durationMin: 20,
      organisation: "8v8 + 2 neutrals, 50x40m. A goal counts double if scored within 10 seconds of a turnover.",
      coachingPoints: ["First reaction decides the moment", "Recovery runs aimed at passing options"],
      progression: "Remove neutrals", regression: "Extend the window to 15 seconds", position: 2,
    },
    {
      id: "bl4", planId: "pl1", phase: "match-scenario", name: "11v11 — free play, transition focus", durationMin: 20,
      organisation: "Full pitch, match rules. Stoppages only to correct the transition moment.",
      coachingPoints: ["Rest defence set before the attack finishes"],
      progression: "", regression: "", position: 3,
    },
    {
      id: "bl5", planId: "pl1", phase: "cooldown", name: "Cool-down + review", durationMin: 8,
      organisation: "Mobility flow, then two minutes of questions to the group.",
      coachingPoints: ["Ask, do not tell"],
      progression: "", regression: "", position: 4,
    },
  ];

  return { plans, blocks: blocks.map((b) => ({ ...b })) };
}

function seedReports(): OppositionReport[] {
  return [
    {
      id: "op1",
      opponent: "Riverside Athletic",
      competition: "Championship North",
      matchDate: iso(3).slice(0, 10),
      home: true,
      formation: "4-4-2",
      keyPlayers: [
        { name: "Number 10", position: "RCB", threat: "Steps early into the channel to meet the striker" },
        { name: "Number 7", position: "RW", threat: "Stays high and wide, attacks the space behind our left back" },
      ],
      inPossession: [
        "Goalkeeper goes long to the right channel under pressure",
        "Full-backs both push high when the ball is on their side",
      ],
      outOfPossession: [
        "Mid-block, two banks of four, narrow",
        "Press trigger is a pass into our full-back",
      ],
      transition: ["Counter through the right channel within three passes"],
      setPieces: ["Near-post corner routine, two blockers on our keeper"],
      weaknesses: ["Their right centre-back steps early — the space behind him opens", "Slow to shift when the ball is switched"],
      notes: "",
      plan: null,
      planSource: null,
      createdAt: iso(-3),
    },
  ];
}

function createDB(): CoachDB {
  const { plans, blocks } = seedPlans();
  return {
    squad: seedSquad(),
    notes: seedNotes(),
    plans,
    blocks: blocks.map((b, i) => ({ ...b, position: i })),
    reports: seedReports(),
    seq: 100,
  };
}

const g = globalThis as unknown as { __midoCoachDB?: CoachDB };
if (!g.__midoCoachDB || SHAPE.some((k) => g.__midoCoachDB![k] === undefined)) {
  g.__midoCoachDB = createDB();
}
const db: CoachDB = g.__midoCoachDB;

const nextId = (prefix: string) => `${prefix}${db.seq++}`;

/** Blocks belong to a plan; this keeps their order contiguous after edits. */
function reindex(planId: string) {
  db.blocks
    .filter((b) => b.planId === planId)
    .sort((a, b) => a.position - b.position)
    .forEach((b, i) => (b.position = i));
}

export const coachStore = {
  // ── squad ──────────────────────────────────────────────────
  listSquad(): SquadPlayer[] {
    return [...db.squad].sort((a, b) => (a.squadNumber ?? 99) - (b.squadNumber ?? 99));
  },
  getPlayer(id: string): SquadPlayer | null {
    return db.squad.find((p) => p.id === id) ?? null;
  },
  createPlayer(input: SquadPlayerInput): string {
    const id = nextId("sp");
    db.squad.push({
      id,
      name: input.name,
      position: input.position,
      squadNumber: input.squadNumber,
      status: input.status,
      focus: input.focus || null,
      linked: false,
      shareScope: null,
      createdAt: new Date().toISOString(),
    });
    return id;
  },
  updatePlayer(id: string, input: SquadPlayerInput): boolean {
    const p = db.squad.find((x) => x.id === id);
    if (!p) return false;
    Object.assign(p, {
      name: input.name,
      position: input.position,
      squadNumber: input.squadNumber,
      status: input.status,
      focus: input.focus || null,
    });
    return true;
  },
  deletePlayer(id: string): boolean {
    const i = db.squad.findIndex((p) => p.id === id);
    if (i < 0) return false;
    db.squad.splice(i, 1);
    db.notes = db.notes.filter((n) => n.playerId !== id);
    return true;
  },

  listNotes(playerId: string): PlayerNote[] {
    return db.notes
      .filter((n) => n.playerId === playerId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },
  addNote(playerId: string, kind: PlayerNoteKind, body: string): string {
    const id = nextId("cn");
    db.notes.push({ id, playerId, kind, body, createdAt: new Date().toISOString() });
    if (kind === "focus") {
      const p = db.squad.find((x) => x.id === playerId);
      if (p) p.focus = body.slice(0, 120);
    }
    return id;
  },
  deleteNote(id: string): boolean {
    const i = db.notes.findIndex((n) => n.id === id);
    if (i < 0) return false;
    db.notes.splice(i, 1);
    return true;
  },

  // ── sessions ───────────────────────────────────────────────
  listPlans(): SessionPlan[] {
    return [...db.plans].sort((a, b) => (b.scheduledAt ?? "").localeCompare(a.scheduledAt ?? ""));
  },
  getPlan(id: string): { plan: SessionPlan; blocks: SessionBlock[] } | null {
    const plan = db.plans.find((p) => p.id === id);
    if (!plan) return null;
    const blocks = db.blocks
      .filter((b) => b.planId === id)
      .sort((a, b) => a.position - b.position);
    return { plan, blocks };
  },
  createPlan(input: SessionPlanInput, source: SessionPlan["source"] = "coach"): string {
    const id = nextId("pl");
    db.plans.push({
      id,
      title: input.title,
      scheduledAt: input.scheduledAt || null,
      durationMin: input.durationMin,
      objective: input.objective,
      playersCount: input.playersCount,
      pitch: input.pitch,
      intensity: input.intensity,
      status: input.status,
      source,
      notes: "",
      createdAt: new Date().toISOString(),
    });
    return id;
  },
  updatePlan(id: string, input: SessionPlanInput): boolean {
    const p = db.plans.find((x) => x.id === id);
    if (!p) return false;
    Object.assign(p, {
      title: input.title,
      scheduledAt: input.scheduledAt || null,
      durationMin: input.durationMin,
      objective: input.objective,
      playersCount: input.playersCount,
      pitch: input.pitch,
      intensity: input.intensity,
      status: input.status,
    });
    return true;
  },
  deletePlan(id: string): boolean {
    const i = db.plans.findIndex((p) => p.id === id);
    if (i < 0) return false;
    db.plans.splice(i, 1);
    db.blocks = db.blocks.filter((b) => b.planId !== id);
    return true;
  },

  addBlock(planId: string, input: SessionBlockInput): string {
    const id = nextId("bl");
    const owned = db.blocks.filter((b) => b.planId === planId);
    db.blocks.push({ id, planId, ...input, position: owned.length });
    return id;
  },
  updateBlock(id: string, input: SessionBlockInput): boolean {
    const b = db.blocks.find((x) => x.id === id);
    if (!b) return false;
    Object.assign(b, input);
    return true;
  },
  deleteBlock(id: string): boolean {
    const i = db.blocks.findIndex((b) => b.id === id);
    if (i < 0) return false;
    const planId = db.blocks[i].planId;
    db.blocks.splice(i, 1);
    reindex(planId);
    return true;
  },
  moveBlock(id: string, direction: -1 | 1): boolean {
    const target = db.blocks.find((b) => b.id === id);
    if (!target) return false;
    const owned = db.blocks
      .filter((b) => b.planId === target.planId)
      .sort((a, b) => a.position - b.position);
    const i = owned.findIndex((b) => b.id === id);
    const j = i + direction;
    if (i < 0 || j < 0 || j >= owned.length) return false;
    const a = owned[i].position;
    owned[i].position = owned[j].position;
    owned[j].position = a;
    return true;
  },
  replaceBlocks(planId: string, inputs: SessionBlockInput[]): void {
    db.blocks = db.blocks.filter((b) => b.planId !== planId);
    inputs.forEach((input, i) => {
      db.blocks.push({ id: nextId("bl"), planId, ...input, position: i });
    });
  },

  // ── opposition ─────────────────────────────────────────────
  listReports(): OppositionReport[] {
    return [...db.reports].sort((a, b) => (b.matchDate ?? "").localeCompare(a.matchDate ?? ""));
  },
  getReport(id: string): OppositionReport | null {
    return db.reports.find((r) => r.id === id) ?? null;
  },
  createReport(input: OppositionReportInput): string {
    const id = nextId("op");
    db.reports.push({
      id,
      ...input,
      matchDate: input.matchDate || null,
      plan: null,
      planSource: null,
      createdAt: new Date().toISOString(),
    });
    return id;
  },
  updateReport(id: string, input: OppositionReportInput): boolean {
    const r = db.reports.find((x) => x.id === id);
    if (!r) return false;
    Object.assign(r, input, { matchDate: input.matchDate || null });
    return true;
  },
  deleteReport(id: string): boolean {
    const i = db.reports.findIndex((r) => r.id === id);
    if (i < 0) return false;
    db.reports.splice(i, 1);
    return true;
  },
  savePlan(id: string, plan: MatchPlan, source: "coach" | "mido"): boolean {
    const r = db.reports.find((x) => x.id === id);
    if (!r) return false;
    r.plan = plan;
    r.planSource = source;
    return true;
  },
};
