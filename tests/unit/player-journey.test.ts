import { describe, it, expect } from "vitest";
import { toPlayerSignals, type RawSignalInputs } from "../../lib/intelligence/signals";
import {
  rankActions,
  explainActions,
  hasEnoughToRecommend,
  coversSameGround,
} from "../../lib/intelligence/next-best-action";
import {
  toSurfaced,
  parseSource,
  describeSource,
} from "../../lib/intelligence/recommendation-types";
import { briefingLinesToSuppress } from "../../lib/intelligence/overlap";

/*
  THE PLAYER LOOP, END TO END.

  Every other test in this suite checks one function against a stated
  situation. These check the CHAIN: rows as the adapters return them →
  signals → ranking → the words a player actually reads → what that
  costs the briefing underneath.

  They exist because each link has been correct on its own while the
  chain was broken. The scorer read `goal:g1` and the panel printed
  "GOAL g1". The dismissal wrote correctly and the card came back
  promoted. Both passed every unit test at the time.

  ───────────────────────────────────────────────────────────────────────
  WHERE THE CHAIN IS CUT, AND WHY
  ───────────────────────────────────────────────────────────────────────

  These stop at the last pure boundary. Persistence
  (`surfaceRecommendations`) carries `import "server-only"`, which vitest
  cannot load, and mocking Supabase to reach past it would test the mock.
  So the store is covered by its own unit tests and by browser
  verification, and everything from raw rows to rendered sentence is
  covered here.

  That cut is honest about one thing in particular: a journey below that
  ends "the player would now see X" means the RANKING says X. It does not
  prove a row was written.
*/

/** A fixed clock. Every date below is stated relative to this. */
const NOW = new Date("2026-08-25T09:00:00.000Z");
const daysAgo = (n: number) =>
  new Date(NOW.getTime() - n * 86_400_000).toISOString();
const inDays = (n: number) =>
  new Date(NOW.getTime() + n * 86_400_000).toISOString();

/** An account with nothing on it. Each journey adds only what it needs. */
function blank(): RawSignalInputs {
  return { matches: [], goals: [], training: [], checkins: [], events: [] };
}

/** The whole chain, as a surface would run it. */
function run(raw: RawSignalInputs) {
  const signals = toPlayerSignals(raw, NOW);
  const ranked = rankActions(signals);
  const top = ranked[0] ?? null;
  return {
    signals,
    ranked,
    kinds: ranked.map((r) => r.kind),
    top,
    /** What the panel would render under "why this?". */
    why: (top?.sources ?? [])
      .map((t) => describeSource(parseSource(t)))
      .filter(Boolean) as string[],
    /** Which briefing lines the panel would silence. */
    suppressed: briefingLinesToSuppress(ranked.slice(0, 3).map((r) => r.kind)),
  };
}

/* ─────────────────────────────────────────────────────────────────────
   JOURNEY A — a match is played and left unreviewed
   ───────────────────────────────────────────────────────────────────── */

describe("Journey A · played, not reviewed", () => {
  const raw: RawSignalInputs = {
    ...blank(),
    matches: [{ id: "m1", date: daysAgo(1), reviewed: false }],
    goals: [{ id: "g1", title: "Near-post finishing", status: "active" }],
    checkins: [{ date: daysAgo(0), readiness: 75 }],
  };

  it("puts the review first, above everything else available", () => {
    const { top, kinds } = run(raw);
    expect(top?.kind).toBe("review_match");
    // Training is available and healthy, and still loses to the review.
    expect(kinds).toContain("training");
    expect(kinds.indexOf("review_match")).toBeLessThan(kinds.indexOf("training"));
  });

  it("says why in the player's own history, not in general terms", () => {
    const { top } = run(raw);
    expect(top?.reason).toMatch(/played yesterday/i);
    expect(top?.reason).toMatch(/not reviewed/i);
  });

  it("silences the briefing's duplicate line", () => {
    expect(run(raw).suppressed).toContain("review");
  });

  it("drops the review once it is written", () => {
    const reviewed = {
      ...raw,
      matches: [{ id: "m1", date: daysAgo(1), reviewed: true }],
    };
    expect(run(reviewed).kinds).not.toContain("review_match");
    expect(run(reviewed).suppressed).not.toContain("review");
  });
});

/* ─────────────────────────────────────────────────────────────────────
   JOURNEY B — film evidence points at a goal, and study follows
   ───────────────────────────────────────────────────────────────────── */

describe("Journey B · film evidence raises study", () => {
  const withoutFilm: RawSignalInputs = {
    ...blank(),
    goals: [{ id: "g1", title: "Pre-reception scanning", status: "active" }],
    checkins: [{ date: daysAgo(0), readiness: 72 }],
    matches: [{ id: "m1", date: daysAgo(6), reviewed: true }],
  };

  const withFilm: RawSignalInputs = {
    ...withoutFilm,
    events: [
      {
        type: "FILM_OBSERVATION_CREATED",
        occurredAt: daysAgo(2),
        payload: { concept: "Late scan before receiving", goalId: "g1" },
      },
    ],
  };

  it("scores study higher once the player's own footage backs it", () => {
    const before = run(withoutFilm).ranked.find((r) => r.kind === "study");
    const after = run(withFilm).ranked.find((r) => r.kind === "study");
    expect(after!.score).toBeGreaterThan(before!.score);
  });

  it("names the observation in the reason, not the concept of having film", () => {
    const { ranked } = run(withFilm);
    const study = ranked.find((r) => r.kind === "study");
    expect(study?.reason).toMatch(/late scan before receiving/i);
  });

  it("shows the observation verbatim under 'why this?'", () => {
    /*
      An observation is already football words. The failure this guards
      is the one that shipped: sources rendered as keys, so "why this?"
      read "OBSERVATION late-scan" instead of the phrase a coach wrote.
    */
    const study = run(withFilm).ranked.find((r) => r.kind === "study")!;
    const why = study.sources
      .map((t) => describeSource(parseSource(t)))
      .filter(Boolean);
    expect(why).toContain("Late scan before receiving");
    for (const line of why) expect(line).not.toMatch(/^[a-z]+:/);
  });
});

/* ─────────────────────────────────────────────────────────────────────
   JOURNEY C — study is done, so the next step is grass
   ───────────────────────────────────────────────────────────────────── */

describe("Journey C · study completed turns into training", () => {
  const base: RawSignalInputs = {
    ...blank(),
    goals: [{ id: "g1", title: "Pre-reception scanning", status: "active" }],
    checkins: [{ date: daysAgo(0), readiness: 80 }],
    matches: [{ id: "m1", date: daysAgo(8), reviewed: true }],
    training: [{ scheduledAt: daysAgo(4) }],
    events: [
      {
        type: "FILM_OBSERVATION_CREATED",
        occurredAt: daysAgo(3),
        payload: { concept: "Late scan before receiving", goalId: "g1" },
      },
    ],
  };

  const afterStudy: RawSignalInputs = {
    ...base,
    events: [
      ...base.events,
      {
        type: "STUDY_COMPLETED",
        occurredAt: daysAgo(1),
        payload: { subject: "Rodri — scanning before receiving" },
      },
    ],
  };

  it("recommends studying first, and training after the study is done", () => {
    expect(run(base).top?.kind).toBe("study");
    expect(run(afterStudy).top?.kind).toBe("training");
  });

  it("names the goal in the training title once it is applying something", () => {
    const top = run(afterStudy).top;
    expect(top?.title).toBe("Train: Pre-reception scanning");
  });

  it("gives the continuity reason — goal, film and the study already done", () => {
    /*
      The whole argument for the event log in one assertion: none of
      these three facts is available from the training page, and the
      recommendation cites all three.
    */
    const reason = run(afterStudy).top?.reason ?? "";
    expect(reason).toMatch(/pre-reception scanning/i);
    expect(reason).toMatch(/film showed/i);
    expect(reason).toMatch(/already completed the related study/i);
  });

  it("stops repeating the study it just watched", () => {
    const study = run(afterStudy).ranked.find((r) => r.kind === "study");
    const before = run(base).ranked.find((r) => r.kind === "study")!;
    // Either gone, or clearly demoted — never still first.
    expect(study?.score ?? 0).toBeLessThan(before.score);
    expect(run(afterStudy).kinds[0]).not.toBe("study");
  });
});

/* ─────────────────────────────────────────────────────────────────────
   JOURNEY D — the body says no
   ───────────────────────────────────────────────────────────────────── */

describe("Journey D · low readiness and a fixture tomorrow", () => {
  const depleted: RawSignalInputs = {
    ...blank(),
    goals: [{ id: "g1", title: "Near-post finishing", status: "active" }],
    checkins: [{ date: daysAgo(0), readiness: 32 }],
    matches: [
      { id: "m1", date: daysAgo(1), reviewed: true },
      { id: "m2", date: inDays(1), reviewed: false },
    ],
  };

  it("never surfaces hard training — suppressed, not merely down-weighted", () => {
    const { kinds } = run(depleted);
    expect(kinds).not.toContain("training");

    const training = explainActions(toPlayerSignals(depleted, NOW)).find(
      (c) => c.action.kind === "training",
    );
    expect(training?.surfaced).toBe(false);
    expect(training?.dropped).toBe("below-floor");
  });

  it("puts recovery above study, because depletion is not a fixture question", () => {
    const { kinds } = run(depleted);
    expect(kinds).toContain("recovery");
    expect(kinds.indexOf("recovery")).toBeLessThan(
      kinds.indexOf("study") === -1 ? Infinity : kinds.indexOf("study"),
    );
  });

  it("still allows study, which asks nothing of the legs", () => {
    expect(run(depleted).kinds).toContain("study");
  });

  it("holds training back the day before a match even when fresh", () => {
    const fresh = { ...depleted, checkins: [{ date: daysAgo(0), readiness: 88 }] };
    expect(run(fresh).kinds).not.toContain("training");
  });
});

/* ─────────────────────────────────────────────────────────────────────
   JOURNEY E — the player answers back
   ───────────────────────────────────────────────────────────────────── */

describe("Journey E · dismissal is respected without being permanent", () => {
  const raw: RawSignalInputs = {
    ...blank(),
    matches: [{ id: "m1", date: daysAgo(1), reviewed: false }],
    goals: [{ id: "g1", title: "Near-post finishing", status: "active" }],
    checkins: [{ date: daysAgo(0), readiness: 75 }],
  };

  it("demotes what was waved away rather than deleting it", () => {
    const dismissed = { ...raw, dismissedKinds: ["review_match" as const] };
    const before = run(raw);
    const after = run(dismissed);

    expect(before.top?.kind).toBe("review_match");
    expect(after.top?.kind).not.toBe("review_match");

    const still = after.ranked.find((r) => r.kind === "review_match");
    const was = before.ranked.find((r) => r.kind === "review_match")!;
    expect(still?.score ?? 0).toBeLessThan(was.score);
  });

  it("stops silencing the briefing line once the panel no longer leads with it", () => {
    /*
      The two surfaces have to agree. If the panel demotes the review out
      of the top three, the briefing must start saying it again —
      otherwise waving away a recommendation quietly deletes the only
      other mention of an unreviewed match.
    */
    const dismissed = { ...raw, dismissedKinds: ["review_match" as const] };
    const { ranked, suppressed } = run(dismissed);
    const inTopThree = ranked.slice(0, 3).some((r) => r.kind === "review_match");
    expect(suppressed.includes("review")).toBe(inTopThree);
  });
});

/* ─────────────────────────────────────────────────────────────────────
   The rules that must hold on every journey above
   ───────────────────────────────────────────────────────────────────── */

describe("invariants across every journey", () => {
  const journeys: Record<string, RawSignalInputs> = {
    "A · unreviewed match": {
      ...blank(),
      matches: [{ id: "m1", date: daysAgo(1), reviewed: false }],
      goals: [{ id: "g1", title: "Near-post finishing", status: "active" }],
      checkins: [{ date: daysAgo(0), readiness: 75 }],
    },
    "B · film evidence": {
      ...blank(),
      goals: [{ id: "g1", title: "Pre-reception scanning", status: "active" }],
      checkins: [{ date: daysAgo(0), readiness: 72 }],
      events: [
        {
          type: "FILM_OBSERVATION_CREATED",
          occurredAt: daysAgo(2),
          payload: { concept: "Late scan before receiving", goalId: "g1" },
        },
      ],
    },
    "D · depleted": {
      ...blank(),
      goals: [{ id: "g1", title: "Near-post finishing", status: "active" }],
      checkins: [{ date: daysAgo(0), readiness: 32 }],
      matches: [{ id: "m1", date: daysAgo(1), reviewed: true }],
    },
    "empty account": blank(),
  };

  it("never renders a source that reads as a key", () => {
    for (const [name, raw] of Object.entries(journeys)) {
      for (const action of run(raw).ranked) {
        for (const token of action.sources) {
          const phrase = describeSource(parseSource(token));
          // Null is fine — the panel drops it. A key is not.
          if (phrase) expect(phrase, `${name} · ${token}`).not.toMatch(/^[a-z_]+:/);
        }
      }
    }
  });

  it("always produces a reason that reads as a sentence", () => {
    for (const [name, raw] of Object.entries(journeys)) {
      for (const action of run(raw).ranked) {
        expect(action.reason, name).toMatch(/^[A-Z]/);
        expect(action.reason, name).toMatch(/[.!?]$/);
        expect(action.reason, name).not.toMatch(/\s{2,}|\s,/);
      }
    }
  });

  it("survives the round trip into storage shape without losing anything", () => {
    for (const [name, raw] of Object.entries(journeys)) {
      for (const action of run(raw).ranked) {
        const stored = toSurfaced(action);
        expect(stored.title, name).toBe(action.title);
        expect(stored.reason, name).toBe(action.reason);
        expect(stored.sources.length, name).toBe(action.sources.length);
      }
    }
  });

  it("refuses to advise an account it knows nothing about", () => {
    /*
      The scorer still produces candidates here, and should: "set a
      development focus" and "log a match" are exactly right for an empty
      account. What must not happen is those being dressed up as
      INTELLIGENCE, so the gate is a separate question the surface asks
      first — and it answers no.
    */
    const signals = toPlayerSignals(blank(), NOW);
    expect(hasEnoughToRecommend(signals)).toBe(false);

    // And what it would have said is onboarding, not analysis.
    const kinds = rankActions(signals).map((r) => r.kind);
    expect(kinds).toContain("set_goal");
    expect(kinds).toContain("log_match");
    expect(kinds).not.toContain("review_match");
  });

  it("starts advising as soon as there is one real fact to stand on", () => {
    const oneGoal: RawSignalInputs = {
      ...blank(),
      goals: [{ id: "g1", title: "Near-post finishing", status: "active" }],
    };
    expect(hasEnoughToRecommend(toPlayerSignals(oneGoal, NOW))).toBe(true);
  });
});

describe("Journey F · the player's memory reaches the loop", () => {
  /*
    The Memory page promises "MIDO reads this before it answers
    anything". For the deterministic loop that was false: an "already
    tried" note about near-post finishing had no visible effect on a
    near-post finishing recommendation. The fix attaches the memory to
    the card rather than bending the score — these pin the matching,
    which is the part that can rot.
  */
  it("matches an 'already tried' memory to the advice it bears on", () => {
    expect(
      coversSameGround(
        "Six weeks of near-post finishing reps — the timing improved, the finish did not.",
        "Study: Near-post finishing Your current focus is near-post finishing and you have not studied yet.",
      ),
    ).toBe(true);
  });

  it("does not match a memory about different ground", () => {
    expect(
      coversSameGround(
        "Two team sessions a week plus one gym slot. No pitch access at weekends.",
        "Review your last match You played yesterday and have not reviewed it yet.",
      ),
    ).toBe(false);
  });
});
