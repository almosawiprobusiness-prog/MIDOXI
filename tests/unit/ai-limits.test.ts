import { describe, it, expect } from "vitest";
import {
  FEATURE_LABELS,
  PLANS,
  TIER_CARDS,
  type MeteredFeature,
  type PlanId,
} from "../../lib/billing/plans";
import { allowanceLabel, quotaReason, upgradeReason } from "../../lib/billing/gate-copy";

/*
  What each tier is allowed to spend on AI.

  Two separate promises live in this file's subject matter, and both are made to
  someone who is paying:

    1. A limit that is advertised must be ENFORCED. Otherwise the cheap tier
       quietly gets the expensive tier's product.

    2. A limit that is advertised must have a FEATURE BEHIND IT. A number on a
       pricing page with nothing to spend it on is a sale of something that does
       not exist — and it is the easiest kind of fiction to ship, because
       nothing errors and nothing looks wrong.

  The second one is why `ENFORCED_FEATURES` is written out by hand below rather
  than derived. Deriving it from the plans would make the test agree with
  whatever the plans happen to say, which is exactly the thing being checked.
*/

const PAID: PlanId[] = [
  "player_monthly",
  "player_annual",
  "touchline_monthly",
  "touchline_annual",
  "club_monthly",
  "club_annual",
];

/**
 * Metered features that some code path actually checks and consumes.
 *
 * Keep this list honest by grepping for `consumeFeature("<name>")` — if a
 * feature is not consumed anywhere, it does not belong in any plan.
 */
const ENFORCED_FEATURES: MeteredFeature[] = [
  "ai_interactions", // lib/ai/coach-engine.ts, lib/ai/trainer-engine.ts
  "deep_analyses", // lib/video/frame-reader.ts, lib/video/native-video.ts
  "study_discoveries", // lib/ai/study-engine.ts, app/app/film-room/discover-actions.ts
];

describe("the free tier", () => {
  /*
    The gate the film room hits. `checkFeature` refuses when the plan is not
    paid OR the limit is zero, and free is both — so a free account is refused
    for the right reason rather than by accident.
  */
  it("includes no AI at all", () => {
    expect(PLANS.free.entitlements).toEqual({});
  });

  it("gives a zero limit for every metered feature, so film reading is refused", () => {
    for (const f of ENFORCED_FEATURES) {
      expect(PLANS.free.entitlements[f] ?? 0, f).toBe(0);
    }
  });

  it("is not a paid plan, so the refusal says 'paid feature' rather than 'used up'", () => {
    // The distinction matters to the person reading it: one is an upsell, the
    // other is "come back next month".
    expect(PLANS.free.priceCents).toBe(0);
    expect(PLANS.free.tier).toBe("free");
  });

  it("still promises the whole deterministic product", () => {
    // Free losing AI is the deal. Free losing the football tools is not.
    const card = TIER_CARDS.find((c) => c.tier === "free")!;
    expect(card.perks.length).toBeGreaterThan(2);
    expect(card.perks.join(" ")).toMatch(/everything|every tool/i);
  });
});

describe("every advertised limit is real", () => {
  it("never sells a metered feature that no code path consumes", () => {
    /*
      `weekly_reviews` was in all three paid tiers at 4 / 8 / 20, was listed on
      the membership page's usage meters, and was a Player perk — "Weekly
      reviews that name what actually changed". Nothing in the codebase
      generated one, checked the limit, or consumed it. It was a number with no
      product behind it, on a page people pay from.
    */
    for (const id of PAID) {
      for (const feature of Object.keys(PLANS[id].entitlements) as MeteredFeature[]) {
        expect(
          ENFORCED_FEATURES,
          `${id} sells "${feature}", but nothing consumes it — either wire it up or stop selling it`,
        ).toContain(feature);
      }
    }
  });

  it("only labels features that a plan can actually grant", () => {
    for (const { key } of FEATURE_LABELS) {
      expect(ENFORCED_FEATURES, `FEATURE_LABELS lists "${key}"`).toContain(key);
    }
  });

  it("gives every paid tier a nonzero limit for everything it lists", () => {
    for (const id of PAID) {
      for (const [feature, limit] of Object.entries(PLANS[id].entitlements)) {
        expect(limit, `${id}.${feature}`).toBeGreaterThan(0);
      }
    }
  });
});

describe("the ladder of AI", () => {
  it("gives strictly more of every feature as the tier rises", () => {
    const ladder: PlanId[] = ["player_monthly", "touchline_monthly", "club_monthly"];
    for (const feature of ENFORCED_FEATURES) {
      for (let i = 1; i < ladder.length; i++) {
        const lower = PLANS[ladder[i - 1]].entitlements[feature] ?? 0;
        const higher = PLANS[ladder[i]].entitlements[feature] ?? 0;
        expect(higher, `${ladder[i]}.${feature} vs ${ladder[i - 1]}`).toBeGreaterThan(lower);
      }
    }
  });

  it("offers the same allowance whether you pay monthly or yearly", () => {
    // Buying a year must never quietly buy less AI per month.
    for (const tier of ["player", "touchline", "club"] as const) {
      const [a, b] = Object.values(PLANS).filter((p) => p.tier === tier);
      expect(a.entitlements, tier).toEqual(b.entitlements);
    }
  });

  it("keeps film reading the scarcest thing on every plan", () => {
    // A film read is the most expensive call MIDO makes. If it were ever the
    // most generous allowance, the cost model would be upside down.
    for (const id of PAID) {
      const e = PLANS[id].entitlements;
      expect(e.deep_analyses!, id).toBeLessThan(e.ai_interactions!);
    }
  });
});

describe("what MIDO says when it refuses", () => {
  it("never points at a plan that no longer exists", () => {
    /*
      Four of the five refusals in the codebase said "this is a Pro feature".
      Pro stopped existing when the tiers became Free / Player / Touchline /
      Club, so the product was telling people to buy something unbuyable.
    */
    const sentences = [
      upgradeReason("deep_analyses", "player"),
      upgradeReason("ai_interactions", "coach"),
      upgradeReason("ai_interactions", "trainer"),
      upgradeReason("study_discoveries", "player"),
      quotaReason("deep_analyses", 20, 20),
    ];
    for (const s of sentences) expect(s, s).not.toMatch(/\bPro\b/);
  });

  it("names the actual plan and its price", () => {
    const s = upgradeReason("deep_analyses", "player");
    expect(s).toContain("MIDO XI Player");
    expect(s).toContain("$9.99");
    expect(s).toContain(String(PLANS.player_monthly.entitlements.deep_analyses));
  });

  it("sends a coach to a plan that actually opens the coach system", () => {
    // Player is cheaper, and would sell them something that does not open
    // their own product.
    expect(upgradeReason("ai_interactions", "coach")).toContain("Touchline");
    expect(upgradeReason("ai_interactions", "trainer")).toContain("Touchline");
  });

  it("always says what still works without paying", () => {
    for (const role of ["player", "coach", "trainer"] as const) {
      for (const f of ENFORCED_FEATURES) {
        expect(upgradeReason(f, role), `${role}/${f}`).toMatch(/free/i);
      }
    }
  });

  it("distinguishes 'not bought' from 'used up'", () => {
    // Telling someone to upgrade when they already pay is the fastest way to
    // lose them.
    const quota = quotaReason("deep_analyses", 20, 20);
    expect(quota).toMatch(/used all 20/i);
    expect(quota).toMatch(/reset/i);
    expect(quota).not.toMatch(/comes with|\$/);
  });
});

describe("saying what is left before it runs out", () => {
  it("counts down, and gets the singular right", () => {
    expect(allowanceLabel("deep_analyses", 0, 20)).toBe("20 of 20 film reads left this month");
    expect(allowanceLabel("deep_analyses", 19, 20)).toBe("1 film read left this month");
    expect(allowanceLabel("deep_analyses", 20, 20)).toBe("No film reads left this month");
  });

  it("says nothing on a plan that has none, where the refusal already explains it", () => {
    expect(allowanceLabel("deep_analyses", 0, 0)).toBeNull();
  });

  it("never goes negative if usage somehow overshoots", () => {
    expect(allowanceLabel("deep_analyses", 25, 20)).toBe("No film reads left this month");
  });
});
