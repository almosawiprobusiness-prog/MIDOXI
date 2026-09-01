/*
  What a board is attached to.

  A board's whole value is that the same football idea can appear in a
  session, against an opponent, on a player's goal and inside a study
  without becoming four disconnected copies. That is a many-to-many
  relationship, so it lives in its own table rather than as a column on
  the board (migration 0006's `plan_id` was a single nullable FK — one
  board, one session, one direction, and no way to say WHICH block).

  Client-safe: types and pure helpers only.

  THE VERSIONING DECISION (§33). A link is either:

    reference — the live board. Editing it updates everywhere it appears.
                Right for "this session teaches my high-press board":
                if the press changes, the session should show the change.

    snapshot  — the board as it was when attached, frozen on the link.
                Right for history. A session delivered in March must
                still show what was actually coached in March, and a
                board edited in June silently rewriting it would make the
                training record fiction.

  New attachments default to `reference` because that is what people
  expect while planning; anything historical is snapshotted at the point
  it becomes historical.
*/

import type { TacticalDocument } from "./types";

/** Everything a board can hang off. */
export type BoardEntityType =
  | "session_block"
  | "session_plan"
  | "opposition"
  | "development_goal"
  | "study_session"
  | "match"
  | "program_exercise"
  | "program_session"
  | "athlete"
  | "squad_player"
  | "capture";

export const BOARD_ENTITY_TYPES: BoardEntityType[] = [
  "session_block",
  "session_plan",
  "opposition",
  "development_goal",
  "study_session",
  "match",
  "program_exercise",
  "program_session",
  "athlete",
  "squad_player",
  "capture",
];

export function isBoardEntityType(v: unknown): v is BoardEntityType {
  return typeof v === "string" && (BOARD_ENTITY_TYPES as string[]).includes(v);
}

/** Why it is attached — the same board means different things in different places. */
export type BoardLinkRole =
  /** The visual for this drill/block. */
  | "illustrates"
  /** The tactical idea this thing is about. */
  | "concept"
  /** Evidence or reference material. */
  | "reference"
  /** Assigned to somebody to look at. */
  | "assigned";

export const BOARD_LINK_ROLES: BoardLinkRole[] = ["illustrates", "concept", "reference", "assigned"];

export function isBoardLinkRole(v: unknown): v is BoardLinkRole {
  return typeof v === "string" && (BOARD_LINK_ROLES as string[]).includes(v);
}

export type BoardLinkMode = "reference" | "snapshot";

export interface BoardLink {
  id: string;
  boardId: string;
  entityType: BoardEntityType;
  entityId: string;
  role: BoardLinkRole;
  mode: BoardLinkMode;
  /** Frozen document, present only when mode is "snapshot". */
  snapshot: TacticalDocument | null;
  position: number;
  createdAt: string;
}

export interface BoardLinkInput {
  boardId: string;
  entityType: BoardEntityType;
  entityId: string;
  role?: BoardLinkRole;
  mode?: BoardLinkMode;
  snapshot?: TacticalDocument | null;
  position?: number;
}

/**
 * Which document a link should render.
 *
 * The one place that decides, so a viewer, a printout and the AI cannot
 * disagree about what a historical session showed. A snapshot link with
 * no snapshot stored falls back to the live board rather than rendering
 * nothing — a missing freeze is a bug worth surviving.
 */
export function documentForLink(
  link: Pick<BoardLink, "mode" | "snapshot">,
  live: TacticalDocument,
): TacticalDocument {
  return link.mode === "snapshot" && link.snapshot ? link.snapshot : live;
}

/** Human wording for where a board is used, for the library card. */
export function linkLabel(type: BoardEntityType): string {
  switch (type) {
    case "session_block":
      return "session block";
    case "session_plan":
      return "session";
    case "opposition":
      return "opposition report";
    case "development_goal":
      return "development goal";
    case "study_session":
      return "study";
    case "match":
      return "match";
    case "program_exercise":
      return "exercise";
    case "program_session":
      return "programme session";
    case "athlete":
      return "athlete";
    case "squad_player":
      return "player";
    case "capture":
      return "saved moment";
  }
}

/** "Linked to 2 sessions" — grouped, so a card never lists eleven rows. */
export function summariseLinks(links: Pick<BoardLink, "entityType">[]): string {
  if (!links.length) return "";
  const counts = new Map<BoardEntityType, number>();
  for (const l of links) counts.set(l.entityType, (counts.get(l.entityType) ?? 0) + 1);
  return [...counts.entries()]
    .map(([type, n]) => `${n} ${linkLabel(type)}${n === 1 ? "" : "s"}`)
    .join(" · ");
}
