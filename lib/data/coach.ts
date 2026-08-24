import "server-only";
import { createClient, getAuthUser } from "@/lib/supabase/server";
import { isDemoMode } from "@/lib/env";
import { coachStore } from "./coach-store";
import type {
  SquadPlayer,
  SquadPlayerInput,
  PlayerNote,
  PlayerNoteKind,
  SessionPlan,
  SessionPlanInput,
  SessionPlanDetail,
  SessionBlock,
  SessionBlockInput,
  TacticalBoard,
  TacticalBoardInput,
  BoardData,
  OppositionReport,
  OppositionReportInput,
  MatchPlan,
} from "./coach-types";

/*
  Coach OS data access.

  One branch on isDemoMode per function, identical shapes both sides — the same
  contract every other MIDO XI data module follows. Reads are defensive: a
  missing table or a signed-out user returns an empty result, never a crash.
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

// ── squad ────────────────────────────────────────────────────

function rowToPlayer(r: Record<string, unknown>): SquadPlayer {
  return {
    id: r.id as string,
    name: (r.display_name as string) ?? "Player",
    position: (r.position as string) ?? "",
    squadNumber: (r.squad_number as number) ?? null,
    status: (r.status as SquadPlayer["status"]) ?? "active",
    focus: (r.notes as string) ?? null,
    linked: Boolean(r.player_id),
    shareScope: r.player_id ? ((r.share_scope as SquadPlayer["shareScope"]) ?? "identity") : null,
    createdAt: (r.created_at as string) ?? new Date().toISOString(),
  };
}

export async function listSquad(): Promise<SquadPlayer[]> {
  if (isDemoMode) return coachStore.listSquad();
  const supabase = await client();
  if (!supabase) return [];
  const { data } = await supabase
    .from("coach_players")
    .select("*")
    .order("squad_number", { ascending: true, nullsFirst: false });
  return (data ?? []).map(rowToPlayer);
}

export async function getSquadPlayer(id: string): Promise<SquadPlayer | null> {
  if (isDemoMode) return coachStore.getPlayer(id);
  const supabase = await client();
  if (!supabase) return null;
  const { data } = await supabase.from("coach_players").select("*").eq("id", id).maybeSingle();
  return data ? rowToPlayer(data) : null;
}

export async function createSquadPlayer(input: SquadPlayerInput): Promise<string | null> {
  if (isDemoMode) return coachStore.createPlayer(input);
  const supabase = await client();
  const uid = await userId();
  if (!supabase || !uid) return null;
  const { data } = await supabase
    .from("coach_players")
    .insert({
      coach_id: uid,
      display_name: input.name,
      position: input.position || null,
      squad_number: input.squadNumber,
      status: input.status,
      notes: input.focus || null,
    })
    .select("id")
    .maybeSingle();
  return (data?.id as string) ?? null;
}

export async function updateSquadPlayer(id: string, input: SquadPlayerInput): Promise<boolean> {
  if (isDemoMode) return coachStore.updatePlayer(id, input);
  const supabase = await client();
  if (!supabase) return false;
  const { error } = await supabase
    .from("coach_players")
    .update({
      display_name: input.name,
      position: input.position || null,
      squad_number: input.squadNumber,
      status: input.status,
      notes: input.focus || null,
    })
    .eq("id", id);
  return !error;
}

export async function deleteSquadPlayer(id: string): Promise<boolean> {
  if (isDemoMode) return coachStore.deletePlayer(id);
  const supabase = await client();
  if (!supabase) return false;
  const { error } = await supabase.from("coach_players").delete().eq("id", id);
  return !error;
}

export async function listPlayerNotes(playerId: string): Promise<PlayerNote[]> {
  if (isDemoMode) return coachStore.listNotes(playerId);
  const supabase = await client();
  if (!supabase) return [];
  const { data } = await supabase
    .from("coach_player_notes")
    .select("*")
    .eq("squad_player_id", playerId)
    .order("created_at", { ascending: false });
  return (data ?? []).map((n) => ({
    id: n.id as string,
    playerId: n.squad_player_id as string,
    kind: (n.kind as PlayerNoteKind) ?? "note",
    body: (n.body as string) ?? "",
    createdAt: (n.created_at as string) ?? new Date().toISOString(),
  }));
}

export async function addPlayerNote(
  playerId: string,
  kind: PlayerNoteKind,
  body: string,
): Promise<boolean> {
  if (isDemoMode) return Boolean(coachStore.addNote(playerId, kind, body));
  const supabase = await client();
  const uid = await userId();
  if (!supabase || !uid) return false;
  const { error } = await supabase
    .from("coach_player_notes")
    .insert({ squad_player_id: playerId, user_id: uid, kind, body });
  if (error) return false;
  // A new development focus becomes the player's headline.
  if (kind === "focus") {
    await supabase.from("coach_players").update({ notes: body.slice(0, 120) }).eq("id", playerId);
  }
  return true;
}

export async function deletePlayerNote(id: string): Promise<boolean> {
  if (isDemoMode) return coachStore.deleteNote(id);
  const supabase = await client();
  if (!supabase) return false;
  const { error } = await supabase.from("coach_player_notes").delete().eq("id", id);
  return !error;
}

// ── session plans ────────────────────────────────────────────

function rowToPlan(r: Record<string, unknown>): SessionPlan {
  return {
    id: r.id as string,
    title: (r.title as string) ?? "Session",
    scheduledAt: (r.scheduled_at as string) ?? null,
    durationMin: (r.duration_min as number) ?? null,
    objective: (r.objective as string) ?? "",
    playersCount: (r.players_count as number) ?? null,
    pitch: (r.pitch as string) ?? "",
    intensity: (r.intensity as SessionPlan["intensity"]) ?? null,
    status: (r.status as SessionPlan["status"]) ?? "draft",
    source: (r.source as SessionPlan["source"]) ?? "coach",
    notes: (r.notes as string) ?? "",
    createdAt: (r.created_at as string) ?? new Date().toISOString(),
  };
}

function rowToBlock(r: Record<string, unknown>): SessionBlock {
  return {
    id: r.id as string,
    phase: (r.phase as SessionBlock["phase"]) ?? "technical",
    name: (r.name as string) ?? "",
    durationMin: (r.duration_min as number) ?? null,
    organisation: (r.organisation as string) ?? "",
    coachingPoints: (r.coaching_points as string[]) ?? [],
    progression: (r.progression as string) ?? "",
    regression: (r.regression as string) ?? "",
    position: (r.position as number) ?? 0,
  };
}

export async function listSessionPlans(): Promise<SessionPlan[]> {
  if (isDemoMode) return coachStore.listPlans();
  const supabase = await client();
  if (!supabase) return [];
  const { data } = await supabase
    .from("session_plans")
    .select("*")
    .order("scheduled_at", { ascending: false, nullsFirst: false });
  return (data ?? []).map(rowToPlan);
}

export async function getSessionPlan(id: string): Promise<SessionPlanDetail | null> {
  if (isDemoMode) return coachStore.getPlan(id);
  const supabase = await client();
  if (!supabase) return null;
  const { data: plan } = await supabase.from("session_plans").select("*").eq("id", id).maybeSingle();
  if (!plan) return null;
  const { data: blocks } = await supabase
    .from("session_blocks")
    .select("*")
    .eq("plan_id", id)
    .order("position");
  return { plan: rowToPlan(plan), blocks: (blocks ?? []).map(rowToBlock) };
}

export async function createSessionPlan(
  input: SessionPlanInput,
  source: SessionPlan["source"] = "coach",
): Promise<string | null> {
  if (isDemoMode) return coachStore.createPlan(input, source);
  const supabase = await client();
  const uid = await userId();
  if (!supabase || !uid) return null;
  const { data } = await supabase
    .from("session_plans")
    .insert({
      user_id: uid,
      title: input.title,
      scheduled_at: input.scheduledAt ? new Date(input.scheduledAt).toISOString() : null,
      duration_min: input.durationMin,
      objective: input.objective || null,
      players_count: input.playersCount,
      pitch: input.pitch || null,
      intensity: input.intensity,
      status: input.status,
      source,
    })
    .select("id")
    .maybeSingle();
  return (data?.id as string) ?? null;
}

export async function updateSessionPlan(id: string, input: SessionPlanInput): Promise<boolean> {
  if (isDemoMode) return coachStore.updatePlan(id, input);
  const supabase = await client();
  if (!supabase) return false;
  const { error } = await supabase
    .from("session_plans")
    .update({
      title: input.title,
      scheduled_at: input.scheduledAt ? new Date(input.scheduledAt).toISOString() : null,
      duration_min: input.durationMin,
      objective: input.objective || null,
      players_count: input.playersCount,
      pitch: input.pitch || null,
      intensity: input.intensity,
      status: input.status,
    })
    .eq("id", id);
  return !error;
}

export async function deleteSessionPlan(id: string): Promise<boolean> {
  if (isDemoMode) return coachStore.deletePlan(id);
  const supabase = await client();
  if (!supabase) return false;
  const { error } = await supabase.from("session_plans").delete().eq("id", id);
  return !error;
}

export async function addSessionBlock(planId: string, input: SessionBlockInput): Promise<boolean> {
  if (isDemoMode) return Boolean(coachStore.addBlock(planId, input));
  const supabase = await client();
  const uid = await userId();
  if (!supabase || !uid) return false;
  const { count } = await supabase
    .from("session_blocks")
    .select("id", { count: "exact", head: true })
    .eq("plan_id", planId);
  const { error } = await supabase.from("session_blocks").insert({
    plan_id: planId,
    user_id: uid,
    phase: input.phase,
    name: input.name,
    duration_min: input.durationMin,
    organisation: input.organisation || null,
    coaching_points: input.coachingPoints,
    progression: input.progression || null,
    regression: input.regression || null,
    position: count ?? 0,
  });
  return !error;
}

export async function updateSessionBlock(id: string, input: SessionBlockInput): Promise<boolean> {
  if (isDemoMode) return coachStore.updateBlock(id, input);
  const supabase = await client();
  if (!supabase) return false;
  const { error } = await supabase
    .from("session_blocks")
    .update({
      phase: input.phase,
      name: input.name,
      duration_min: input.durationMin,
      organisation: input.organisation || null,
      coaching_points: input.coachingPoints,
      progression: input.progression || null,
      regression: input.regression || null,
    })
    .eq("id", id);
  return !error;
}

export async function deleteSessionBlock(id: string): Promise<boolean> {
  if (isDemoMode) return coachStore.deleteBlock(id);
  const supabase = await client();
  if (!supabase) return false;
  const { error } = await supabase.from("session_blocks").delete().eq("id", id);
  return !error;
}

export async function moveSessionBlock(id: string, direction: -1 | 1): Promise<boolean> {
  if (isDemoMode) return coachStore.moveBlock(id, direction);
  const supabase = await client();
  if (!supabase) return false;
  const { data: block } = await supabase
    .from("session_blocks")
    .select("id, plan_id, position")
    .eq("id", id)
    .maybeSingle();
  if (!block) return false;
  const { data: siblings } = await supabase
    .from("session_blocks")
    .select("id, position")
    .eq("plan_id", block.plan_id)
    .order("position");
  const list = siblings ?? [];
  const i = list.findIndex((b) => b.id === id);
  const j = i + direction;
  if (i < 0 || j < 0 || j >= list.length) return false;
  await Promise.all([
    supabase.from("session_blocks").update({ position: list[j].position }).eq("id", list[i].id),
    supabase.from("session_blocks").update({ position: list[i].position }).eq("id", list[j].id),
  ]);
  return true;
}

/** Used when MIDO drafts a whole session: replaces the plan's blocks in one go. */
export async function replaceSessionBlocks(
  planId: string,
  inputs: SessionBlockInput[],
): Promise<boolean> {
  if (isDemoMode) {
    coachStore.replaceBlocks(planId, inputs);
    return true;
  }
  const supabase = await client();
  const uid = await userId();
  if (!supabase || !uid) return false;
  await supabase.from("session_blocks").delete().eq("plan_id", planId);
  const { error } = await supabase.from("session_blocks").insert(
    inputs.map((input, i) => ({
      plan_id: planId,
      user_id: uid,
      phase: input.phase,
      name: input.name,
      duration_min: input.durationMin,
      organisation: input.organisation || null,
      coaching_points: input.coachingPoints,
      progression: input.progression || null,
      regression: input.regression || null,
      position: i,
    })),
  );
  return !error;
}

// ── tactical boards ──────────────────────────────────────────

function rowToBoard(r: Record<string, unknown>): TacticalBoard {
  return {
    id: r.id as string,
    title: (r.title as string) ?? "Board",
    formation: (r.formation as string) ?? "4-3-3",
    phase: (r.phase as TacticalBoard["phase"]) ?? "in-possession",
    board: ((r.board as BoardData) ?? { tokens: [], arrows: [], zones: [] }) as BoardData,
    notes: (r.notes as string) ?? "",
    createdAt: (r.created_at as string) ?? new Date().toISOString(),
    updatedAt: (r.updated_at as string) ?? new Date().toISOString(),
  };
}

export async function listBoards(): Promise<TacticalBoard[]> {
  if (isDemoMode) return coachStore.listBoards();
  const supabase = await client();
  if (!supabase) return [];
  const { data } = await supabase.from("tactical_boards").select("*").order("updated_at", { ascending: false });
  return (data ?? []).map(rowToBoard);
}

export async function getBoard(id: string): Promise<TacticalBoard | null> {
  if (isDemoMode) return coachStore.getBoard(id);
  const supabase = await client();
  if (!supabase) return null;
  const { data } = await supabase.from("tactical_boards").select("*").eq("id", id).maybeSingle();
  return data ? rowToBoard(data) : null;
}

export async function createBoard(input: TacticalBoardInput): Promise<string | null> {
  if (isDemoMode) return coachStore.createBoard(input);
  const supabase = await client();
  const uid = await userId();
  if (!supabase || !uid) return null;
  const { data } = await supabase
    .from("tactical_boards")
    .insert({
      user_id: uid,
      title: input.title,
      formation: input.formation,
      phase: input.phase,
      board: input.board,
      notes: input.notes || null,
    })
    .select("id")
    .maybeSingle();
  return (data?.id as string) ?? null;
}

export async function updateBoard(id: string, input: TacticalBoardInput): Promise<boolean> {
  if (isDemoMode) return coachStore.updateBoard(id, input);
  const supabase = await client();
  if (!supabase) return false;
  const { error } = await supabase
    .from("tactical_boards")
    .update({
      title: input.title,
      formation: input.formation,
      phase: input.phase,
      board: input.board,
      notes: input.notes || null,
    })
    .eq("id", id);
  return !error;
}

export async function deleteBoard(id: string): Promise<boolean> {
  if (isDemoMode) return coachStore.deleteBoard(id);
  const supabase = await client();
  if (!supabase) return false;
  const { error } = await supabase.from("tactical_boards").delete().eq("id", id);
  return !error;
}

// ── opposition ───────────────────────────────────────────────

function rowToReport(r: Record<string, unknown>): OppositionReport {
  return {
    id: r.id as string,
    opponent: (r.opponent as string) ?? "",
    competition: (r.competition as string) ?? "",
    matchDate: (r.match_date as string) ?? null,
    home: (r.home as boolean) ?? null,
    formation: (r.formation as string) ?? "",
    keyPlayers: (r.key_players as OppositionReport["keyPlayers"]) ?? [],
    inPossession: (r.in_possession as string[]) ?? [],
    outOfPossession: (r.out_of_possession as string[]) ?? [],
    transition: (r.transition as string[]) ?? [],
    setPieces: (r.set_pieces as string[]) ?? [],
    weaknesses: (r.weaknesses as string[]) ?? [],
    notes: (r.notes as string) ?? "",
    plan: (r.plan as MatchPlan) ?? null,
    planSource: (r.plan_source as OppositionReport["planSource"]) ?? null,
    createdAt: (r.created_at as string) ?? new Date().toISOString(),
  };
}

export async function listOppositionReports(): Promise<OppositionReport[]> {
  if (isDemoMode) return coachStore.listReports();
  const supabase = await client();
  if (!supabase) return [];
  const { data } = await supabase
    .from("opposition_reports")
    .select("*")
    .order("match_date", { ascending: false, nullsFirst: false });
  return (data ?? []).map(rowToReport);
}

export async function getOppositionReport(id: string): Promise<OppositionReport | null> {
  if (isDemoMode) return coachStore.getReport(id);
  const supabase = await client();
  if (!supabase) return null;
  const { data } = await supabase.from("opposition_reports").select("*").eq("id", id).maybeSingle();
  return data ? rowToReport(data) : null;
}

function reportColumns(input: OppositionReportInput) {
  return {
    opponent: input.opponent,
    competition: input.competition || null,
    match_date: input.matchDate || null,
    home: input.home,
    formation: input.formation || null,
    key_players: input.keyPlayers,
    in_possession: input.inPossession,
    out_of_possession: input.outOfPossession,
    transition: input.transition,
    set_pieces: input.setPieces,
    weaknesses: input.weaknesses,
    notes: input.notes || null,
  };
}

export async function createOppositionReport(input: OppositionReportInput): Promise<string | null> {
  if (isDemoMode) return coachStore.createReport(input);
  const supabase = await client();
  const uid = await userId();
  if (!supabase || !uid) return null;
  const { data } = await supabase
    .from("opposition_reports")
    .insert({ user_id: uid, ...reportColumns(input) })
    .select("id")
    .maybeSingle();
  return (data?.id as string) ?? null;
}

export async function updateOppositionReport(
  id: string,
  input: OppositionReportInput,
): Promise<boolean> {
  if (isDemoMode) return coachStore.updateReport(id, input);
  const supabase = await client();
  if (!supabase) return false;
  const { error } = await supabase.from("opposition_reports").update(reportColumns(input)).eq("id", id);
  return !error;
}

export async function deleteOppositionReport(id: string): Promise<boolean> {
  if (isDemoMode) return coachStore.deleteReport(id);
  const supabase = await client();
  if (!supabase) return false;
  const { error } = await supabase.from("opposition_reports").delete().eq("id", id);
  return !error;
}

export async function saveMatchPlan(
  id: string,
  plan: MatchPlan,
  source: "coach" | "mido",
): Promise<boolean> {
  if (isDemoMode) return coachStore.savePlan(id, plan, source);
  const supabase = await client();
  if (!supabase) return false;
  const { error } = await supabase
    .from("opposition_reports")
    .update({ plan, plan_source: source })
    .eq("id", id);
  return !error;
}
