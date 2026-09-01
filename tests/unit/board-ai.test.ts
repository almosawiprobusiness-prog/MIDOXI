import { describe, it, expect } from "vitest";
import {
  AI_BOARD_JSON_SCHEMA,
  AI_ENTITY_KINDS,
  AI_PATH_KINDS,
  aiBoardSchema,
  aiDrillSchema,
  aiExplanationSchema,
  documentFromAi,
  type AiBoardPayload,
} from "@/lib/ai/board-schema";
/* The pure half — importable without a server runtime, which is why it
   lives beside the document rather than inside the engine. */
import { composeBoard, composeDrill, composeExplanation } from "@/lib/tactics/compose";
import { BOARD_DRAFT, BOARD_EXPLAIN, BOARD_TO_DRILL, PROMPT_MANIFEST } from "@/lib/ai/prompts";
import { validateAi } from "@/lib/ai/schemas";
import { countDocument, documentFromFormation } from "@/lib/tactics/document";
import { ENTITY_KINDS, PATH_KINDS, type TacticalBoard } from "@/lib/tactics/types";
import { CAPABILITIES, findCapability } from "@/lib/ai/capabilities";

/*
  MIDO drawing football.

  A generated board is the one AI output here that is not prose — it is
  coordinates, and a wrong coordinate is a player standing in the crowd.
  So the boundary gets more attention than the wording: what the model
  may say, what happens when it says something else, and what the
  product shows when the model is not available at all.
*/

const board = (over: Partial<TacticalBoard> = {}): Pick<TacticalBoard, "title" | "phase" | "formation" | "notes" | "tags" | "doc"> => ({
  title: "4-3-3 High Press",
  phase: "out-of-possession",
  formation: "4-3-3",
  notes: "",
  tags: ["press"],
  doc: documentFromFormation("4-3-3"),
  ...over,
});

const payload = (over: Partial<AiBoardPayload> = {}): AiBoardPayload => ({
  title: "Wide press trap",
  objective: "Force the pass wide, then trap it on the touchline.",
  phase: "out-of-possession",
  pitch: "full",
  formation: "4-3-3",
  tags: ["press"],
  frames: [
    {
      caption: "",
      entities: [
        { kind: "player", x: 50, y: 40, label: "6" },
        { kind: "opponent", x: 60, y: 70, label: "8" },
        { kind: "ball", x: 60, y: 70, label: "" },
      ],
      paths: [{ kind: "press", fromX: 50, fromY: 40, toX: 60, toY: 66, sequence: 1, label: "" }],
      zones: [{ kind: "trap", x: 70, y: 55, w: 25, h: 25, label: "Trap" }],
    },
  ],
  ...over,
});

describe("what MIDO may answer with", () => {
  it("accepts a well-formed board", () => {
    expect(validateAi(aiBoardSchema, payload())).not.toBeNull();
  });

  it("refuses an unknown path kind rather than rendering a colourless line", () => {
    const bad = payload();
    (bad.frames[0].paths[0] as { kind: string }).kind = "teleport";
    expect(validateAi(aiBoardSchema, bad)).toBeNull();
  });

  it("refuses a board with no frames", () => {
    expect(validateAi(aiBoardSchema, payload({ frames: [] }))).toBeNull();
  });

  it("refuses a payload missing the objective", () => {
    const bad = { ...payload() } as Record<string, unknown>;
    delete bad.objective;
    expect(validateAi(aiBoardSchema, bad)).toBeNull();
  });

  /*
    The vocabulary offered to the model is narrower than the editor's on
    purpose — but it must be a SUBSET, or the model can answer with
    something the renderer has no style for.
  */
  it("only offers kinds the renderer actually draws", () => {
    const entityKinds = ENTITY_KINDS.map((e) => e.kind);
    for (const k of AI_ENTITY_KINDS) expect(entityKinds, k).toContain(k);
    const pathKinds = PATH_KINDS.map((p) => p.kind);
    for (const k of AI_PATH_KINDS) expect(pathKinds, k).toContain(k);
  });

  it("bounds coordinates in the provider schema, not only afterwards", () => {
    const ent = AI_BOARD_JSON_SCHEMA.properties.frames.items.properties.entities.items.properties;
    expect(ent.x).toMatchObject({ minimum: 0, maximum: 100 });
    expect(ent.y).toMatchObject({ minimum: 0, maximum: 100 });
  });
});

describe("model output entering the product", () => {
  it("becomes a real document the editor can open", () => {
    const doc = documentFromAi(payload());
    expect(doc.version).toBe(2);
    expect(doc.frames).toHaveLength(1);
    expect(doc.frames[0].paths[0].kind).toBe("press");
    expect(doc.frames[0].zones[0].kind).toBe("trap");
    expect(doc.objective).toContain("touchline");
  });

  it("flattens from/to back into real points", () => {
    const doc = documentFromAi(payload());
    expect(doc.frames[0].paths[0].from).toEqual({ x: 50, y: 40 });
    expect(doc.frames[0].paths[0].to).toEqual({ x: 60, y: 66 });
  });

  /*
    The rule that matters: generated content is held to the same bounds
    as a person's. There is no looser path into the product for model
    output — `documentFromAi` goes through `toDocument`, the same
    function that reads boards off disk.
  */
  it("clamps a coordinate that got past the schema", () => {
    const bad = payload();
    bad.frames[0].entities[0].x = 900;
    bad.frames[0].entities[0].y = -50;
    const doc = documentFromAi(bad);
    expect(doc.frames[0].entities[0].x).toBe(100);
    expect(doc.frames[0].entities[0].y).toBe(0);
  });

  it("keeps the sequence numbering, because order is the idea", () => {
    expect(documentFromAi(payload()).frames[0].paths[0].sequence).toBe(1);
  });
});

describe("what happens without an AI allowance", () => {
  /*
    Every operation has a deterministic path that returns something
    real, because a free account asking a question should get an answer
    rather than a locked door — and because a fallback that pretends to
    be the AI answer would be worse than either.
  */
  it("composes a board that is a genuine starting shape", () => {
    const drafted = composeBoard({ formation: "4-2-3-1" });
    expect(drafted.composed).toBe(true);
    expect(countDocument(drafted.doc).ours).toBe(11);
    // It does not invent an objective it has no basis for.
    expect(drafted.objective).toBe("");
  });

  it("composes an explanation from what is actually on the board", () => {
    const e = composeExplanation(board());
    expect(e.composed).toBe(true);
    expect(e.points.join(" ")).toContain("11");
    expect(e.points.join(" ")).toContain("out of possession");
  });

  it("never invents coaching points it was not given", () => {
    const d = composeDrill(board());
    expect(d.composed).toBe(true);
    // No objective on the board means no coaching points asserted.
    expect(d.coachingPoints).toEqual([]);
    expect(d.organisation).toContain("4-3-3 High Press");
  });

  it("carries the board's own objective through when there is one", () => {
    const b = board();
    b.doc.objective = "Force play wide and trap it.";
    expect(composeDrill(b).coachingPoints).toEqual(["Force play wide and trap it."]);
  });
});

describe("the drill and explanation boundaries", () => {
  it("requires a runnable setup and at least one coaching point", () => {
    expect(
      validateAi(aiDrillSchema, {
        name: "Wide press trap",
        phase: "tactical",
        durationMin: 18,
        organisation: "Two thirds of a pitch, 8v8 plus keepers.",
        coachingPoints: ["Press on the pass, not on the touch"],
      }),
    ).not.toBeNull();

    // A block with no coaching points is a diagram, not a drill.
    expect(
      validateAi(aiDrillSchema, {
        name: "x",
        phase: "tactical",
        durationMin: 18,
        organisation: "y",
        coachingPoints: [],
      }),
    ).toBeNull();
  });

  it("refuses a session phase the planner does not have", () => {
    expect(
      validateAi(aiDrillSchema, {
        name: "x",
        phase: "scrimmage",
        durationMin: 10,
        organisation: "y",
        coachingPoints: ["z"],
      }),
    ).toBeNull();
  });

  it("requires an explanation to actually say something", () => {
    expect(validateAi(aiExplanationSchema, { headline: "A press", points: ["It presses."] })).not.toBeNull();
    expect(validateAi(aiExplanationSchema, { headline: "A press", points: [] })).toBeNull();
  });
});

describe("the prompts are registered and say the necessary things", () => {
  it("puts all three board prompts in the manifest", () => {
    const names = PROMPT_MANIFEST.map((m) => m.def.name);
    for (const p of [BOARD_DRAFT, BOARD_EXPLAIN, BOARD_TO_DRILL]) {
      expect(names, p.name).toContain(p.name);
    }
  });

  it("carries the anti-fabrication rules into every board prompt", () => {
    for (const p of [BOARD_DRAFT, BOARD_EXPLAIN, BOARD_TO_DRILL]) {
      expect(p.system, p.name).toContain("NEVER invent");
    }
  });

  it("tells the drawing prompt which way the pitch runs", () => {
    // Without this the model draws the attack into its own goal.
    expect(BOARD_DRAFT.system).toContain("attacks UPWARDS");
    expect(BOARD_DRAFT.system).toContain("y=100");
  });

  it("makes the difference between a pass and a run explicit", () => {
    expect(BOARD_DRAFT.system).toContain('"pass" is the ball travelling');
    expect(BOARD_DRAFT.system).toContain('"run" is a player moving without it');
  });

  it("tells the explainer it may only use what it was given", () => {
    expect(BOARD_EXPLAIN.system).toContain("That reading is ALL you know");
  });
});

describe("discoverability", () => {
  it("registers the board as something MIDO can build, for every role", () => {
    const cap = CAPABILITIES.find((c) => c.id === "tactical-board");
    expect(cap).toBeDefined();
    for (const role of ["player", "coach", "trainer", "club"] as const) {
      expect(cap!.roles, role).toContain(role);
    }
  });

  it("routes a request to draw something to the board", () => {
    expect(findCapability("draw a board showing our high press", "coach")?.id).toBe("tactical-board");
    expect(findCapability("tactical board for set pieces", "coach")?.id).toBe("tactical-board");
  });

  it("is honest that it works without an allowance, in reduced form", () => {
    // `both` — the deterministic path returns a real starting shape.
    expect(CAPABILITIES.find((c) => c.id === "tactical-board")?.path).toBe("both");
  });
});
