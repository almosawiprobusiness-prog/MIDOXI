import "server-only";
import { createClient } from "@/lib/supabase/server";
import { isDemoMode } from "@/lib/env";
import { getCurrentUser } from "@/lib/auth/session";
import { clubStore } from "./club-store";
import {
  methodologyStatus,
  type ClubOverview,
  type ClubTeamRow,
  type MethodologyDoc,
  type MethodologySection,
  type MethodologySectionInput,
  type StaffInput,
  type StaffMember,
  type StaffRole,
  type StaffStatus,
  type TeamInput,
} from "./club-types";

/*
  Club OS data access.

  One branch on isDemoMode per function, identical shapes both sides. In real
  mode everything hangs off the caller's organization — the row in
  `organizations` they own — so a club can never read another club's teams,
  staff or methodology.
*/

async function client() {
  return createClient();
}

/** The organization this user administers, if any. */
export async function currentOrgId(): Promise<string | null> {
  if (isDemoMode) return clubStore.club().id;
  const supabase = await client();
  const user = await getCurrentUser();
  if (!supabase || !user) return null;
  const { data } = await supabase
    .from("organizations")
    .select("id")
    .eq("owner_id", user.id)
    .order("created_at")
    .limit(1)
    .maybeSingle();
  return (data?.id as string) ?? null;
}

// ── teams ────────────────────────────────────────────────────

export async function listTeams(): Promise<ClubTeamRow[]> {
  if (isDemoMode) return clubStore.listTeams();

  const supabase = await client();
  const orgId = await currentOrgId();
  if (!supabase || !orgId) return [];

  const [{ data: teams }, { data: staff }] = await Promise.all([
    supabase.from("teams").select("*").eq("org_id", orgId).order("created_at"),
    supabase.from("org_staff").select("id, display_name, staff_role, team_id, status").eq("org_id", orgId),
  ]);

  return (teams ?? []).map((t) => ({
    id: t.id as string,
    name: (t.name as string) ?? "Team",
    ageGroup: (t.age_group as string) ?? "",
    level: (t.level as string) ?? "",
    season: (t.season as string) ?? "",
    squadSize: (t.squad_size as number) ?? null,
    staff: (staff ?? [])
      .filter((s) => s.team_id === t.id && s.status !== "left")
      .map((s) => ({
        id: s.id as string,
        name: (s.display_name as string) ?? "",
        role: (s.staff_role as StaffRole) ?? "staff",
      })),
    createdAt: (t.created_at as string) ?? new Date().toISOString(),
  }));
}

export async function createTeam(input: TeamInput): Promise<string | null> {
  if (isDemoMode) return clubStore.createTeam(input);
  const supabase = await client();
  const orgId = await currentOrgId();
  if (!supabase || !orgId) return null;
  const { data } = await supabase
    .from("teams")
    .insert({
      org_id: orgId,
      name: input.name,
      age_group: input.ageGroup || null,
      level: input.level || null,
      season: input.season || null,
      squad_size: input.squadSize,
    })
    .select("id")
    .maybeSingle();
  return (data?.id as string) ?? null;
}

export async function updateTeam(id: string, input: TeamInput): Promise<boolean> {
  if (isDemoMode) return clubStore.updateTeam(id, input);
  const supabase = await client();
  if (!supabase) return false;
  const { error } = await supabase
    .from("teams")
    .update({
      name: input.name,
      age_group: input.ageGroup || null,
      level: input.level || null,
      season: input.season || null,
      squad_size: input.squadSize,
    })
    .eq("id", id);
  return !error;
}

export async function deleteTeam(id: string): Promise<boolean> {
  if (isDemoMode) return clubStore.deleteTeam(id);
  const supabase = await client();
  if (!supabase) return false;
  const { error } = await supabase.from("teams").delete().eq("id", id);
  return !error;
}

// ── staff ────────────────────────────────────────────────────

function rowToStaff(r: Record<string, unknown>): StaffMember {
  return {
    id: r.id as string,
    name: (r.display_name as string) ?? "",
    email: (r.email as string) ?? "",
    role: (r.staff_role as StaffRole) ?? "staff",
    teamId: (r.team_id as string) ?? null,
    status: (r.status as StaffStatus) ?? "recorded",
    notes: (r.notes as string) ?? "",
    linked: Boolean(r.member_id),
    createdAt: (r.created_at as string) ?? new Date().toISOString(),
  };
}

export async function listStaff(): Promise<StaffMember[]> {
  if (isDemoMode) return clubStore.listStaff();
  const supabase = await client();
  const orgId = await currentOrgId();
  if (!supabase || !orgId) return [];
  const { data } = await supabase.from("org_staff").select("*").eq("org_id", orgId).order("display_name");
  return (data ?? []).map(rowToStaff);
}

function staffColumns(input: StaffInput) {
  return {
    display_name: input.name,
    email: input.email || null,
    staff_role: input.role,
    team_id: input.teamId,
    status: input.status,
    notes: input.notes || null,
  };
}

export async function createStaff(input: StaffInput): Promise<string | null> {
  if (isDemoMode) return clubStore.createStaff(input);
  const supabase = await client();
  const orgId = await currentOrgId();
  if (!supabase || !orgId) return null;
  const { data } = await supabase
    .from("org_staff")
    .insert({ org_id: orgId, ...staffColumns(input) })
    .select("id")
    .maybeSingle();
  return (data?.id as string) ?? null;
}

export async function updateStaff(id: string, input: StaffInput): Promise<boolean> {
  if (isDemoMode) return clubStore.updateStaff(id, input);
  const supabase = await client();
  if (!supabase) return false;
  const { error } = await supabase.from("org_staff").update(staffColumns(input)).eq("id", id);
  return !error;
}

export async function deleteStaff(id: string): Promise<boolean> {
  if (isDemoMode) return clubStore.deleteStaff(id);
  const supabase = await client();
  if (!supabase) return false;
  const { error } = await supabase.from("org_staff").delete().eq("id", id);
  return !error;
}

// ── methodology ──────────────────────────────────────────────

function rowToSection(r: Record<string, unknown>): MethodologySection {
  return {
    id: r.id as string,
    doc: (r.doc as MethodologyDoc) ?? "play",
    section: (r.section as string) ?? "",
    principles: (r.principles as string[]) ?? [],
    detail: (r.detail as string) ?? "",
    ageGroup: (r.age_group as string) ?? "",
    position: (r.position as number) ?? 0,
    updatedAt: (r.updated_at as string) ?? new Date().toISOString(),
  };
}

export async function listMethodology(doc?: MethodologyDoc): Promise<MethodologySection[]> {
  if (isDemoMode) return clubStore.listMethodology(doc);
  const supabase = await client();
  const orgId = await currentOrgId();
  if (!supabase || !orgId) return [];
  let query = supabase.from("club_methodology").select("*").eq("org_id", orgId).order("position");
  if (doc) query = query.eq("doc", doc);
  const { data } = await query;
  return (data ?? []).map(rowToSection);
}

export async function getSection(id: string): Promise<MethodologySection | null> {
  if (isDemoMode) return clubStore.getSection(id);
  const supabase = await client();
  if (!supabase) return null;
  const { data } = await supabase.from("club_methodology").select("*").eq("id", id).maybeSingle();
  return data ? rowToSection(data) : null;
}

export async function createSection(input: MethodologySectionInput): Promise<string | null> {
  if (isDemoMode) return clubStore.createSection(input);
  const supabase = await client();
  const orgId = await currentOrgId();
  if (!supabase || !orgId) return null;
  const { count } = await supabase
    .from("club_methodology")
    .select("id", { count: "exact", head: true })
    .eq("org_id", orgId)
    .eq("doc", input.doc);
  const { data } = await supabase
    .from("club_methodology")
    .insert({
      org_id: orgId,
      doc: input.doc,
      section: input.section,
      principles: input.principles,
      detail: input.detail || null,
      age_group: input.ageGroup || null,
      position: count ?? 0,
    })
    .select("id")
    .maybeSingle();
  return (data?.id as string) ?? null;
}

export async function updateSection(id: string, input: MethodologySectionInput): Promise<boolean> {
  if (isDemoMode) return clubStore.updateSection(id, input);
  const supabase = await client();
  if (!supabase) return false;
  const { error } = await supabase
    .from("club_methodology")
    .update({
      doc: input.doc,
      section: input.section,
      principles: input.principles,
      detail: input.detail || null,
      age_group: input.ageGroup || null,
    })
    .eq("id", id);
  return !error;
}

export async function deleteSection(id: string): Promise<boolean> {
  if (isDemoMode) return clubStore.deleteSection(id);
  const supabase = await client();
  if (!supabase) return false;
  const { error } = await supabase.from("club_methodology").delete().eq("id", id);
  return !error;
}

export async function moveSection(id: string, direction: -1 | 1): Promise<boolean> {
  if (isDemoMode) return clubStore.moveSection(id, direction);
  const supabase = await client();
  if (!supabase) return false;
  const { data: section } = await supabase
    .from("club_methodology")
    .select("id, doc, org_id, position")
    .eq("id", id)
    .maybeSingle();
  if (!section) return false;
  const { data: siblings } = await supabase
    .from("club_methodology")
    .select("id, position")
    .eq("org_id", section.org_id)
    .eq("doc", section.doc)
    .order("position");
  const list = siblings ?? [];
  const i = list.findIndex((s) => s.id === id);
  const j = i + direction;
  if (i < 0 || j < 0 || j >= list.length) return false;
  await Promise.all([
    supabase.from("club_methodology").update({ position: list[j].position }).eq("id", list[i].id),
    supabase.from("club_methodology").update({ position: list[i].position }).eq("id", list[j].id),
  ]);
  return true;
}

// ── the overview ─────────────────────────────────────────────

export async function getClubOverview(): Promise<ClubOverview> {
  if (isDemoMode) {
    const club = clubStore.club();
    const teams = clubStore.listTeams();
    return {
      isDemo: true,
      orgId: club.id,
      clubName: club.name,
      level: club.level,
      teams,
      staff: clubStore.listStaff(),
      methodology: methodologyStatus(clubStore.listMethodology()),
      recordedPlayers: teams.reduce((n, t) => n + (t.squadSize ?? 0), 0),
    };
  }

  const supabase = await client();
  const user = await getCurrentUser();
  const empty: ClubOverview = {
    isDemo: false,
    orgId: null,
    clubName: "Your club",
    level: "",
    teams: [],
    staff: [],
    methodology: { play: 0, train: 0, develop: 0, principles: 0, documentsStarted: 0 },
    recordedPlayers: 0,
  };
  if (!supabase || !user) return empty;

  const orgId = await currentOrgId();
  if (!orgId) {
    const { data: profile } = await supabase
      .from("club_profiles")
      .select("club_name, level")
      .eq("user_id", user.id)
      .maybeSingle();
    return { ...empty, clubName: profile?.club_name || "Your club", level: profile?.level ?? "" };
  }

  const [{ data: org }, teams, staff, sections] = await Promise.all([
    supabase.from("organizations").select("name, level").eq("id", orgId).maybeSingle(),
    listTeams(),
    listStaff(),
    listMethodology(),
  ]);

  return {
    isDemo: false,
    orgId,
    clubName: (org?.name as string) ?? "Your club",
    level: (org?.level as string) ?? "",
    teams,
    staff,
    methodology: methodologyStatus(sections),
    recordedPlayers: teams.reduce((n, t) => n + (t.squadSize ?? 0), 0),
  };
}

/**
 * The club's methodology, compacted for an AI prompt.
 *
 * This is the point of writing it down: a coach in this organization asking for
 * a session gets one that answers to THIS club's principles. Returns an empty
 * array when nothing is written — MIDO then answers generically and says so,
 * rather than pretending to a methodology that does not exist.
 */
export async function methodologyContext(doc?: MethodologyDoc): Promise<string[]> {
  const sections = await listMethodology(doc);
  // One principle per line: a coaching point is a single instruction, and the
  // AI reads them better separated than as a paragraph per section.
  return sections.flatMap((s) =>
    s.principles.map((p) => `${s.section}${s.ageGroup ? ` (${s.ageGroup})` : ""} — ${p}`),
  );
}
