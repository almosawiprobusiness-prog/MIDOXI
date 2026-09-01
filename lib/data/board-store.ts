import "server-only";
import {
  DEFAULT_ORIGIN,
  boardId,
  cloneDocument,
  documentFromFormation,
  toDocument,
} from "@/lib/tactics/document";
import { documentForLink, type BoardEntityType, type BoardLink, type BoardLinkInput } from "@/lib/tactics/links";
import type { TacticalBoard, TacticalBoardInput } from "@/lib/tactics/types";
import type { AttachedBoard, BoardQuery } from "./boards";

/*
  Demo-mode boards, in memory.

  Same contract as the other demo stores: the whole feature works without
  a database so the product can be shown, and so a reviewer can draw a
  board, attach it to a session and see it appear there without an
  account. Held on globalThis to survive Next's module reloading in dev,
  exactly as `coach-store` does.

  The seed is one real board — a build-up idea, already attached to
  nothing — so the library is not an empty state on first look but also
  does not pretend to a history the demo user did not create.
*/

interface BoardDB {
  boards: TacticalBoard[];
  links: BoardLink[];
  seq: number;
}

const g = globalThis as unknown as { __midoBoardDB?: BoardDB };

function iso(daysAgo: number): string {
  return new Date(Date.now() - daysAgo * 864e5).toISOString();
}

function seed(): BoardDB {
  const doc = documentFromFormation("4-3-3");
  const frame = doc.frames[0];
  frame.paths = [
    { id: "p1", kind: "pass", from: { x: 50, y: 12 }, to: { x: 38, y: 18 }, entityId: null, sequence: 1, label: "", curved: false },
    { id: "p2", kind: "run", from: { x: 84, y: 24 }, to: { x: 84, y: 44 }, entityId: null, sequence: 2, label: "", curved: false },
    { id: "p3", kind: "pass", from: { x: 38, y: 18 }, to: { x: 50, y: 36 }, entityId: null, sequence: 3, label: "", curved: false },
  ];
  frame.zones = [
    { id: "z1", kind: "space", x: 30, y: 40, w: 40, h: 22, label: "Free man", shape: "rect" },
  ];
  doc.objective = "Invite the press, then break it through the pivot.";

  return {
    boards: [
      {
        id: "tb1",
        title: "Build-up vs a 4-4-2 press",
        kind: "tactical",
        phase: "in-possession",
        formation: "4-3-3",
        notes: "Their two strikers cannot cover three defenders. Invite the press, break it with the pivot.",
        tags: ["build-up", "press"],
        visibility: "private",
        origin: DEFAULT_ORIGIN,
        doc,
        archivedAt: null,
        createdAt: iso(6),
        updatedAt: iso(6),
      },
    ],
    links: [],
    seq: 2,
  };
}

function db(): BoardDB {
  return (g.__midoBoardDB ??= seed());
}

function matches(b: TacticalBoard, q: BoardQuery): boolean {
  if (q.kind && b.kind !== q.kind) return false;
  if (q.phase && b.phase !== q.phase) return false;
  if (q.tag && !b.tags.includes(q.tag)) return false;
  if (!q.includeArchived && b.archivedAt) return false;
  if (q.text) {
    const hay = [b.title, b.notes, b.formation, b.phase, ...b.tags].join("\n").toLowerCase();
    if (!q.text.toLowerCase().split(/\s+/).filter(Boolean).every((t) => hay.includes(t))) return false;
  }
  return true;
}

export const boardStore = {
  list(q: BoardQuery = {}): TacticalBoard[] {
    return db()
      .boards.filter((b) => matches(b, q))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .slice(0, q.limit ?? 100);
  },

  get(id: string): TacticalBoard | null {
    return db().boards.find((b) => b.id === id) ?? null;
  },

  create(input: TacticalBoardInput): string {
    const d = db();
    const id = `tb${d.seq++}`;
    const now = new Date().toISOString();
    d.boards.push({
      id,
      title: input.title,
      kind: input.kind ?? "tactical",
      phase: input.phase,
      formation: input.formation,
      notes: input.notes,
      tags: input.tags ?? [],
      visibility: input.visibility ?? "private",
      origin: input.origin ?? DEFAULT_ORIGIN,
      doc: toDocument(input.doc),
      archivedAt: null,
      createdAt: now,
      updatedAt: now,
    });
    return id;
  },

  update(id: string, input: TacticalBoardInput): boolean {
    const b = db().boards.find((x) => x.id === id);
    if (!b) return false;
    b.title = input.title;
    b.kind = input.kind ?? b.kind;
    b.phase = input.phase;
    b.formation = input.formation;
    b.notes = input.notes;
    b.tags = input.tags ?? b.tags;
    b.visibility = input.visibility ?? b.visibility;
    b.origin = input.origin ?? b.origin;
    b.doc = toDocument(input.doc);
    b.updatedAt = new Date().toISOString();
    return true;
  },

  remove(id: string): boolean {
    const d = db();
    const i = d.boards.findIndex((b) => b.id === id);
    if (i === -1) return false;
    d.boards.splice(i, 1);
    d.links = d.links.filter((l) => l.boardId !== id);
    return true;
  },

  archive(id: string, archived: boolean): boolean {
    const b = db().boards.find((x) => x.id === id);
    if (!b) return false;
    b.archivedAt = archived ? new Date().toISOString() : null;
    return true;
  },

  link(input: BoardLinkInput): boolean {
    const d = db();
    const role = input.role ?? "illustrates";
    const existing = d.links.find(
      (l) =>
        l.boardId === input.boardId &&
        l.entityType === input.entityType &&
        l.entityId === input.entityId &&
        l.role === role,
    );
    if (existing) {
      existing.mode = input.mode ?? existing.mode;
      existing.snapshot = input.snapshot ? cloneDocument(input.snapshot) : existing.snapshot;
      return true;
    }
    d.links.push({
      id: boardId("bl"),
      boardId: input.boardId,
      entityType: input.entityType,
      entityId: input.entityId,
      role,
      mode: input.mode ?? "reference",
      snapshot: input.snapshot ? cloneDocument(input.snapshot) : null,
      position: input.position ?? 0,
      createdAt: new Date().toISOString(),
    });
    return true;
  },

  unlink(boardId_: string, entityType: BoardEntityType, entityId: string): boolean {
    const d = db();
    const before = d.links.length;
    d.links = d.links.filter(
      (l) => !(l.boardId === boardId_ && l.entityType === entityType && l.entityId === entityId),
    );
    return d.links.length < before;
  },

  boardsFor(entityType: BoardEntityType, entityId: string): AttachedBoard[] {
    const d = db();
    return d.links
      .filter((l) => l.entityType === entityType && l.entityId === entityId)
      .sort((a, b) => a.position - b.position)
      .map((link) => {
        const board = d.boards.find((b) => b.id === link.boardId);
        return board ? { link, board, doc: documentForLink(link, board.doc) } : null;
      })
      .filter(Boolean) as AttachedBoard[];
  },

  /*
    Demo mode is a single identity, so "assigned to me" is whatever has
    been assigned at all. Saying so beats seeding a fictional coach.
  */
  assignedToMe(): AttachedBoard[] {
    const d = db();
    return d.links
      .filter((l) => l.role === "assigned")
      .map((link) => {
        const board = d.boards.find((b) => b.id === link.boardId);
        return board ? { link, board, doc: documentForLink(link, board.doc) } : null;
      })
      .filter(Boolean) as AttachedBoard[];
  },

  linksForBoard(boardId_: string): BoardLink[] {
    return db().links.filter((l) => l.boardId === boardId_);
  },
};
