import "server-only";
import { createClient, getAuthUser } from "@/lib/supabase/server";
import { isDemoMode } from "@/lib/env";
import { boardStore } from "./board-store";
import {
  DEFAULT_ORIGIN,
  cloneDocument,
  countDocument,
  documentFromFormation,
  toDocument,
  toLegacy,
} from "@/lib/tactics/document";
import { boardKeywords } from "@/lib/tactics/describe";
import { DEFAULT_PITCH, type TacticalBoard, type TacticalBoardInput, type TacticalDocument } from "@/lib/tactics/types";
import {
  documentForLink,
  type BoardEntityType,
  type BoardLink,
  type BoardLinkInput,
} from "@/lib/tactics/links";

/*
  Boards, for every operating system.

  This replaced the board half of `lib/data/coach.ts`, which lived there
  because the board used to be a coach feature. It is now infrastructure
  — a trainer's exercise, a player's goal and an opposition report all
  read through here — so it owns its own module rather than being
  imported out of another role's data layer.

  TWO THINGS THIS FILE IS CAREFUL ABOUT.

  Reading never trusts the column. `toDocument` accepts the v2 document,
  the v1 `{tokens, arrows, zones}`, or nothing at all, and always returns
  something renderable. That is what lets boards written in 2026 open
  beside boards written today without a data migration.

  Writing keeps both columns in step. `doc` is the source of truth;
  `board` receives the v1 projection so a rollback to the previous deploy
  still renders every board. Keywords are recomputed on write so search
  cannot drift from what is actually drawn.
*/

async function client() {
  return createClient();
}

async function userId(): Promise<string | null> {
  const u = await getAuthUser();
  return u?.id ?? null;
}

// ── row ⇄ board ──────────────────────────────────────────────

function rowToBoard(r: Record<string, unknown>): TacticalBoard {
  const doc = toDocument(r.doc ?? r.board, DEFAULT_PITCH);
  return {
    id: r.id as string,
    title: (r.title as string) ?? "Board",
    kind: ((r.kind as TacticalBoard["kind"]) ?? "tactical"),
    phase: (r.phase as TacticalBoard["phase"]) ?? "in-possession",
    formation: (r.formation as string) ?? doc.formation ?? "4-3-3",
    notes: (r.notes as string) ?? "",
    tags: Array.isArray(r.tags) ? (r.tags as string[]) : [],
    visibility: ((r.visibility as TacticalBoard["visibility"]) ?? "private"),
    origin: (r.origin as TacticalBoard["origin"]) ?? DEFAULT_ORIGIN,
    doc,
    archivedAt: (r.archived_at as string) ?? null,
    createdAt: (r.created_at as string) ?? new Date().toISOString(),
    updatedAt: (r.updated_at as string) ?? new Date().toISOString(),
  };
}

/** Every column a write touches, derived once so insert and update agree. */
function boardWrite(input: TacticalBoardInput) {
  const doc = input.doc;
  return {
    title: input.title,
    kind: input.kind ?? "tactical",
    phase: input.phase,
    formation: input.formation,
    notes: input.notes || null,
    objective: doc.objective || null,
    tags: input.tags ?? [],
    visibility: input.visibility ?? "private",
    origin: input.origin ?? DEFAULT_ORIGIN,
    doc,
    // The v1 column, kept alive deliberately — see the header.
    board: toLegacy(doc),
    keywords: boardKeywords({
      title: input.title,
      phase: input.phase,
      formation: input.formation,
      notes: input.notes,
      tags: input.tags,
      doc,
    }),
  };
}

// ── reading ──────────────────────────────────────────────────

export interface BoardQuery {
  kind?: TacticalBoard["kind"];
  phase?: TacticalBoard["phase"];
  /** Free text over title, notes and derived keywords. */
  text?: string;
  tag?: string;
  includeArchived?: boolean;
  limit?: number;
}

export async function listBoards(q: BoardQuery = {}): Promise<TacticalBoard[]> {
  if (isDemoMode) return boardStore.list(q);

  const supabase = await client();
  if (!supabase) return [];

  let query = supabase.from("tactical_boards").select("*").order("updated_at", { ascending: false });
  if (q.kind) query = query.eq("kind", q.kind);
  if (q.phase) query = query.eq("phase", q.phase);
  if (q.tag) query = query.contains("tags", [q.tag]);
  if (!q.includeArchived) query = query.is("archived_at", null);
  query = query.limit(q.limit ?? 100);

  const { data } = await query;
  const boards = (data ?? []).map(rowToBoard);
  return q.text ? filterByText(boards, q.text) : boards;
}

/**
 * Text matching in code rather than SQL.
 *
 * The searchable surface includes derived keywords, which are computed
 * from the document — pushing that into a query means either a second
 * round trip or a `or(...)` string built from user input. At the volume
 * one account's boards reach, filtering the fetched rows is both simpler
 * and safer.
 */
function filterByText(boards: TacticalBoard[], text: string): TacticalBoard[] {
  const terms = text.toLowerCase().split(/\s+/).filter(Boolean);
  if (!terms.length) return boards;
  return boards.filter((b) => {
    const hay = [
      b.title,
      b.notes,
      b.formation,
      b.phase,
      b.doc.objective ?? "",
      ...b.tags,
      ...boardKeywords({ title: b.title, phase: b.phase, formation: b.formation, notes: b.notes, tags: b.tags, doc: b.doc }),
    ]
      .join("\n")
      .toLowerCase();
    return terms.every((t) => hay.includes(t));
  });
}

export async function getBoard(id: string): Promise<TacticalBoard | null> {
  if (isDemoMode) return boardStore.get(id);
  const supabase = await client();
  if (!supabase) return null;
  const { data } = await supabase.from("tactical_boards").select("*").eq("id", id).maybeSingle();
  return data ? rowToBoard(data) : null;
}

// ── writing ──────────────────────────────────────────────────

export async function createBoard(input: TacticalBoardInput): Promise<string | null> {
  if (isDemoMode) return boardStore.create(input);
  const supabase = await client();
  const uid = await userId();
  if (!supabase || !uid) return null;
  const { data } = await supabase
    .from("tactical_boards")
    .insert({ user_id: uid, ...boardWrite(input) })
    .select("id")
    .maybeSingle();
  return (data?.id as string) ?? null;
}

export async function updateBoard(id: string, input: TacticalBoardInput): Promise<boolean> {
  if (isDemoMode) return boardStore.update(id, input);
  const supabase = await client();
  if (!supabase) return false;
  const { error } = await supabase.from("tactical_boards").update(boardWrite(input)).eq("id", id);
  return !error;
}

export async function deleteBoard(id: string): Promise<boolean> {
  if (isDemoMode) return boardStore.remove(id);
  const supabase = await client();
  if (!supabase) return false;
  const { error } = await supabase.from("tactical_boards").delete().eq("id", id);
  return !error;
}

/** Archive rather than delete — a board used in a delivered session is history. */
export async function archiveBoard(id: string, archived = true): Promise<boolean> {
  if (isDemoMode) return boardStore.archive(id, archived);
  const supabase = await client();
  if (!supabase) return false;
  const { error } = await supabase
    .from("tactical_boards")
    .update({ archived_at: archived ? new Date().toISOString() : null })
    .eq("id", id);
  return !error;
}

/**
 * Copy a board so it can be changed without touching the original.
 *
 * The alternative to `Duplicate and customise` is a coach editing a
 * board that four sessions already reference and silently rewriting all
 * four. The copy records what it came from, so the lineage survives.
 */
export async function duplicateBoard(id: string, title?: string): Promise<string | null> {
  const source = await getBoard(id);
  if (!source) return null;
  return createBoard({
    title: title?.trim() || `${source.title} (copy)`,
    kind: source.kind,
    phase: source.phase,
    formation: source.formation,
    notes: source.notes,
    tags: [...source.tags],
    visibility: source.visibility,
    origin: { source: "duplicate", fromBoardId: source.id, prompt: null },
    doc: cloneDocument(source.doc),
  });
}

/** A new board from a formation — the "New board" path. */
export async function createBoardFromFormation(
  formation: string,
  title: string,
  kind: TacticalBoard["kind"] = "tactical",
): Promise<string | null> {
  return createBoard({
    title: title.trim() || `Untitled board · ${formation}`,
    kind,
    phase: "in-possession",
    formation,
    notes: "",
    tags: [],
    visibility: "private",
    origin: DEFAULT_ORIGIN,
    doc: documentFromFormation(formation),
  });
}

// ── links ────────────────────────────────────────────────────

function rowToLink(r: Record<string, unknown>): BoardLink {
  return {
    id: r.id as string,
    boardId: r.board_id as string,
    entityType: r.entity_type as BoardEntityType,
    entityId: r.entity_id as string,
    role: (r.role as BoardLink["role"]) ?? "illustrates",
    mode: (r.mode as BoardLink["mode"]) ?? "reference",
    snapshot: r.snapshot ? toDocument(r.snapshot) : null,
    position: (r.position as number) ?? 0,
    createdAt: (r.created_at as string) ?? new Date().toISOString(),
  };
}

export async function linkBoard(input: BoardLinkInput): Promise<boolean> {
  if (isDemoMode) return boardStore.link(input);
  const supabase = await client();
  const uid = await userId();
  if (!supabase || !uid) return false;
  const { error } = await supabase.from("board_links").upsert(
    {
      board_id: input.boardId,
      user_id: uid,
      entity_type: input.entityType,
      entity_id: input.entityId,
      role: input.role ?? "illustrates",
      mode: input.mode ?? "reference",
      snapshot: input.snapshot ?? null,
      position: input.position ?? 0,
    },
    { onConflict: "board_id,entity_type,entity_id,role" },
  );
  return !error;
}

export async function unlinkBoard(
  boardId: string,
  entityType: BoardEntityType,
  entityId: string,
): Promise<boolean> {
  if (isDemoMode) return boardStore.unlink(boardId, entityType, entityId);
  const supabase = await client();
  if (!supabase) return false;
  const { error } = await supabase
    .from("board_links")
    .delete()
    .eq("board_id", boardId)
    .eq("entity_type", entityType)
    .eq("entity_id", entityId);
  return !error;
}

/** A board plus the link that put it there — what a viewer needs. */
export interface AttachedBoard {
  link: BoardLink;
  board: TacticalBoard;
  /** Live or frozen, already resolved. Render this, not `board.doc`. */
  doc: TacticalDocument;
}

/**
 * Every board attached to one thing.
 *
 * Two queries rather than a join because PostgREST's embedding would
 * need a declared foreign key, and `board_links` is polymorphic on
 * purpose. At the volume a session block reaches — one or two boards —
 * the second round trip is cheaper than the schema rigidity.
 */
export async function boardsFor(
  entityType: BoardEntityType,
  entityId: string,
): Promise<AttachedBoard[]> {
  if (isDemoMode) return boardStore.boardsFor(entityType, entityId);

  const supabase = await client();
  if (!supabase) return [];

  const { data: linkRows } = await supabase
    .from("board_links")
    .select("*")
    .eq("entity_type", entityType)
    .eq("entity_id", entityId)
    .order("position", { ascending: true });

  const links = (linkRows ?? []).map(rowToLink);
  if (!links.length) return [];

  const { data: boardRows } = await supabase
    .from("tactical_boards")
    .select("*")
    .in("id", [...new Set(links.map((l) => l.boardId))]);

  const byId = new Map((boardRows ?? []).map((r) => [r.id as string, rowToBoard(r)]));
  return links
    .map((link) => {
      const board = byId.get(link.boardId);
      if (!board) return null;
      return { link, board, doc: documentForLink(link, board.doc) };
    })
    .filter(Boolean) as AttachedBoard[];
}

/** Boards attached to many things at once — a session's blocks in one go. */
export async function boardsForMany(
  entityType: BoardEntityType,
  entityIds: string[],
): Promise<Map<string, AttachedBoard[]>> {
  const out = new Map<string, AttachedBoard[]>();
  if (!entityIds.length) return out;

  if (isDemoMode) {
    for (const id of entityIds) out.set(id, boardStore.boardsFor(entityType, id));
    return out;
  }

  const supabase = await client();
  if (!supabase) return out;

  const { data: linkRows } = await supabase
    .from("board_links")
    .select("*")
    .eq("entity_type", entityType)
    .in("entity_id", entityIds)
    .order("position", { ascending: true });

  const links = (linkRows ?? []).map(rowToLink);
  if (!links.length) return out;

  const { data: boardRows } = await supabase
    .from("tactical_boards")
    .select("*")
    .in("id", [...new Set(links.map((l) => l.boardId))]);

  const byId = new Map((boardRows ?? []).map((r) => [r.id as string, rowToBoard(r)]));
  for (const link of links) {
    const board = byId.get(link.boardId);
    if (!board) continue;
    const list = out.get(link.entityId) ?? [];
    list.push({ link, board, doc: documentForLink(link, board.doc) });
    out.set(link.entityId, list);
  }
  return out;
}

/**
 * Boards somebody assigned to the signed-in person.
 *
 * The Player OS and athlete-facing half of the shared board: a coach
 * draws the pressing trigger once, assigns it, and the player opens the
 * same object rather than a screenshot of it.
 *
 * There is no ownership filter in this query, and there does not need to
 * be one — migration 0045's policy answers "may I read this" in the
 * database, restricted to links with role='assigned' pointing at the
 * reader's own coach_players or trainer_athletes row. Filtering here as
 * well would be a second, weaker copy of that rule.
 */
export async function boardsAssignedToMe(): Promise<AttachedBoard[]> {
  if (isDemoMode) return boardStore.assignedToMe();

  const supabase = await client();
  if (!supabase) return [];

  const { data: linkRows } = await supabase
    .from("board_links")
    .select("*")
    .eq("role", "assigned")
    .in("entity_type", ["squad_player", "athlete"])
    .order("created_at", { ascending: false });

  const links = (linkRows ?? []).map(rowToLink);
  if (!links.length) return [];

  const { data: boardRows } = await supabase
    .from("tactical_boards")
    .select("*")
    .in("id", [...new Set(links.map((l) => l.boardId))]);

  const byId = new Map((boardRows ?? []).map((r) => [r.id as string, rowToBoard(r)]));
  return links
    .map((link) => {
      const board = byId.get(link.boardId);
      /*
        A link the reader can see whose board they cannot is not an
        error: the policies are deliberately separate, and a board whose
        assignment was revoked mid-read simply drops out.
      */
      return board ? { link, board, doc: documentForLink(link, board.doc) } : null;
    })
    .filter(Boolean) as AttachedBoard[];
}

/** Where one board is used — for the library card and before deleting. */
export async function linksForBoard(boardId: string): Promise<BoardLink[]> {
  if (isDemoMode) return boardStore.linksForBoard(boardId);
  const supabase = await client();
  if (!supabase) return [];
  const { data } = await supabase.from("board_links").select("*").eq("board_id", boardId);
  return (data ?? []).map(rowToLink);
}

/** Usage counts for a whole list, so the library needs one extra query. */
export async function linkCounts(boardIds: string[]): Promise<Map<string, BoardLink[]>> {
  const out = new Map<string, BoardLink[]>();
  if (!boardIds.length) return out;
  if (isDemoMode) {
    for (const id of boardIds) out.set(id, boardStore.linksForBoard(id));
    return out;
  }
  const supabase = await client();
  if (!supabase) return out;
  const { data } = await supabase.from("board_links").select("*").in("board_id", boardIds);
  for (const r of data ?? []) {
    const link = rowToLink(r);
    const list = out.get(link.boardId) ?? [];
    list.push(link);
    out.set(link.boardId, list);
  }
  return out;
}

export { countDocument };
