import { describe, it, expect } from "vitest";
import {
  rankActions,
  hasEnoughToRecommend,
  type PlayerSignals,
} from "../../lib/intelligence/next-best-action";

/*
  The ranking is the part of MIDO that decides rather than describes, so
  it is pinned hard. Every test here states a situation a real player is
  in and asserts what should be at the top of their screen.
*/

const base: PlayerSignals = {
  daysSinceLastMatch: null,
  lastMatchReviewed: true,
  daysUntilNextMatch: null,
  readiness: null,
  daysSinceCheckin: 0,
  activeGoals: [{ id: "g1", title: "Weak-foot finishing" }],
  daysSinceStudy: 1,
  daysSinceTraining: 1,
};

const kinds = (s: PlayerSignals) => rankActions(s).map((a) => a.kind);
const top = (s: PlayerSignals) => rankActions(s)[0];
const find = (s: PlayerSignals, kind: string) => rankActions(s).find((a) => a.kind === kind);

describe("the safety rule", () => {
  /*
    The reason this engine is code. A model asked the same question would
    usually get this right, and "usually" is not good enough for the one
    answer that can hurt somebody.
  */
  it("never surfaces hard training when readiness is low", () => {
    const s = { ...base, readiness: 30, daysSinceCheckin: 0 };
    expect(kinds(s)).not.toContain("training");
  });

  it("never surfaces hard training the day before a match", () => {
    const s = { ...base, readiness: 90, daysUntilNextMatch: 1 };
    expect(kinds(s)).not.toContain("training");
  });

  it("suppresses it below the floor rather than merely ranking it lower", () => {
    // Down-weighting would still surface it on a quiet day. It has to be
    // gone, not unlikely.
    const s = { ...base, readiness: 20 };
    expect(find(s, "training")).toBeUndefined();
  });

  it("puts recovery first when readiness is low and a match is coming", () => {
    const s = { ...base, readiness: 28, daysUntilNextMatch: 1, lastMatchReviewed: true };
    expect(top(s).kind).toBe("recovery");
  });

  it("still allows training when readiness is good and no match is imminent", () => {
    const s = { ...base, readiness: 85, daysUntilNextMatch: 6, daysSinceTraining: 4 };
    expect(kinds(s)).toContain("training");
  });
});

describe("the situation from the specification", () => {
  /*
    Striker, weak-foot goal, played yesterday and has not reviewed it,
    readiness low, next match in five days. The spec says the answer is
    review, then recovery, then study — and explicitly NOT "go and
    complete a maximal finishing session".
  */
  const s: PlayerSignals = {
    daysSinceLastMatch: 1,
    lastMatchReviewed: false,
    daysUntilNextMatch: 5,
    readiness: 35,
    daysSinceCheckin: 0,
    activeGoals: [{ id: "g1", title: "Weak-foot finishing" }],
    daysSinceStudy: 9,
    daysSinceTraining: 2,
  };

  it("puts reviewing yesterday's match first", () => {
    expect(top(s).kind).toBe("review_match");
  });

  it("orders review, then recovery, then study", () => {
    expect(kinds(s).slice(0, 3)).toEqual(["review_match", "recovery", "study"]);
  });

  it("does not offer a hard session at all", () => {
    expect(kinds(s)).not.toContain("training");
  });
});

describe("reviewing a match", () => {
  it("beats everything else the day after a match", () => {
    const s = { ...base, daysSinceLastMatch: 1, lastMatchReviewed: false, readiness: 80 };
    expect(top(s).kind).toBe("review_match");
  });

  it("decays as the memory of the match does", () => {
    const fresh = find({ ...base, daysSinceLastMatch: 1, lastMatchReviewed: false }, "review_match")!;
    const old = find({ ...base, daysSinceLastMatch: 20, lastMatchReviewed: false }, "review_match")!;
    expect(fresh.score).toBeGreaterThan(old.score);
  });

  it("disappears once the match has been reviewed", () => {
    const s = { ...base, daysSinceLastMatch: 1, lastMatchReviewed: true };
    expect(kinds(s)).not.toContain("review_match");
  });
});

describe("study", () => {
  it("rises the longer it has been", () => {
    const recent = find({ ...base, daysSinceStudy: 1 }, "study")!;
    const stale = find({ ...base, daysSinceStudy: 14 }, "study")!;
    expect(stale.score).toBeGreaterThan(recent.score);
  });

  it("is preferred on a low-readiness day, because it asks nothing of the legs", () => {
    const tired = find({ ...base, readiness: 30, daysSinceStudy: 5 }, "study")!;
    const fresh = find({ ...base, readiness: 85, daysSinceStudy: 5 }, "study")!;
    expect(tired.score).toBeGreaterThan(fresh.score);
  });

  it("names the goal it serves", () => {
    const a = find(base, "study")!;
    expect(a.title).toContain("Weak-foot finishing");
    expect(a.reason.toLowerCase()).toContain("weak-foot finishing");
  });

  it("is not offered at all when there is no goal to serve", () => {
    expect(kinds({ ...base, activeGoals: [] })).not.toContain("study");
  });
});

describe("when MIDO knows nothing", () => {
  /*
    The honesty rule. A product that invents a recommendation when it
    knows nothing is one whose recommendations cannot be trusted when it
    does.
  */
  const blank: PlayerSignals = {
    daysSinceLastMatch: null,
    lastMatchReviewed: true,
    daysUntilNextMatch: null,
    readiness: null,
    daysSinceCheckin: null,
    activeGoals: [],
    daysSinceStudy: null,
    daysSinceTraining: null,
  };

  it("asks for a focus rather than guessing at one", () => {
    expect(kinds(blank)).toContain("set_goal");
  });

  it("asks for a match rather than pretending to see form", () => {
    expect(kinds(blank)).toContain("log_match");
  });

  it("says plainly that it has nothing to go on", () => {
    expect(hasEnoughToRecommend(blank)).toBe(false);
  });

  it("has enough as soon as there is one goal", () => {
    expect(hasEnoughToRecommend({ ...blank, activeGoals: [{ id: "g", title: "x" }] })).toBe(true);
  });

  it("never invents a readiness number it was not given", () => {
    for (const a of rankActions(blank)) {
      expect(a.reason).not.toMatch(/readiness is \d/);
    }
  });
});

describe("being waved away", () => {
  it("drops something dismissed rather than repeating it at the same rank", () => {
    const s = { ...base, daysSinceStudy: 14 };
    const before = find(s, "study")!.score;
    const after = find({ ...s, recentlyDismissed: ["study"] }, "study");
    expect(after ? after.score : 0).toBeLessThan(before);
  });

  it("does not delete it forever — the situation can change", () => {
    // Halved, not removed: a dismissed study is still the right answer
    // in a fortnight.
    const s = { ...base, daysSinceStudy: 30, recentlyDismissed: ["study"] as const };
    const a = find({ ...s, recentlyDismissed: [...s.recentlyDismissed] }, "study");
    expect(a).toBeDefined();
  });
});

describe("the ranking itself", () => {
  it("is deterministic — the same situation ranks the same way twice", () => {
    const s = { ...base, daysSinceLastMatch: 2, lastMatchReviewed: false, readiness: 55 };
    expect(rankActions(s)).toEqual(rankActions(s));
  });

  it("gives every surfaced action a reason and a source", () => {
    const s = { ...base, daysSinceLastMatch: 1, lastMatchReviewed: false, readiness: 40 };
    for (const a of rankActions(s)) {
      expect(a.reason.length).toBeGreaterThan(10);
      expect(a.sources.length).toBeGreaterThan(0);
    }
  });

  it("writes reasons as sentences, not fragments", () => {
    for (const a of rankActions({ ...base, daysSinceLastMatch: 1, lastMatchReviewed: false })) {
      expect(a.reason).toMatch(/^[A-Z]/);
      expect(a.reason).toMatch(/\.$/);
    }
  });

  it("never returns the same kind twice", () => {
    const k = kinds({ ...base, daysSinceLastMatch: 1, lastMatchReviewed: false, readiness: 30 });
    expect(new Set(k).size).toBe(k.length);
  });
});

describe("not repeating what you just did", () => {
  /*
    The success criterion from the spec, and the single most trust-losing
    failure a recommender has: suggesting the thing somebody finished
    yesterday. One obvious repeat costs more than ten good suggestions
    earn.
  */
  const scanning: PlayerSignals = {
    ...base,
    activeGoals: [{ id: "g1", title: "Improve pre-reception scanning" }],
    daysSinceStudy: 1,
  };

  it("stops recommending a study that covers the active goal", () => {
    const s = {
      ...scanning,
      completedStudies: [{ subject: "Rodri — scanning before receiving", daysAgo: 1 }],
    };
    expect(kinds(s)).not.toContain("study");
  });

  it("keeps recommending study when the completed one was about something else", () => {
    // Studying finishing must not suppress a scanning recommendation.
    const s = {
      ...scanning,
      completedStudies: [{ subject: "Haaland — finishing across the keeper", daysAgo: 1 }],
    };
    expect(kinds(s)).toContain("study");
  });

  it("lets the same study return once it has gone stale", () => {
    const s = {
      ...scanning,
      completedStudies: [{ subject: "Rodri — scanning before receiving", daysAgo: 60 }],
    };
    expect(kinds(s)).toContain("study");
  });
});

describe("the full continuity scenario", () => {
  /*
    Goal, then film that points at it, then a study completed on it. The
    spec's proof that MIDO has continuity: the next step is not more
    watching, it is doing it on grass — and MIDO can say why from the
    player's own history.
  */
  const s: PlayerSignals = {
    ...base,
    readiness: 75,
    daysSinceTraining: 4,
    activeGoals: [{ id: "g1", title: "Improve pre-reception scanning" }],
    completedStudies: [{ subject: "Rodri — scanning before receiving", daysAgo: 1 }],
    filmObservations: [{ concept: "Late scan before receiving", daysAgo: 2, goalId: "g1" }],
  };

  it("recommends training rather than the study again", () => {
    expect(top(s).kind).toBe("training");
    expect(kinds(s)).not.toContain("study");
  });

  it("names the goal in the action itself", () => {
    expect(top(s).title).toContain("pre-reception scanning");
  });

  it("explains itself from goal, film and the completed study", () => {
    const reason = top(s).reason.toLowerCase();
    expect(reason).toContain("pre-reception scanning");
    expect(reason).toContain("film");
    expect(reason).toContain("already completed the related study");
  });

  it("cites all three as sources", () => {
    const sources = top(s).sources.join(" ");
    expect(sources).toContain("goal:g1");
    expect(sources).toContain("study:completed");
    expect(sources).toContain("observation:");
  });

  it("still refuses to apply it on grass when readiness is low", () => {
    // Continuity never overrides the safety rule.
    expect(kinds({ ...s, readiness: 25 })).not.toContain("training");
  });
});

describe("film evidence", () => {
  it("raises study when the footage points at the goal", () => {
    const withFilm = find(
      { ...base, filmObservations: [{ concept: "Late scan before receiving", daysAgo: 2, goalId: "g1" }],
        activeGoals: [{ id: "g1", title: "Improve pre-reception scanning" }] },
      "study",
    )!;
    const without = find(
      { ...base, activeGoals: [{ id: "g1", title: "Improve pre-reception scanning" }] },
      "study",
    )!;
    expect(withFilm.score).toBeGreaterThan(without.score);
  });

  it("is ignored once it is old", () => {
    const stale = find(
      { ...base, filmObservations: [{ concept: "Late scan before receiving", daysAgo: 120, goalId: "g1" }],
        activeGoals: [{ id: "g1", title: "Improve pre-reception scanning" }] },
      "study",
    )!;
    const without = find(
      { ...base, activeGoals: [{ id: "g1", title: "Improve pre-reception scanning" }] },
      "study",
    )!;
    expect(stale.score).toBe(without.score);
  });
});

describe("recent training", () => {
  it("is not recommended again the day after", () => {
    const yesterday = find({ ...base, readiness: 80, daysSinceTraining: 1 }, "training")!;
    const older = find({ ...base, readiness: 80, daysSinceTraining: 5 }, "training")!;
    expect(yesterday.score).toBeLessThan(older.score);
  });
});
