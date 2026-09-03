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
  planPriceLabel,
  rolesFor,
  seatsFor,
  tierLabel,
  tierOf,
  type PlanDef,
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

  The ladder is now two paid tiers on a DELIVERY axis: `xi` is the one the
  customer drives, `managed` is the one we run. Everything the old
  identity-shaped ladder was protecting still has to hold, so those assertions
  survive here in a form that does not depend on how many tiers there are.
*/

const PAID = (Object.keys(PLANS) as PlanId[]).filter((id) => id !== "free");

/** Every tier that charges money, retired ones included. */
const PAID_TIERS = [
  "xi",
  "managed",
  "player",
  "touchline",
  "touchline_coach",
  "touchline_trainer",
  "club",
] as const;

/** The tiers a customer can actually buy today. Two, by design. */
const SELLABLE_TIERS = ["xi", "managed"] as const;

/** Tiers billed on a recurring interval — everything except the quoted one. */
const BILLED_TIERS = PAID_TIERS.filter(
  (t) => !Object.values(PLANS).some((p) => p.tier === t && p.quoted),
);

/** The representative plan for a tier: its monthly price, or its quote. */
const planOf = (tier: Tier): PlanDef =>
  Object.values(PLANS).find((p) => p.tier === tier && (p.interval === "month" || p.quoted))!;

/*
  A quoted plan has no list price, so `priceCents: 0` means "not in this
  catalogue" rather than "free". Comparing it as zero would make Managed the
  cheapest thing on offer; comparing it as unbounded is what it actually is.
*/
const priceOf = (p: PlanDef): number => (p.quoted ? Infinity : p.priceCents);

describe("the ladder", () => {
  it("sells exactly two paid tiers", () => {
    const sellable = [...new Set(Object.values(PLANS).filter((p) => !p.legacy && p.tier !== "free").map((p) => p.tier))];
    expect(sellable.sort()).toEqual([...SELLABLE_TIERS].sort());
  });

  it("never prices a year above twelve months", () => {
    for (const tier of BILLED_TIERS) {
      const monthly = planOf(tier);
      const annual = Object.values(PLANS).find((p) => p.tier === tier && p.interval === "year")!;
      expect(annual.priceCents, tier).toBeLessThan(monthly.priceCents * 12);
    }
  });

  /*
    The linear "each step costs more than the last" rule died with the old
    ladder. What must still hold is the thing that rule was protecting — you
    are never charged more for strictly less — so it is asserted directly,
    against every pair of tiers including the retired ones.
  */
  it("never charges more for strictly less", () => {
    for (const a of PAID_TIERS) {
      for (const b of PAID_TIERS) {
        if (a === b) continue;
        const A = planOf(a);
        const B = planOf(b);
        const strictSuperset =
          B.roles.every((r) => A.roles.includes(r)) && A.roles.length > B.roles.length;
        if (strictSuperset) {
          expect(priceOf(A), `${A.id} opens more than ${B.id}`).toBeGreaterThanOrEqual(priceOf(B));
        }
      }
    }
  });

  it("puts Player underneath every paid tier, and Managed above all of them", () => {
    // Upgrading must never take a system away.
    for (const tier of PAID_TIERS) {
      expect(planOf(tier).roles, tier).toContain("player");
      for (const role of planOf(tier).roles) {
        expect(planOf("managed").roles, `managed dropped ${role}`).toContain(role);
      }
    }
  });

  it("separates the two sellable tiers by delivery and seats, not by system count", () => {
    const xi = planOf("xi");
    const managed = planOf("managed");
    // Everything an individual works in is on the cheaper tier already.
    expect(xi.roles).toEqual(expect.arrayContaining(["player", "coach", "trainer"]));
    // Club OS is the organisation layer, and it is meaningless on one seat.
    expect(xi.roles).not.toContain("club");
    expect(managed.roles).toContain("club");
    expect(xi.seats).toBe(1);
    expect(managed.seats).toBeGreaterThan(1);
  });

  it("gives more AI the more you pay", () => {
    const ai = (id: PlanId) => PLANS[id].entitlements.ai_interactions ?? 0;
    expect(ai("player_monthly")).toBeLessThan(ai("xi_monthly"));
    expect(ai("xi_monthly")).toBeLessThan(ai("managed"));
  });

  it("prices the same tier identically whichever interval you buy", () => {
    for (const tier of BILLED_TIERS) {
      const both = Object.values(PLANS).filter((p) => p.tier === tier);
      expect(both, tier).toHaveLength(2);
      expect(both[0].roles, tier).toEqual(both[1].roles);
      expect(both[0].entitlements, tier).toEqual(both[1].entitlements);
      expect(both[0].seats, tier).toBe(both[1].seats);
    }
  });
});

/*
  Retirement means "no longer offered", never "taken away". Migration 0046
  leaves every retired plan row in place for the same reason this block exists:
  live subscriptions still point at them.
*/
describe("the retired tiers", () => {
  it("still grant exactly what they sold", () => {
    expect(PLANS.player_monthly.roles).toEqual(["player"]);
    expect(PLANS.touchline_monthly.roles).toEqual(["player", "coach", "trainer"]);
    expect(PLANS.touchline_annual.roles).toEqual(["player", "coach", "trainer"]);
    expect(PLANS.touchline_coach_monthly.roles).toEqual(["player", "coach"]);
    expect(PLANS.touchline_trainer_monthly.roles).toEqual(["player", "trainer"]);
    expect(PLANS.club_monthly.roles).toEqual(["player", "coach", "trainer", "club"]);
    expect(seatsFor("club_monthly")).toBeGreaterThan(1);
  });

  it("are exactly the plans outside the two sellable tiers", () => {
    const legacy = Object.values(PLANS).filter((p) => p.legacy).map((p) => p.id).sort();
    expect(legacy).toEqual([
      "club_annual",
      "club_monthly",
      "player_annual",
      "player_monthly",
      "touchline_annual",
      "touchline_coach_annual",
      "touchline_coach_monthly",
      "touchline_monthly",
      "touchline_trainer_annual",
      "touchline_trainer_monthly",
    ]);
  });

  it("cannot be bought — no card, and never the cheapest way in", () => {
    const cardTiers = TIER_CARDS.map((c) => c.tier);
    for (const tier of ["player", "touchline", "touchline_coach", "touchline_trainer", "club"] as Tier[]) {
      expect(cardTiers, tier).not.toContain(tier);
    }
    for (const role of ROLE_IDS) {
      expect(cheapestPlanFor(role)?.legacy, role).toBeFalsy();
    }
  });
});

describe("the quoted tier", () => {
  it("has no interval and no list price, and says so", () => {
    expect(PLANS.managed.quoted).toBe(true);
    expect(PLANS.managed.interval).toBeNull();
    expect(planPriceLabel(PLANS.managed)).toBe("Quoted");
  });

  /*
    The bug this prevents: `formatPrice(0)` returns "Free", so anything
    rendering a quoted plan's price without checking `quoted` advertises the
    most expensive tier at nothing.
  */
  it("is never described as free", () => {
    expect(formatPrice(PLANS.managed.priceCents)).toBe("Free");
    expect(planPriceLabel(PLANS.managed)).not.toBe("Free");
    expect(isPaidPlan("managed")).toBe(true);
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

  it("reserves the club system for tiers that carry staff", () => {
    for (const id of PAID) {
      if (PLANS[id].roles.includes("club")) {
        expect(["managed", "club"], id).toContain(tierOf(id));
        expect(seatsFor(id), id).toBeGreaterThan(1);
      }
    }
  });

  it("only gives extra seats where the club system comes with them", () => {
    for (const id of PAID) {
      if (seatsFor(id) > 1) expect(PLANS[id].roles, id).toContain("club");
    }
  });
});

describe("upgrade prompts", () => {
  it("names the cheapest plan that opens a given system", () => {
    expect(cheapestPlanFor("player")?.id).toBe("xi_monthly");
    expect(cheapestPlanFor("coach")?.id).toBe("xi_monthly");
    expect(cheapestPlanFor("trainer")?.id).toBe("xi_monthly");
    // Club OS only exists on the quoted tier, so that is the honest answer.
    expect(cheapestPlanFor("club")?.id).toBe("managed");
  });

  /*
    A quoted plan is allowed here — it is the only way into the Club system —
    but it must never be the answer for a system `xi` already opens, or a
    player wanting film reads gets sent to a sales conversation.
  */
  it("only sends someone to a quote when nothing self-serve opens that system", () => {
    for (const role of ["player", "coach", "trainer"] as const) {
      expect(cheapestPlanFor(role)?.quoted, role).toBeFalsy();
      expect(cheapestPlanFor(role)?.interval, role).toBe("month");
    }
  });

  it("always returns something buyable for every system", () => {
    for (const role of ROLE_IDS) {
      const plan = cheapestPlanFor(role);
      expect(plan, role).toBeTruthy();
      expect(plan!.interval === "month" || plan!.quoted, role).toBeTruthy();
    }
  });
});

describe("the cards a customer reads", () => {
  it("has a card per sellable tier, in ladder order", () => {
    expect(TIER_CARDS.map((c) => c.tier)).toEqual(["free", "xi", "managed"]);
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

  it("gives the quoted card a route instead of a checkout", () => {
    const managed = TIER_CARDS.find((c) => c.tier === "managed")!;
    expect(managed.quoted).toBe(true);
    // No plan id means nothing for the upgrade button to buy.
    expect(managed.monthlyId).toBeUndefined();
    expect(managed.annualId).toBeUndefined();
    expect(managed.quotedCta?.length).toBeGreaterThan(0);
  });

  it("offers the trial only where something is actually charged", () => {
    for (const card of TIER_CARDS) {
      if (card.trialDays) {
        expect(card.monthlyId, card.tier).toBeTruthy();
        expect(card.trialDays).toBe(TRIAL_DAYS);
      }
    }
    expect(TIER_CARDS.find((c) => c.tier === "free")?.trialDays).toBeUndefined();
    expect(TIER_CARDS.find((c) => c.tier === "managed")?.trialDays).toBeUndefined();
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
    // $29 x 12 = $348 against $279 → 19.8%, and 2.4 months free.
    const s = annualSaving(2900, 27900);
    expect(s.pct).toBe(20);
    expect(s.monthsFree).toBeGreaterThan(2);
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
    for (const t of ["free", "xi", "managed", "player", "touchline", "club"] as Tier[]) {
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

  it("opens three systems on MIDO XI, but not Club", () => {
    for (const role of ["player", "coach", "trainer"] as const) {
      expect(canUseRole("xi_monthly", role), role).toBe(true);
    }
    expect(canUseRole("xi_monthly", "club")).toBe(false);
  });

  it("opens everything on Managed", () => {
    for (const role of ROLE_IDS) expect(canUseRole("managed", role), role).toBe(true);
  });

  it("still holds Player to Player, for the accounts still on it", () => {
    expect(canUseRole("player_monthly", "player")).toBe(true);
    for (const role of ["coach", "trainer", "club"] as const) {
      expect(canUseRole("player_monthly", role), role).toBe(false);
    }
  });

  it("answers the same for monthly and annual", () => {
    for (const role of ROLE_IDS) {
      expect(canUseRole("xi_monthly", role)).toBe(canUseRole("xi_annual", role));
      expect(canUseRole("player_monthly", role)).toBe(canUseRole("player_annual", role));
      expect(canUseRole("touchline_monthly", role)).toBe(canUseRole("touchline_annual", role));
      expect(canUseRole("club_monthly", role)).toBe(canUseRole("club_annual", role));
    }
  });

  it("never opens more on a cheaper plan than a dearer one", () => {
    const ladder: PlanId[] = ["free", "xi_monthly", "managed"];
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
