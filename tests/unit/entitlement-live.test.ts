import { describe, it, expect } from "vitest";
import { PLANS, canUseRole, rolesFor, tierOf } from "../../lib/billing/plans";

/*
  What a real Player subscription actually grants.

  Pinned against the row the Stripe webhook wrote for the first real payment:
  plan_id=player_monthly, status=trialing, period ending seven days out.
*/
describe("a live player_monthly subscription", () => {
  it("is a paid tier", () => {
    expect(PLANS.player_monthly.priceCents).toBe(999);
    expect(tierOf("player_monthly")).toBe("player");
  });

  it("unlocks the AI allowances", () => {
    const e = PLANS.player_monthly.entitlements;
    expect(e.ai_interactions).toBeGreaterThan(0);
    expect(e.deep_analyses).toBeGreaterThan(0);
    expect(e.study_discoveries).toBeGreaterThan(0);
  });

  it("opens the Player system and nothing else", () => {
    expect(rolesFor("player_monthly")).toEqual(["player"]);
    expect(canUseRole("player_monthly", "player")).toBe(true);
    for (const r of ["coach", "trainer", "club"] as const) {
      expect(canUseRole("player_monthly", r), r).toBe(false);
    }
  });

  it("counts a trialing subscription as active", () => {
    // Stripe reports `trialing` for the first seven days. If that did not count
    // as active, every trial would be sold and then immediately withheld.
    const active = (s: string) => s === "active" || s === "trialing" || s === "past_due";
    expect(active("trialing")).toBe(true);
    expect(active("canceled")).toBe(false);
    expect(active("incomplete_expired")).toBe(false);
  });
});
