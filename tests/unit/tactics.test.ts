import { describe, it, expect } from "vitest";
import {
  applyFormation,
  cloneDocument,
  countDocument,
  documentFromFormation,
  emptyDocument,
  emptyFrame,
  FORMATION_NAMES,
  isDrawnOn,
  toDocument,
  toLegacy,
} from "@/lib/tactics/document";
import {
  canRedo,
  canUndo,
  currentFrame,
  editorReducer,
  initEditor,
} from "@/lib/tactics/editor-state";
import { boardKeywords, channelOf, describeBoard, summariseBoard, thirdOf, whereIs } from "@/lib/tactics/describe";
import {
  documentForLink,
  summariseLinks,
  isBoardEntityType,
  isBoardLinkRole,
  linkLabel,
  BOARD_ENTITY_TYPES,
} from "@/lib/tactics/links";
import { pitchView, toSvg, fromSvg, clampToPitch } from "@/lib/tactics/geometry";
import { sideOf, type BoardPath, type TacticalDocument } from "@/lib/tactics/types";

/*
  The tactical board is now infrastructure that four operating systems and
  MIDO all read. Two properties matter more than any feature:

    1. A board written before migration 0044 must still open, exactly as
       it was drawn. That is the v1 → v2 upgrade, tested in both
       directions here because a one-way test cannot catch a lossy round
       trip.

    2. A board must mean something. The whole reason the document is not
       a bag of shapes is so "explain this" and "turn this into a drill"
       are answerable — so the description layer is pinned too.
*/

// ── the v1 shape, exactly as migration 0006 wrote it ─────────

const V1 = {
  tokens: [
    { id: "h0", team: "home" as const, label: "GK", x: 50, y: 7 },
    { id: "h1", team: "home" as const, label: "RB", x: 84, y: 24 },
    { id: "a0", team: "away" as const, label: "CB", x: 40, y: 84 },
    { id: "ball", team: "ball" as const, label: "", x: 50, y: 12 },
    { id: "c0", team: "cone" as const, label: "", x: 20, y: 40 },
  ],
  arrows: [
    { id: "ar1", kind: "pass" as const, x1: 50, y1: 12, x2: 38, y2: 18 },
    { id: "ar2", kind: "press" as const, x1: 84, y1: 24, x2: 84, y2: 44 },
  ],
  zones: [{ id: "zn1", x: 30, y: 40, w: 40, h: 22, label: "Free man" }],
};

describe("boards written before the split still open", () => {
  it("upgrades every v1 object into the document", () => {
    const doc = toDocument(V1);
    expect(doc.version).toBe(2);
    expect(doc.frames).toHaveLength(1);
    const f = doc.frames[0];
    expect(f.entities).toHaveLength(5);
    expect(f.paths).toHaveLength(2);
    expect(f.zones).toHaveLength(1);
  });

  it("keeps which side everyone was on", () => {
    const f = toDocument(V1).frames[0];
    expect(f.entities.find((e) => e.id === "h1")?.kind).toBe("player");
    expect(f.entities.find((e) => e.id === "a0")?.kind).toBe("opponent");
    expect(f.entities.find((e) => e.id === "ball")?.kind).toBe("ball");
    expect(f.entities.find((e) => e.id === "c0")?.kind).toBe("cone");
  });

  it("keeps what each line meant", () => {
    const f = toDocument(V1).frames[0];
    expect(f.paths.find((p) => p.id === "ar1")?.kind).toBe("pass");
    expect(f.paths.find((p) => p.id === "ar2")?.kind).toBe("press");
  });

  it("does not promote a token labelled GK into a goalkeeper", () => {
    /* Inferring a role from a text label would rewrite what the coach
       drew. v1 could not say "goalkeeper", so neither does the upgrade. */
    expect(toDocument(V1).frames[0].entities.find((e) => e.id === "h0")?.kind).toBe("player");
  });

  it("survives a round trip back to the legacy column", () => {
    const back = toLegacy(toDocument(V1));
    expect(back.tokens.map((t) => [t.id, t.team, t.x, t.y])).toEqual(
      V1.tokens.map((t) => [t.id, t.team, t.x, t.y]),
    );
    expect(back.arrows.map((a) => [a.id, a.kind])).toEqual(V1.arrows.map((a) => [a.id, a.kind]));
    expect(back.zones[0].label).toBe("Free man");
  });

  it("renders something no matter what is on disk", () => {
    for (const junk of [null, undefined, {}, [], "board", 7, { tokens: "no" }]) {
      const doc = toDocument(junk);
      expect(doc.frames.length, JSON.stringify(junk)).toBeGreaterThan(0);
    }
  });

  it("bounds coordinates that arrive out of range", () => {
    const doc = toDocument({ tokens: [{ id: "x", team: "home", label: "9", x: 500, y: -80 }], arrows: [], zones: [] });
    const e = doc.frames[0].entities[0];
    expect(e.x).toBe(100);
    expect(e.y).toBe(0);
  });
});

describe("projecting back to v1", () => {
  it("maps the five newer path kinds onto something v1 understands", () => {
    const doc = emptyDocument();
    doc.frames[0].paths = (["carry", "cover", "movement", "rotation", "shot"] as const).map((kind, i) => ({
      id: `p${i}`,
      kind,
      from: { x: 10, y: 10 },
      to: { x: 20, y: 20 },
      entityId: null,
      sequence: null,
      label: "",
      curved: false,
    })) as BoardPath[];
    const legacy = toLegacy(doc);
    for (const a of legacy.arrows) {
      expect(["run", "pass", "dribble", "press"]).toContain(a.kind);
    }
  });

  it("projects the first frame only, and says so by doing it", () => {
    const doc = documentFromFormation("4-3-3");
    doc.frames.push({ ...emptyFrame("phase two"), entities: [] });
    // A five-frame sequence has no v1 representation; flattening them on
    // top of each other would draw a picture nobody made.
    expect(toLegacy(doc).tokens.length).toBe(doc.frames[0].entities.length);
  });
});

describe("formations", () => {
  it("places eleven of ours for every formation, inside the pitch", () => {
    for (const name of FORMATION_NAMES) {
      const doc = documentFromFormation(name);
      const ours = doc.frames[0].entities.filter((e) => sideOf(e.kind) === "ours");
      expect(ours, name).toHaveLength(11);
      for (const e of doc.frames[0].entities) {
        expect(e.x, `${name} ${e.label} x`).toBeGreaterThanOrEqual(0);
        expect(e.x, `${name} ${e.label} x`).toBeLessThanOrEqual(100);
        expect(e.y, `${name} ${e.label} y`).toBeGreaterThanOrEqual(0);
        expect(e.y, `${name} ${e.label} y`).toBeLessThanOrEqual(100);
      }
    }
  });

  it("now knows which one is the goalkeeper", () => {
    const doc = documentFromFormation("4-3-3");
    expect(doc.frames[0].entities.filter((e) => e.kind === "goalkeeper")).toHaveLength(1);
    expect(doc.frames[0].entities.filter((e) => e.kind === "opponent-goalkeeper")).toHaveLength(1);
  });

  it("gives the opponent a shape to play against, and a ball", () => {
    const doc = documentFromFormation("4-3-3");
    const theirs = doc.frames[0].entities.filter((e) => sideOf(e.kind) === "theirs");
    expect(theirs.length).toBeGreaterThanOrEqual(6);
    expect(doc.frames[0].entities.some((e) => e.kind === "ball")).toBe(true);
  });

  /*
    The block used to be a back four and two centre-mids — no front line. That
    is the half of the opposition a build-up board is about, and the default
    phase is in-possession, so the first board anyone made contradicted its own
    objective: "split the two strikers", with no strikers on the pitch.
  */
  it("gives the opponent a front line, not just a back six", () => {
    const doc = documentFromFormation("4-3-3");
    const theirs = doc.frames[0].entities.filter((e) => sideOf(e.kind) === "theirs");
    const forwards = theirs.filter((e) => e.label === "ST");
    expect(forwards.length, "a build-up board needs someone to build against").toBe(2);

    // And they are upfield of their own midfield, or they are not a front line.
    const mid = theirs.filter((e) => e.label === "CM" || e.label === "RM" || e.label === "LM");
    const highestMid = Math.max(...mid.map((e) => e.y));
    for (const f of forwards) expect(f.y, f.label).toBeLessThan(highestMid);
  });

  it("starts with nothing drawn on it", () => {
    expect(isDrawnOn(documentFromFormation("3-5-2"))).toBe(false);
  });

  it("changes the shape without disturbing the drawings", () => {
    const doc = documentFromFormation("4-3-3");
    doc.frames[0].paths = [
      { id: "p1", kind: "run", from: { x: 1, y: 1 }, to: { x: 9, y: 9 }, entityId: null, sequence: null, label: "", curved: false },
    ];
    const next = applyFormation(doc.frames[0], "3-5-2");
    expect(next.paths).toHaveLength(1);
    expect(next.entities.filter((e) => sideOf(e.kind) === "ours")).toHaveLength(11);
    // The opposition block is not ours to move.
    expect(next.entities.filter((e) => sideOf(e.kind) === "theirs").length).toBeGreaterThan(0);
  });
});

describe("editing", () => {
  const start = () => initEditor(documentFromFormation("4-3-3"));

  it("undoes and redoes an edit", () => {
    let s = start();
    const before = countDocument(s.doc).paths;
    s = editorReducer(s, {
      type: "add-path",
      path: { id: "p1", kind: "press", from: { x: 10, y: 10 }, to: { x: 30, y: 40 }, entityId: null, sequence: null, label: "", curved: false },
    });
    expect(countDocument(s.doc).paths).toBe(before + 1);
    expect(canUndo(s)).toBe(true);

    s = editorReducer(s, { type: "undo" });
    expect(countDocument(s.doc).paths).toBe(before);
    expect(canRedo(s)).toBe(true);

    s = editorReducer(s, { type: "redo" });
    expect(countDocument(s.doc).paths).toBe(before + 1);
  });

  it("erases whatever was clicked, and leaves the rest alone", () => {
    let s = start();
    const entities = countDocument(s.doc).ours;
    s = editorReducer(s, {
      type: "add-zone",
      zone: { id: "z1", kind: "trap", x: 10, y: 10, w: 20, h: 20, label: "", shape: "rect" },
    });
    s = editorReducer(s, { type: "erase", id: "z1" });
    expect(countDocument(s.doc).zones).toBe(0);
    expect(countDocument(s.doc).ours).toBe(entities);
  });

  it("clears drawings but not the players", () => {
    let s = start();
    s = editorReducer(s, {
      type: "add-path",
      path: { id: "p1", kind: "run", from: { x: 1, y: 1 }, to: { x: 5, y: 5 }, entityId: null, sequence: null, label: "", curved: false },
    });
    const ours = countDocument(s.doc).ours;
    s = editorReducer(s, { type: "clear-drawings" });
    expect(countDocument(s.doc).paths).toBe(0);
    expect(countDocument(s.doc).ours).toBe(ours);
  });

  it("starts a new phase from the current positions, not from nothing", () => {
    let s = start();
    const entities = currentFrame(s).entities.length;
    s = editorReducer(s, { type: "add-frame" });
    expect(s.doc.frames).toHaveLength(2);
    expect(s.frameIndex).toBe(1);
    expect(currentFrame(s).entities).toHaveLength(entities);
    // A new phase carries no movements; the previous phase's have played.
    expect(currentFrame(s).paths).toHaveLength(0);
  });

  it("refuses to delete the only frame", () => {
    let s = start();
    s = editorReducer(s, { type: "delete-frame" });
    expect(s.doc.frames).toHaveLength(1);
  });

  it("never lets a duplicated frame alias the original", () => {
    let s = start();
    s = editorReducer(s, { type: "duplicate-frame" });
    const [a, b] = s.doc.frames;
    expect(a.id).not.toBe(b.id);
    b.entities[0].x = 1;
    expect(a.entities[0].x).not.toBe(1);
  });

  it("coalesces a drag so undo rewinds the gesture, not every pixel", () => {
    let s = start();
    const id = currentFrame(s).entities[0].id;
    s = editorReducer(s, { type: "move-entity", id, x: 10, y: 10 });
    const depth = s.past.length;
    for (let i = 0; i < 20; i++) s = editorReducer(s, { type: "move-entity", id, x: 10 + i, y: 10 });
    expect(s.past.length).toBe(depth);
  });
});

describe("cloning", () => {
  it("gives a copy fresh ids and no shared objects", () => {
    const a = documentFromFormation("4-3-3");
    const b = cloneDocument(a);
    expect(b.frames[0].id).not.toBe(a.frames[0].id);
    b.frames[0].entities[0].x = 99;
    expect(a.frames[0].entities[0].x).not.toBe(99);
  });
});

describe("describing a board for MIDO", () => {
  const board = () => {
    const doc = documentFromFormation("4-3-3");
    doc.objective = "Break the first line through the pivot.";
    doc.frames[0].paths = [
      { id: "p1", kind: "press", from: { x: 85, y: 75 }, to: { x: 60, y: 55 }, entityId: null, sequence: 1, label: "", curved: false },
    ];
    doc.frames[0].zones = [
      { id: "z1", kind: "trap", x: 70, y: 55, w: 25, h: 25, label: "Wide trap", shape: "rect" },
    ];
    return { title: "4-3-3 High Press", phase: "out-of-possession", formation: "4-3-3", notes: "", tags: ["wide trap"], doc };
  };

  it("names space in football terms, not coordinates", () => {
    expect(thirdOf(10)).toBe("defensive third");
    expect(thirdOf(50)).toBe("middle third");
    expect(thirdOf(90)).toBe("final third");
    expect(channelOf(5)).toBe("left wing");
    expect(channelOf(50)).toBe("centre");
    expect(channelOf(95)).toBe("right wing");
    expect(whereIs(85, 75)).toBe("right wing, final third");
  });

  it("says what the board is, who is on it and what is drawn", () => {
    const text = describeBoard(board());
    expect(text).toContain("4-3-3 High Press");
    expect(text).toContain("Break the first line");
    expect(text).toContain("press");
    expect(text).toContain("Wide trap");
    // No raw coordinates leak into the prompt.
    expect(text).not.toMatch(/"x":\s*\d/);
  });

  it("orders movements by the coach's own numbering", () => {
    const b = board();
    b.doc.frames[0].paths = [
      { id: "p2", kind: "run", from: { x: 10, y: 10 }, to: { x: 20, y: 20 }, entityId: null, sequence: 2, label: "second", curved: false },
      { id: "p1", kind: "pass", from: { x: 30, y: 30 }, to: { x: 40, y: 40 }, entityId: null, sequence: 1, label: "first", curved: false },
    ];
    const text = describeBoard(b);
    expect(text.indexOf("first")).toBeLessThan(text.indexOf("second"));
  });

  it("derives keywords a coach would actually search with", () => {
    const words = boardKeywords(board());
    expect(words).toContain("press");
    expect(words).toContain("4-3-3");
    expect(words).toContain("wide trap");
    expect(words).toContain("final third");
  });

  it("summarises a board in one scannable line", () => {
    expect(summariseBoard(board())).toContain("11v11");
  });
});

describe("attachment", () => {
  it("renders the live board for a reference link", () => {
    const live = documentFromFormation("4-3-3");
    const frozen = documentFromFormation("4-4-2");
    expect(documentForLink({ mode: "reference", snapshot: frozen }, live)).toBe(live);
  });

  it("renders the frozen board for a snapshot, so history stays accurate", () => {
    const live = documentFromFormation("4-3-3");
    const frozen = documentFromFormation("4-4-2");
    expect(documentForLink({ mode: "snapshot", snapshot: frozen }, live)).toBe(frozen);
  });

  it("falls back to the live board when a snapshot was never stored", () => {
    const live = documentFromFormation("4-3-3");
    expect(documentForLink({ mode: "snapshot", snapshot: null }, live)).toBe(live);
  });

  it("groups usage rather than listing every row", () => {
    expect(
      summariseLinks([
        { entityType: "session_block" },
        { entityType: "session_block" },
        { entityType: "development_goal" },
      ]),
    ).toBe("2 session blocks · 1 development goal");
  });
});

describe("geometry", () => {
  it("keeps the full pitch exactly as migration 0006 drew it", () => {
    expect(pitchView("full")).toEqual({ w: 100, h: 150 });
  });

  it("flips y so attacking is upwards, and inverts cleanly", () => {
    const v = pitchView("full");
    expect(toSvg(50, 100, v).py).toBe(0);
    expect(toSvg(50, 0, v).py).toBe(150);
    const back = fromSvg(50, 75, v);
    expect(back.y).toBeCloseTo(50);
  });

  it("keeps every surface in the same coordinate space", () => {
    /* A board can change surface without moving an entity — which is only
       true while every pitch type spans the same 0–100. */
    for (const type of ["full", "half", "final-third", "penalty-area", "grid", "blank"] as const) {
      const v = pitchView(type);
      expect(v.w, type).toBe(100);
      expect(toSvg(0, 100, v).py, type).toBe(0);
    }
  });

  it("clamps anything off the pitch", () => {
    expect(clampToPitch(-10)).toBe(0);
    expect(clampToPitch(180)).toBe(100);
    expect(clampToPitch(Number.NaN)).toBe(0);
  });
});

describe("counting", () => {
  it("reports what is actually on the first frame", () => {
    const doc: TacticalDocument = documentFromFormation("4-3-3");
    const c = countDocument(doc);
    expect(c.ours).toBe(11);
    // A full opposition XI — see "gives the opponent a front line" above.
    expect(c.theirs).toBe(11);
    expect(c.frames).toBe(1);
  });
});

describe("assignment — the one thing that crosses an account boundary", () => {
  /*
    Migration 0045 exposes a board to a second account only for links
    with role='assigned' pointing at a coach_players or trainer_athletes
    row. The policy is in SQL and cannot be unit-tested here; what CAN be
    pinned is the vocabulary it depends on, because a typo in either
    string silently produces a link the policy will never match — a
    board that looks assigned and is invisible to the person it is for.
  */
  it("keeps the two assignment targets in the entity vocabulary", () => {
    expect(isBoardEntityType("squad_player")).toBe(true);
    expect(isBoardEntityType("athlete")).toBe(true);
    expect(BOARD_ENTITY_TYPES).toContain("squad_player");
    expect(BOARD_ENTITY_TYPES).toContain("athlete");
  });

  it("keeps 'assigned' a real role, distinct from attaching", () => {
    expect(isBoardLinkRole("assigned")).toBe(true);
    expect(isBoardLinkRole("illustrates")).toBe(true);
    // A board on a session block must never be caught by the policy.
    expect(isBoardLinkRole("shared")).toBe(false);
    expect(isBoardLinkRole("")).toBe(false);
  });

  it("refuses an entity type the database would reject", () => {
    for (const bad of ["user", "team", "session", "", null, 7, "squad_players"]) {
      expect(isBoardEntityType(bad), String(bad)).toBe(false);
    }
  });

  it("names every attachment target in words a person would read", () => {
    for (const t of BOARD_ENTITY_TYPES) {
      const label = linkLabel(t);
      expect(label, t).toBeTruthy();
      expect(label, t).not.toContain("_");
    }
  });
});
