/*
  Club OS — shared shapes. Client-safe: types, constants and pure helpers.
*/

// ── teams ────────────────────────────────────────────────────

export interface ClubTeamRow {
  id: string;
  name: string;
  ageGroup: string;
  level: string;
  season: string;
  /** Squad size the club maintains — recorded, not derived. */
  squadSize: number | null;
  /** Staff assigned to this team, by name. */
  staff: { id: string; name: string; role: StaffRole }[];
  createdAt: string;
}

export interface TeamInput {
  name: string;
  ageGroup: string;
  level: string;
  season: string;
  squadSize: number | null;
}

// ── staff ────────────────────────────────────────────────────

export type StaffRole =
  | "admin"
  | "head-coach"
  | "coach"
  | "trainer"
  | "analyst"
  | "physio"
  | "scout"
  | "staff";

export type StaffStatus = "recorded" | "invited" | "active" | "left";

export interface StaffMember {
  id: string;
  name: string;
  email: string;
  role: StaffRole;
  teamId: string | null;
  status: StaffStatus;
  notes: string;
  /** True when this person has joined with their own MIDO XI account. */
  linked: boolean;
  createdAt: string;
}

export interface StaffInput {
  name: string;
  email: string;
  role: StaffRole;
  teamId: string | null;
  status: StaffStatus;
  notes: string;
}

export const STAFF_ROLES: { value: StaffRole; label: string; color: string }[] = [
  { value: "admin", label: "Admin", color: "var(--signal-bright)" },
  { value: "head-coach", label: "Head coach", color: "var(--info)" },
  { value: "coach", label: "Coach", color: "var(--info)" },
  { value: "trainer", label: "Trainer", color: "var(--positive)" },
  { value: "analyst", label: "Analyst", color: "#c58bff" },
  { value: "physio", label: "Physio", color: "var(--review)" },
  { value: "scout", label: "Scout", color: "var(--text-dim)" },
  { value: "staff", label: "Staff", color: "var(--text-dim)" },
];

export function staffRoleMeta(role: StaffRole) {
  return STAFF_ROLES.find((r) => r.value === role) ?? STAFF_ROLES[7];
}

export const STAFF_STATUS: { value: StaffStatus; label: string; color: string }[] = [
  { value: "recorded", label: "Recorded", color: "var(--text-dim)" },
  { value: "invited", label: "Invited", color: "var(--review)" },
  { value: "active", label: "Active", color: "var(--positive)" },
  { value: "left", label: "Left", color: "var(--text-faint)" },
];

export function staffStatusMeta(status: StaffStatus) {
  return STAFF_STATUS.find((s) => s.value === status) ?? STAFF_STATUS[0];
}

// ── methodology ──────────────────────────────────────────────

export type MethodologyDoc = "play" | "train" | "develop";

export interface MethodologySection {
  id: string;
  doc: MethodologyDoc;
  section: string;
  principles: string[];
  detail: string;
  ageGroup: string;
  position: number;
  updatedAt: string;
}

export interface MethodologySectionInput {
  doc: MethodologyDoc;
  section: string;
  principles: string[];
  detail: string;
  ageGroup: string;
}

export const METHODOLOGY_DOCS: {
  doc: MethodologyDoc;
  title: string;
  tagline: string;
  /** What belongs in this document — shown as the empty state, and as prompts. */
  suggested: string[];
  color: string;
}[] = [
  {
    doc: "play",
    title: "How we play",
    tagline: "The football every team in the club is trying to play.",
    suggested: ["Build-up", "Attacking principles", "Pressing", "Defending", "Transition", "Set pieces"],
    color: "var(--signal-bright)",
  },
  {
    doc: "train",
    title: "How we train",
    tagline: "Session methodology, physical philosophy and coaching standards.",
    suggested: ["Session structure", "Physical philosophy", "Coaching standards", "The training week"],
    color: "var(--info)",
  },
  {
    doc: "develop",
    title: "How we develop players",
    tagline: "What a player should be able to do, and by when.",
    suggested: ["U12-U14", "U15-U16", "U17-U19", "First team", "Individual development plans"],
    color: "var(--positive)",
  },
];

export function docMeta(doc: MethodologyDoc) {
  return METHODOLOGY_DOCS.find((d) => d.doc === doc) ?? METHODOLOGY_DOCS[0];
}

export interface MethodologyStatus {
  play: number;
  train: number;
  develop: number;
  /** Total principles written across all three documents. */
  principles: number;
  /** How many of the three documents have anything in them. */
  documentsStarted: number;
}

export function methodologyStatus(sections: MethodologySection[]): MethodologyStatus {
  const count = (doc: MethodologyDoc) => sections.filter((s) => s.doc === doc).length;
  const status = {
    play: count("play"),
    train: count("train"),
    develop: count("develop"),
    principles: sections.reduce((n, s) => n + s.principles.length, 0),
    documentsStarted: 0,
  };
  status.documentsStarted = [status.play, status.train, status.develop].filter((n) => n > 0).length;
  return status;
}

// ── the club dashboard / intelligence layer ──────────────────

export interface ClubOverview {
  isDemo: boolean;
  orgId: string | null;
  clubName: string;
  level: string;
  teams: ClubTeamRow[];
  staff: StaffMember[];
  methodology: MethodologyStatus;
  /** Recorded squad sizes summed — never an estimate. */
  recordedPlayers: number;
}

/** Teams with nobody assigned to them — the club's most actionable gap. */
export function teamsWithoutStaff(teams: ClubTeamRow[]): ClubTeamRow[] {
  return teams.filter((t) => t.staff.length === 0);
}
