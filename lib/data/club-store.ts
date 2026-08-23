import type {
  ClubTeamRow,
  TeamInput,
  StaffMember,
  StaffInput,
  MethodologySection,
  MethodologySectionInput,
  MethodologyDoc,
} from "./club-types";

/*
  Club OS demo store.

  Same contract as the coach and trainer stores: an in-memory, globalThis-cached
  database so demo mode is genuinely functional — create a team, record staff,
  write the methodology, and watch MIDO start answering inside it.
*/

interface ClubDB {
  club: { id: string; name: string; level: string; country: string };
  teams: Omit<ClubTeamRow, "staff">[];
  staff: StaffMember[];
  methodology: MethodologySection[];
  seq: number;
}

const SHAPE: (keyof ClubDB)[] = ["club", "teams", "staff", "methodology", "seq"];

function iso(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString();
}

function seedTeams(): Omit<ClubTeamRow, "staff">[] {
  return [
    { id: "ct1", name: "First team", ageGroup: "Senior", level: "Championship North", season: "2026 / 27", squadSize: 24, createdAt: iso(200) },
    { id: "ct2", name: "U21", ageGroup: "U21", level: "Development league", season: "2026 / 27", squadSize: 19, createdAt: iso(200) },
    { id: "ct3", name: "U18", ageGroup: "U18", level: "Academy", season: "2026 / 27", squadSize: 21, createdAt: iso(200) },
    { id: "ct4", name: "U16", ageGroup: "U16", level: "Academy", season: "2026 / 27", squadSize: 18, createdAt: iso(200) },
  ];
}

function seedStaff(): StaffMember[] {
  const rows: Omit<StaffMember, "id" | "createdAt">[] = [
    { name: "A. Whitlock", email: "", role: "head-coach", teamId: "ct1", status: "active", notes: "", linked: true },
    { name: "D. Sarr", email: "", role: "coach", teamId: "ct2", status: "active", notes: "", linked: false },
    { name: "M. Ionescu", email: "", role: "coach", teamId: "ct3", status: "active", notes: "", linked: false },
    { name: "H. Byrne", email: "", role: "coach", teamId: "ct4", status: "recorded", notes: "", linked: false },
    { name: "L. Marchetti", email: "", role: "trainer", teamId: null, status: "active", notes: "Works across the academy", linked: false },
    { name: "S. Kaur", email: "", role: "analyst", teamId: "ct1", status: "invited", notes: "", linked: false },
  ];
  return rows.map((r, i) => ({ ...r, id: `cs${i + 1}`, createdAt: iso(150 - i * 10) }));
}

function seedMethodology(): MethodologySection[] {
  const rows: Omit<MethodologySection, "id" | "updatedAt">[] = [
    {
      doc: "play",
      section: "Build-up",
      principles: [
        "Three at the back against two pressers — always a spare player in the first line",
        "The pivot receives on the half-turn or does not receive at all",
        "Attract the press to one side before switching",
      ],
      detail: "Every team in the club builds from the goalkeeper. We accept risk to create the free man.",
      ageGroup: "",
      position: 0,
    },
    {
      doc: "play",
      section: "Pressing",
      principles: [
        "Press the touch, not the pass",
        "Curve the run to lock the inside",
        "Go together or not at all",
      ],
      detail: "We press to win the ball high, and we accept a lower block when the trigger is not there.",
      ageGroup: "",
      position: 1,
    },
    {
      doc: "train",
      section: "Session structure",
      principles: [
        "Every session has one objective, stated to the players before it starts",
        "The theme appears in the warm-up and survives into free play",
        "Ask, do not tell — the last two minutes are questions",
      ],
      detail: "",
      ageGroup: "",
      position: 0,
    },
  ];
  return rows.map((r, i) => ({ ...r, id: `cm${i + 1}`, updatedAt: iso(30 - i * 5) }));
}

function createDB(): ClubDB {
  return {
    club: { id: "org-demo", name: "Northgate FC", level: "Academy", country: "England" },
    teams: seedTeams(),
    staff: seedStaff(),
    methodology: seedMethodology(),
    seq: 300,
  };
}

const g = globalThis as unknown as { __midoClubDB?: ClubDB };
if (!g.__midoClubDB || SHAPE.some((k) => g.__midoClubDB![k] === undefined)) {
  g.__midoClubDB = createDB();
}
const db: ClubDB = g.__midoClubDB;

const nextId = (p: string) => `${p}${db.seq++}`;

function withStaff(team: Omit<ClubTeamRow, "staff">): ClubTeamRow {
  return {
    ...team,
    staff: db.staff
      .filter((s) => s.teamId === team.id && s.status !== "left")
      .map((s) => ({ id: s.id, name: s.name, role: s.role })),
  };
}

export const clubStore = {
  club() {
    return db.club;
  },

  // ── teams ──────────────────────────────────────────────────
  listTeams(): ClubTeamRow[] {
    return db.teams.map(withStaff);
  },
  getTeam(id: string): ClubTeamRow | null {
    const t = db.teams.find((x) => x.id === id);
    return t ? withStaff(t) : null;
  },
  createTeam(input: TeamInput): string {
    const id = nextId("ct");
    db.teams.push({ id, ...input, createdAt: new Date().toISOString() });
    return id;
  },
  updateTeam(id: string, input: TeamInput): boolean {
    const t = db.teams.find((x) => x.id === id);
    if (!t) return false;
    Object.assign(t, input);
    return true;
  },
  deleteTeam(id: string): boolean {
    const i = db.teams.findIndex((t) => t.id === id);
    if (i < 0) return false;
    db.teams.splice(i, 1);
    db.staff.forEach((s) => {
      if (s.teamId === id) s.teamId = null;
    });
    return true;
  },

  // ── staff ──────────────────────────────────────────────────
  listStaff(): StaffMember[] {
    return [...db.staff].sort((a, b) => a.name.localeCompare(b.name));
  },
  getStaff(id: string): StaffMember | null {
    return db.staff.find((s) => s.id === id) ?? null;
  },
  createStaff(input: StaffInput): string {
    const id = nextId("cs");
    db.staff.push({ id, ...input, linked: false, createdAt: new Date().toISOString() });
    return id;
  },
  updateStaff(id: string, input: StaffInput): boolean {
    const s = db.staff.find((x) => x.id === id);
    if (!s) return false;
    Object.assign(s, input);
    return true;
  },
  deleteStaff(id: string): boolean {
    const i = db.staff.findIndex((s) => s.id === id);
    if (i < 0) return false;
    db.staff.splice(i, 1);
    return true;
  },

  // ── methodology ────────────────────────────────────────────
  listMethodology(doc?: MethodologyDoc): MethodologySection[] {
    const rows = doc ? db.methodology.filter((m) => m.doc === doc) : db.methodology;
    return [...rows].sort((a, b) => a.doc.localeCompare(b.doc) || a.position - b.position);
  },
  getSection(id: string): MethodologySection | null {
    return db.methodology.find((m) => m.id === id) ?? null;
  },
  createSection(input: MethodologySectionInput): string {
    const id = nextId("cm");
    const position = db.methodology.filter((m) => m.doc === input.doc).length;
    db.methodology.push({ id, ...input, position, updatedAt: new Date().toISOString() });
    return id;
  },
  updateSection(id: string, input: MethodologySectionInput): boolean {
    const m = db.methodology.find((x) => x.id === id);
    if (!m) return false;
    Object.assign(m, input, { updatedAt: new Date().toISOString() });
    return true;
  },
  deleteSection(id: string): boolean {
    const i = db.methodology.findIndex((m) => m.id === id);
    if (i < 0) return false;
    const { doc } = db.methodology[i];
    db.methodology.splice(i, 1);
    db.methodology
      .filter((m) => m.doc === doc)
      .sort((a, b) => a.position - b.position)
      .forEach((m, idx) => (m.position = idx));
    return true;
  },
  moveSection(id: string, direction: -1 | 1): boolean {
    const target = db.methodology.find((m) => m.id === id);
    if (!target) return false;
    const siblings = db.methodology
      .filter((m) => m.doc === target.doc)
      .sort((a, b) => a.position - b.position);
    const i = siblings.findIndex((m) => m.id === id);
    const j = i + direction;
    if (j < 0 || j >= siblings.length) return false;
    const p = siblings[i].position;
    siblings[i].position = siblings[j].position;
    siblings[j].position = p;
    return true;
  },
};
