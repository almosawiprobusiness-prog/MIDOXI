import { describe, it, expect } from "vitest";
import {
  FREE_ROLES,
  PLANS,
  TIER_CARDS,
  TRIAL_DAYS,
  annualSaving,
  canUseRole,
  cheapestPlanFor,
  formatPrice,
  isPaidPlan,
  rolesFor,
  seatsFor,
  tierLabel,
  tierOf,
  type PlanId,
  type Tier,
} from "../../lib/billing/plans";
import { ROLE_IDS } from "../../lib/roles/roles";

/*
  The plan catalogue decides two things nothing else may override: which
  operating systems an account can open, and how much metered AI it gets. Both
  are money, and one of them is access control.

  These tests exist mostly to catch the mistakes that are cheap to make and
  expensive to ship — an annual price above twelve monthlies, a tier that opens
  a system a cheaper tier already opens, free quietly gaining AI.
*/

const PAID = (Object.keys(PLANS) as PlanId[]).filter((id) => id !== "free");
/*
  The catalogue is a branch, not a line: Touchline Coach and Touchline Trainer
  cost the same, open different systems, and neither contains the other. They
  share a rank because ranking them against each other would be meaningless.
  `touchline` is the retired bundle they replaced - grandfathered, never sold.
*/
/** Every tier that charges money, retired ones included. */
const PAID_TIERS = ["player", "touchline", "touchline_coach", "touchline_trainer", "club"] as const;

/** The tiers a customer can actually buy today. */
const SELLABLE_TIERS = ["player", "touchline_coach", "touchline_trainer", "club"] as const;

const monthlyOf = (tier: Tier) =>
  Object.values(PLANS).find((p) => p.tier === tier && p.interval === "month")!;

describe("the ladder", () => {
  it("never prices a year above twelve months", () => {
    for (const tier of PAID_TIERS) {
      const monthly = monthlyOf(tier);
      const annual = Object.values(PLANS).find((p) => p.tier === tier && p.interval === "year")!;
      expect(annual.priceCents, tier).toBeLessThan(monthly.priceCents * 12);
    }
  });

  /*
    The linear "each step costs more than the last" rule died with the split:
    Coach and Trainer cost the same as each other. What must still hold is the
    thing that rule was protecting - you are never charged more for strictly
    less - so it is asserted directly, against every pair of tiers.
  */
  it("never charges more for strictly less", () => {
    for (const a of PAID_TIERS) {
      for (const b of PAID_TIERS) {
        if (a === b) continue;
        const A = monthlyOf(a);
        const B = monthlyOf(b);
        const strictSuperset =
          B.roles.every((r) => A.roles.includes(r)) && A.roles.length > B.roles.length;
        if (strictSuperset) {
          expect(A.priceCents, `${A.id} opens more than ${B.id}`).toBeGreaterThanOrEqual(
            B.priceCents,
          );
        }
      }
    }
  });

  it("puts Player underneath every paid tier, and Club above all of them", () => {
    // Upgrading must never take a system away.
    for (const tier of PAID_TIERS) {
      expect(monthlyOf(tier).roles, tier).toContain("player");
      for (const role of monthlyOf(tier).roles) {
        expect(monthlyOf("club").roles, `club dropped ${role}`).toContain(role);
      }
    }
  });

  it("makes the two Touchline tiers siblings rather than a ladder", () => {
    const coach = monthlyOf("touchline_coach");
    const trainer = monthlyOf("touchline_trainer");
    // Same money.
    expect(coach.priceCents).toBe(trainer.priceCents);
    // Neither is a superset of the other - that is the point of splitting them.
    expect(coach.roles).not.toContain("trainer");
    expect(trainer.roles).not.toContain("coach");
    // Both systems together is what the retired bundle was, and now Club.
    expect(monthlyOf("club").roles).toEqual(
      expect.arrayContaining([...coach.roles, ...trainer.roles]),
    );
  });

  it("gives more AI the more you pay", () => {
    const ai = (id: PlanId) => PLANS[id].entitlements.ai_interactions ?? 0;
    expect(ai("player_monthly")).toBeLessThan(ai("touchline_coach_monthly"));
    expect(ai("touchline_coach_monthly")).toBe(ai("touchline_trainer_monthly"));
    expect(ai("touchline_coach_monthly")).toBeLessThan(ai("club_monthly"));
  });

  it("prices the same tier identically whichever interval you buy", () => {
    for (const tier of PAID_TIERS) {
      const both = Object.values(PLANS).filter((p) => p.tier === tier);
      expect(both, tier).toHaveLength(2);
      expect(both[0].roles, tier).toEqual(both[1].roles);
      expect(both[0].entitlements, tier).toEqual(both[1].entitlements);
      expect(both[0].seats, tier).toBe(both[1].seats);
    }
  });
});

describe("the retired Touchline bundle", () => {
  it("is still honoured, so nobody loses what they bought", () => {
    expect(PLANS.touchline_monthly.roles).toEqual(["player", "coach", "trainer"]);
    expect(PLANS.touchline_annual.roles).toEqual(["player", "coach", "trainer"]);
  });

  it("is marked legacy, and is the only thing that is", () => {
    const legacy = Object.values(PLANS)
      .filter((p) => p.legacy)
      .map((p) => p.id);
    expect(legacy.sort()).toEqual(["touchline_annual", "touchline_monthly"]);
  });

  it("cannot be bought - no card, and never the cheapest way in", () => {
    expect(TIER_CARDS.map((c) => c.tier)).not.toContain("touchline");
    for (const role of ROLE_IDS) {
      expect(cheapestPlanFor(role)?.legacy, role).toBeFalsy();
    }
  });
});

describe("free", () => {
  it("costs nothing and has no interval", () => {
    expect(PLANS.free.priceCents).toBe(0);
    expect(PLANS.free.interval).toBeNull();
    expect(isPaidPlan("free")).toBe(false);
  });

  it("includes no AI at all", () => {
    // Free is the whole deterministic product. It does not tease.
    expect(PLANS.free.entitlements).toEqual({});
  });

  it("names no system, because the account gets the one it chose", () => {
    // The empty list IS the free-tier rule; session.ts reads it that way.
    expect(rolesFor("free")).toEqual([]);
  });

  it("gets one seat", () => {
    expect(seatsFor("free")).toBe(1);
  });
});

describe("what each tier opens", () => {
  it("only ever names real roles", () => {
    for (const id of PAID) {
      for (const r of PLANS[id].roles) expect(ROLE_IDS, id).toContain(r);
    }
  });

  it("gives every paid tier at least one system", () => {
    for (const id of PAID) expect(PLANS[id].roles.length, id).toBeGreaterThan(0);
  });

  it("puts the player system in every paid tier", () => {
    // A coach wants to see what their players see; it costs nothing to include.
    for (const id of PAID) expect(PLANS[id].roles, id).toContain("player");
  });

  it("reserves the club system for the club tier", () => {
    for (const id of PAID) {
      if (PLANS[id].roles.includes("club")) expect(tierOf(id)).toBe("club");
    }
  });

  it("only gives extra seats to club", () => {
    for (const id of PAID) {
      if (seatsFor(id) > 1) expect(tierOf(id), id).toBe("club");
    }
    expect(seatsFor("club_monthly")).toBeGreaterThan(1);
  });
});

describe("upgrade prompts", () => {
  it("names the cheapest plan that opens a given system", () => {
    expect(cheapestPlanFor("player")?.id).toBe("player_monthly");
    expect(cheapestPlanFor("coach")?.id).toBe("touchline_coach_monthly");
    expect(cheapestPlanFor("trainer")?.id).toBe("touchline_trainer_monthly");
    expect(cheapestPlanFor("club")?.id).toBe("club_monthly");
  });

  it("always returns a monthly plan, so the quoted price is the smallest commitment", () => {
    for (const role of ROLE_IDS) {
      expect(cheapestPlanFor(role)?.interval, role).toBe("month");
    }
  });
});

describe("the cards a customer reads", () => {
  it("has a card per sellable tier, in ladder order", () => {
    expect(TIER_CARDS.map((c) => c.tier)).toEqual([
      "free",
      "player",
      "touchline_coach",
      "touchline_trainer",
      "club",
    ]);
    for (const tier of SELLABLE_TIERS) {
      expect(TIER_CARDS.map((c) => c.tier), tier).toContain(tier);
    }
  });

  it("quotes the same prices the plans charge", () => {
    for (const card of TIER_CARDS) {
      if (card.monthlyId) expect(card.monthlyCents, card.tier).toBe(PLANS[card.monthlyId].priceCents);
      if (card.annualId) expect(card.annualCents, card.tier).toBe(PLANS[card.annualId].priceCents);
    }
  });

  it("offers the trial only where something is actually charged", () => {
    for (const card of TIER_CARDS) {
      if (card.trialDays) {
        expect(card.monthlyId, card.tier).toBeTruthy();
        expect(card.trialDays).toBe(TRIAL_DAYS);
      }
    }
    expect(TIER_CARDS.find((c) => c.tier === "free")?.trialDays).toBeUndefined();
  });

  it("marks exactly one tier as the popular one", () => {
    expect(TIER_CARDS.filter((c) => c.popular)).toHaveLength(1);
  });

  it("says what each tier opens", () => {
    for (const card of TIER_CARDS) {
      expect(card.systems.length, card.tier).toBeGreaterThan(0);
      expect(card.perks.length, card.tier).toBeGreaterThan(2);
    }
  });
});

describe("saving arithmetic", () => {
  it("reports a real percentage, not a rounded-up claim", () => {
    // $9.99 x 12 = $119.88 against $89 → 25.8%, and 3.1 months free.
    const s = annualSaving(999, 8900);
    expect(s.pct).toBe(26);
    expect(s.monthsFree).toBeGreaterThan(3);
  });

  it("claims nothing when there is nothing to claim", () => {
    expect(annualSaving(0, 0)).toEqual({ pct: 0, monthsFree: 0 });
  });
});

describe("labels", () => {
  it("formats whole prices without stray decimals", () => {
    expect(formatPrice(0)).toBe("Free");
    expect(formatPrice(2900)).toBe("$29");
    expect(formatPrice(999)).toBe("$9.99");
  });

  it("names every tier", () => {
    for (const t of ["free", "player", "touchline", "club"] as Tier[]) {
      expect(tierLabel(t).length, t).toBeGreaterThan(0);
    }
  });
});

/*
  The gate itself. `canUseRole` is what both the switcher and the server action
  read, and it is the only thing standing between a free account and the Club
  system — so it is worth more tests than anything else in this file.
*/
describe("who may open what", () => {
  it("lets a free account choose Player, Coach or Trainer", () => {
    for (const role of FREE_ROLES) expect(canUseRole("free", role), role).toBe(true);
  });

  it("never lets a free account open Club", () => {
    // Club is an organisation tier with staff seats. There is no free form of it.
    expect(canUseRole("free", "club")).toBe(false);
    expect(FREE_ROLES).not.toContain("club");
  });

  it("holds Player to Player", () => {
    expect(canUseRole("player_monthly", "player")).toBe(true);
    for (const role of ["coach", "trainer", "club"] as const) {
      expect(canUseRole("player_monthly", role), role).toBe(false);
    }
  });

  it("opens three systems on Touchline, but not Club", () => {
    for (const role of ["player", "coach", "trainer"] as const) {
      expect(canUseRole("touchline_monthly", role), role).toBe(true);
    }
    expect(canUseRole("touchline_monthly", "club")).toBe(false);
  });

  it("opens everything on Club", () => {
    for (const role of ROLE_IDS) expect(canUseRole("club_monthly", role), role).toBe(true);
  });

  it("answers the same for monthly and annual", () => {
    for (const role of ROLE_IDS) {
      expect(canUseRole("player_monthly", role)).toBe(canUseRole("player_annual", role));
      expect(canUseRole("touchline_monthly", role)).toBe(canUseRole("touchline_annual", role));
      expect(canUseRole("club_monthly", role)).toBe(canUseRole("club_annual", role));
    }
  });

  it("never opens more on a cheaper plan than a dearer one", () => {
    const ladder: PlanId[] = ["free", "player_monthly", "touchline_monthly", "club_monthly"];
    for (const role of ROLE_IDS) {
      let seenOpen = false;
      for (const plan of ladder) {
        const open = canUseRole(plan, role);
        // Once a tier opens a role, no higher tier may close it — except free,
        // whose single choice is not a superset of anything.
        if (plan !== "free" && seenOpen) expect(open, `${plan} closed ${role}`).toBe(true);
        if (plan !== "free" && open) seenOpen = true;
      }
    }
  });
});
