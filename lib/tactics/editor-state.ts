/*
  Board editing, as a pure reducer.

  Every mutation the editor can perform lives here rather than in the
  component, for two reasons. Undo/redo is impossible to get right when
  state is scattered across a dozen `useState` calls — the old editor had
  none for exactly that reason. And a reducer is testable: "duplicating a
  frame does not alias the original", "undo restores the previous
  document", "erasing a path leaves the entities alone" are assertions
  about this file, with no DOM in sight.

  History is document-level. Snapshotting the whole document per edit
  sounds heavy and is not: a board is a few dozen small objects, and the
  stack is capped. It buys correctness — a partial history is how undo
  ends up restoring half a state.
*/

import {
  applyFormation as applyFormationToFrame,
  boardId,
  cloneDocument,
  emptyFrame,
} from "./document";
import type {
  BoardAnnotation,
  BoardEntity,
  BoardFrame,
  BoardPath,
  BoardZone,
  PitchSpec,
  TacticalDocument,
} from "./types";

/** Deep enough that undo cannot resurrect an aliased frame. */
const MAX_HISTORY = 40;

export interface EditorState {
  doc: TacticalDocument;
  frameIndex: number;
  /** The entity/path/zone currently selected, if any. */
  selectedId: string | null;
  /** Unsaved changes exist. Cleared by the host after a successful save. */
  dirty: boolean;
  past: TacticalDocument[];
  future: TacticalDocument[];
}

export type EditorAction =
  | { type: "add-entity"; entity: BoardEntity }
  | { type: "move-entity"; id: string; x: number; y: number }
  | { type: "add-path"; path: BoardPath }
  | { type: "add-zone"; zone: BoardZone }
  | { type: "add-annotation"; annotation: BoardAnnotation }
  | { type: "erase"; id: string }
  | { type: "select"; id: string | null }
  | { type: "clear-drawings" }
  | { type: "set-caption"; caption: string }
  | { type: "set-objective"; objective: string }
  | { type: "set-pitch"; pitch: PitchSpec }
  | { type: "apply-formation"; formation: string }
  | { type: "add-frame" }
  | { type: "duplicate-frame" }
  | { type: "delete-frame" }
  | { type: "go-frame"; index: number }
  | { type: "replace-doc"; doc: TacticalDocument }
  | { type: "undo" }
  | { type: "redo" }
  | { type: "saved" };

export function initEditor(doc: TacticalDocument): EditorState {
  return { doc, frameIndex: 0, selectedId: null, dirty: false, past: [], future: [] };
}

/** The frame currently being edited. Never undefined — documents always have one. */
export function currentFrame(s: EditorState): BoardFrame {
  return s.doc.frames[Math.min(s.frameIndex, s.doc.frames.length - 1)] ?? emptyFrame();
}

/*
  A mutation that should be undoable: push the OLD document onto the past,
  drop the redo future (the timeline has branched), and mark dirty.

  `moving` exists because dragging a token fires a mutation per pointer
  move. Recording forty history entries for one drag would make undo
  useless — it would rewind a single gesture pixel by pixel — so a move
  coalesces onto the entry already at the top of the stack.
*/
function commit(
  s: EditorState,
  next: TacticalDocument,
  opts: { coalesce?: boolean } = {},
): EditorState {
  const past = opts.coalesce && s.past.length && s.dirty ? s.past : [...s.past, s.doc].slice(-MAX_HISTORY);
  return { ...s, doc: next, past, future: [], dirty: true };
}

/** Replace the frame being edited, leaving every other frame alone. */
function withFrame(doc: TacticalDocument, index: number, f: (frame: BoardFrame) => BoardFrame): TacticalDocument {
  return {
    ...doc,
    frames: doc.frames.map((frame, i) => (i === index ? f(frame) : frame)),
  };
}

export function editorReducer(s: EditorState, a: EditorAction): EditorState {
  const i = Math.min(s.frameIndex, s.doc.frames.length - 1);

  switch (a.type) {
    case "add-entity":
      return commit(s, withFrame(s.doc, i, (f) => ({ ...f, entities: [...f.entities, a.entity] })));

    case "move-entity":
      return commit(
        s,
        withFrame(s.doc, i, (f) => ({
          ...f,
          entities: f.entities.map((e) => (e.id === a.id ? { ...e, x: a.x, y: a.y } : e)),
        })),
        { coalesce: true },
      );

    case "add-path":
      return commit(s, withFrame(s.doc, i, (f) => ({ ...f, paths: [...f.paths, a.path] })));

    case "add-zone":
      return commit(s, withFrame(s.doc, i, (f) => ({ ...f, zones: [...f.zones, a.zone] })));

    case "add-annotation":
      return commit(s, withFrame(s.doc, i, (f) => ({ ...f, annotations: [...f.annotations, a.annotation] })));

    /*
      One erase for every kind of object. The id space is shared, so the
      caller does not have to know what it clicked — which is exactly how
      the eraser behaves on a whiteboard.
    */
    case "erase": {
      const next = withFrame(s.doc, i, (f) => ({
        ...f,
        entities: f.entities.filter((e) => e.id !== a.id),
        paths: f.paths.filter((p) => p.id !== a.id),
        zones: f.zones.filter((z) => z.id !== a.id),
        annotations: f.annotations.filter((n) => n.id !== a.id),
      }));
      const state = commit(s, next);
      return { ...state, selectedId: state.selectedId === a.id ? null : state.selectedId };
    }

    case "select":
      return { ...s, selectedId: a.id };

    /* Drawings go; the players stay where the coach put them. */
    case "clear-drawings":
      return commit(
        s,
        withFrame(s.doc, i, (f) => ({ ...f, paths: [], zones: [], annotations: [] })),
      );

    case "set-caption":
      return commit(s, withFrame(s.doc, i, (f) => ({ ...f, caption: a.caption.slice(0, 140) })));

    case "set-objective":
      return commit(s, { ...s.doc, objective: a.objective.slice(0, 300) });

    case "set-pitch":
      return commit(s, { ...s.doc, pitch: a.pitch });

    case "apply-formation":
      return commit(s, {
        ...withFrame(s.doc, i, (f) => applyFormationToFrame(f, a.formation)),
        formation: a.formation,
      });

    /*
      A new frame starts from the current one, not from nothing. Football
      sequences are the same picture changing — asking a coach to place
      twenty-two players again for phase two would guarantee nobody uses
      frames at all.
    */
    case "add-frame":
    case "duplicate-frame": {
      const source = s.doc.frames[i] ?? emptyFrame();
      const copy: BoardFrame = {
        id: boardId("f"),
        caption: a.type === "duplicate-frame" ? source.caption : "",
        entities: source.entities.map((e) => ({ ...e })),
        // A duplicate keeps the drawings; a new phase starts from the
        // positions with the previous phase's movements already played.
        paths: a.type === "duplicate-frame" ? source.paths.map((p) => ({ ...p, id: boardId("p") })) : [],
        zones: source.zones.map((z) => ({ ...z, id: boardId("z") })),
        annotations: a.type === "duplicate-frame" ? source.annotations.map((n) => ({ ...n, id: boardId("n") })) : [],
      };
      const frames = [...s.doc.frames.slice(0, i + 1), copy, ...s.doc.frames.slice(i + 1)];
      return { ...commit(s, { ...s.doc, frames: frames.slice(0, 12) }), frameIndex: i + 1 };
    }

    case "delete-frame": {
      // A document with no frames cannot be drawn on; refuse the last one.
      if (s.doc.frames.length <= 1) return s;
      const frames = s.doc.frames.filter((_, n) => n !== i);
      return { ...commit(s, { ...s.doc, frames }), frameIndex: Math.max(0, i - 1) };
    }

    case "go-frame":
      return { ...s, frameIndex: Math.min(Math.max(0, a.index), s.doc.frames.length - 1), selectedId: null };

    /* Wholesale replacement — a MIDO-generated board. Undoable like any edit. */
    case "replace-doc":
      return { ...commit(s, a.doc), frameIndex: 0, selectedId: null };

    case "undo": {
      const prev = s.past[s.past.length - 1];
      if (!prev) return s;
      return {
        ...s,
        doc: prev,
        past: s.past.slice(0, -1),
        future: [s.doc, ...s.future].slice(0, MAX_HISTORY),
        frameIndex: Math.min(s.frameIndex, prev.frames.length - 1),
        selectedId: null,
        dirty: true,
      };
    }

    case "redo": {
      const next = s.future[0];
      if (!next) return s;
      return {
        ...s,
        doc: next,
        past: [...s.past, s.doc].slice(-MAX_HISTORY),
        future: s.future.slice(1),
        frameIndex: Math.min(s.frameIndex, next.frames.length - 1),
        selectedId: null,
        dirty: true,
      };
    }

    /*
      Saved. History survives on purpose: a coach who saves and then
      realises the previous version was better should still be able to
      undo their way back to it.
    */
    case "saved":
      return { ...s, dirty: false };
  }
}

export const canUndo = (s: EditorState) => s.past.length > 0;
export const canRedo = (s: EditorState) => s.future.length > 0;

/** Clone for "duplicate this board" — fresh ids throughout. */
export function duplicateForNewBoard(doc: TacticalDocument): TacticalDocument {
  return cloneDocument(doc);
}
