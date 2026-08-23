import { describe, it, expect } from "vitest";
import {
  composeSession,
  composeMatchPlan,
  matchConcepts,
  observations,
  relevantPrinciples,
} from "../../lib/data/coach-compose";
import { plannedMinutes, observationCount, boardFromFormation, FORMATION_NAMES } from "../../lib/data/coach-types";
import type { OppositionReport } from "../../lib/data/coach-types";

/*
  The coach engine's deterministic half. These paths run for every coach on
  every plan — including when Claude is unreachable — so they are the ones that
  must not drift.
*/

const ctx = {
  objective: "React in the first five seconds after losing the ball",
  durationMin: 75,
  playersCount: 18,
  pitch: "Two thirds",
  squadFocus: ["Receiving on the half-turn"],
};

describe("session composition", () => {
  it("follows the coaching arc from warm-up to cool-down", () => {
    const s = composeSession(ctx);
    const phases = s.blocks.map((b) => b.phase);
    expect(phases[0]).toBe("warmup");
    expect(phases[phases.length - 1]).toBe("cooldown");
    expect(phases).toContain("conditioned-game");
    expect(phases).toContain("match-scenario");
  });

  it("plans roughly the session length", () => {
    const s = composeSession(ctx);
    const total = plannedMinutes(
      s.blocks.map((b, i) => ({ ...b, id: String(i), position: i })),
    );
    expect(total).toBeGreaterThan(ctx.durationMin * 0.7);
    expect(total).toBeLessThan(ctx.durationMin * 1.15);
  });

  it("gives every block something a coach can actually set up", () => {
    for (const b of composeSession(ctx).blocks) {
      expect(b.name.length, b.phase).toBeGreaterThan(3);
      expect(b.organisation.length, b.phase).toBeGreaterThan(10);
      expect(b.durationMin, b.phase).toBeGreaterThan(0);
    }
  });

  it("selects concepts from the objective rather than at random", () => {
    const pressing = matchConcepts("winning the ball back immediately after losing it");
    expect(pressing.map((c) => c.slug)).toContain("counter-pressing");

    const finishing = matchConcepts("attacking the near post and finishing early");
    expect(finishing.map((c) => c.slug)).toContain("near-post-finishing");
  });

  it("still produces a session when the objective matches nothing", () => {
    const s = composeSession({ ...ctx, objective: "zzz" });
    expect(s.blocks.length).toBeGreaterThanOrEqual(5);
    expect(s.source).toBe("library");
  });
});

const report: OppositionReport = {
  id: "r1",
  opponent: "Riverside Athletic",
  competition: "Championship North",
  matchDate: "2026-08-23",
  home: true,
  formation: "4-4-2",
  keyPlayers: [{ name: "Number 7", position: "RW", threat: "Attacks the space behind our left back" }],
  inPossession: ["Goalkeeper goes long to the right channel under pressure"],
  outOfPossession: ["Mid-block, two banks of four, narrow"],
  transition: ["Counter through the right channel within three passes"],
  setPieces: ["Near-post corner routine"],
  weaknesses: ["Their right centre-back steps early"],
  notes: "",
  plan: null,
  planSource: null,
  createdAt: "2026-08-18T00:00:00.000Z",
};

describe("match plan composition", () => {
  it("counts every recorded observation", () => {
    expect(observationCount(report)).toBe(6);
    expect(observations(report)).toHaveLength(6);
  });

  it("organises the plan into the moments of a match", () => {
    const plan = composeMatchPlan(report);
    const titles = plan.sections.map((s) => s.title);
    expect(titles).toContain("When they have the ball");
    expect(titles).toContain("Where to attack");
    expect(titles).toContain("Individuals");
  });

  it("never invents a section the coach recorded nothing for", () => {
    const sparse: OppositionReport = {
      ...report,
      keyPlayers: [],
      inPossession: [],
      transition: [],
      setPieces: [],
    };
    const titles = composeMatchPlan(sparse).sections.map((s) => s.title);
    expect(titles).not.toContain("Individuals");
    expect(titles).not.toContain("Set pieces");
    expect(titles).not.toContain("Transition");
  });

  it("produces no sections at all from an empty report", () => {
    const empty: OppositionReport = {
      ...report,
      keyPlayers: [],
      inPossession: [],
      outOfPossession: [],
      transition: [],
      setPieces: [],
      weaknesses: [],
    };
    expect(observationCount(empty)).toBe(0);
    expect(composeMatchPlan(empty).sections).toHaveLength(0);
  });

  it("keeps the coach's own words verbatim in the plan", () => {
    const plan = composeMatchPlan(report);
    const allPoints = plan.sections.flatMap((s) => s.points).join(" | ");
    expect(allPoints).toContain("Goalkeeper goes long to the right channel under pressure");
    expect(allPoints).toContain("Mid-block, two banks of four, narrow");
  });
});

describe("tactical board formations", () => {
  it("places eleven players for every formation, inside the pitch", () => {
    for (const name of FORMATION_NAMES) {
      const board = boardFromFormation(name);
      const home = board.tokens.filter((t) => t.team === "home");
      expect(home, name).toHaveLength(11);
      for (const t of board.tokens) {
        expect(t.x, `${name} ${t.label} x`).toBeGreaterThanOrEqual(0);
        expect(t.x, `${name} ${t.label} x`).toBeLessThanOrEqual(100);
        expect(t.y, `${name} ${t.label} y`).toBeGreaterThanOrEqual(0);
        expect(t.y, `${name} ${t.label} y`).toBeLessThanOrEqual(100);
      }
    }
  });

  it("gives the opponent a shape to play against, and a ball", () => {
    const board = boardFromFormation("4-3-3");
    expect(board.tokens.filter((t) => t.team === "away").length).toBeGreaterThanOrEqual(6);
    expect(board.tokens.some((t) => t.team === "ball")).toBe(true);
  });

  it("starts a new board with nothing drawn on it", () => {
    const board = boardFromFormation("3-5-2");
    expect(board.arrows).toHaveLength(0);
    expect(board.zones).toHaveLength(0);
  });
});

/*
  Which of the club's principles a session is written inside.

  The club system's whole claim is that a coach drafting here gets a session
  written inside the club's methodology. Picking the principles by their
  position on a page rather than by relevance to the session makes that claim
  much weaker than it sounds — so the selection is pinned.
*/
describe("club principles in a session", () => {
  const METHODOLOGY = [
    "Build from the goalkeeper, always play through the first line",
    "Defend the halfway line — the back four does not drop without reason",
    "Press on the backward pass, as a unit, within three seconds",
    "Attack the far post with two runners on every wide cross",
    "Rest with the ball, not without it",
  ];

  it("picks the principles the session is actually about", () => {
    const picked = relevantPrinciples(METHODOLOGY, "Press on the backward pass as a unit");
    expect(picked[0]).toContain("Press on the backward pass");
  });

  it("does not simply take the top of the page", () => {
    const picked = relevantPrinciples(METHODOLOGY, "Attacking wide crosses and far-post runs");
    expect(picked).toContain("Attack the far post with two runners on every wide cross");
  });

  it("uses the session's concept as well as its wording", () => {
    const picked = relevantPrinciples(METHODOLOGY, "Tuesday session", {
      name: "Counter-pressing",
      definition: "Press immediately on losing the ball, as a unit, within three seconds",
    });
    expect(picked[0]).toContain("Press on the backward pass");
  });

  it("never carries more than a block can hold", () => {
    expect(relevantPrinciples(METHODOLOGY, "anything").length).toBeLessThanOrEqual(3);
  });

  it("gives a small club all of its principles", () => {
    const two = METHODOLOGY.slice(0, 2);
    expect(relevantPrinciples(two, "unrelated objective")).toEqual(two);
  });

  it("falls back to document order when nothing matches", () => {
    // A club that wrote its principles in priority order still gets them in it.
    expect(relevantPrinciples(METHODOLOGY, "zzzz")).toEqual(METHODOLOGY.slice(0, 3));
  });

  it("returns nothing for a club with no methodology", () => {
    expect(relevantPrinciples([], "press high")).toEqual([]);
  });
});

describe("principle scoring", () => {
  it("lets the club's own label decide, over a word anywhere in the body", () => {
    /*
      Two traps in one fixture. "pressers" contains "press" as a fragment, and
      the width principle legitimately contains "high" as a whole word — so
      without weighting the label, a pressing session gets the width principle.
      Clubs write "Pressing — …", and that label is what the principle is for.
    */
    const picked = relevantPrinciples(
      [
        "Build-up — three at the back against two pressers, always a spare man",
        "Shape — defend the halfway line",
        "Width — the far winger stays high and wide",
        "Pressing — press the touch, not the pass",
      ],
      "Press to win the ball high",
      null,
      1,
    );
    expect(picked[0]).toContain("Pressing");
  });
});

describe("match plan framing", () => {
  const report = (over: Partial<OppositionReport> = {}): OppositionReport =>
    ({
      id: "r1",
      opponent: "Riverside",
      formation: "4-4-2",
      home: true,
      competition: "League",
      playedAt: null,
      inPossession: [],
      outOfPossession: [],
      weaknesses: [],
      transition: [],
      keyPlayers: [],
      setPieces: [],
      ...over,
    }) as OppositionReport;

  it("keeps every observation verbatim, in every section", () => {
    const obs = [
      "Their right centre-back steps early",
      "Slow to shift when the ball is switched",
    ];
    const plan = composeMatchPlan(report({ weaknesses: obs }));
    const points = plan.sections.find((s) => s.title === "Where to attack")!.points;
    // The coach's words come back exactly as written — framing is added around
    // them, never welded onto each one.
    expect(points.slice(0, 2)).toEqual(obs);
  });

  it("frames a section once, not once per line", () => {
    const plan = composeMatchPlan(
      report({ weaknesses: ["A", "B", "C"], inPossession: ["D", "E"] }),
    );
    for (const section of plan.sections) {
      const framing = section.points.filter((p) => /\brehearse|decide who|build our|rest defence/i.test(p));
      expect(framing.length, section.title).toBeLessThanOrEqual(1);
    }
  });
});
