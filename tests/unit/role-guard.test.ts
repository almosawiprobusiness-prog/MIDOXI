import { describe, it, expect } from "vitest";
import { canUseRole, type PlanId } from "../../lib/billing/plans";
import { ROLE_IDS } from "../../lib/roles/roles";

/*
  Page-level role gating.

  `lib/auth/guard.ts` itself imports `server-only` and calls `redirect`, so it
  cannot load here — vitest is unit-only, the same constraint that split
  `lib/tactics/compose.ts` out of the board engine. What IS testable is the
  rule the guard enforces: which plans may open which system. If that is
  right, `requireRole` is a one-line application of it.

  Why this matters more than it looks: until the guard existed, the switcher
  hid systems an account could not open and `switchRole` refused to change
  into one — but a page was reachable by typing its URL. Hiding is not
  enforcing.
*/

describe("what each plan may open", () => {
  /*
    The one that pays for this file. Club OS is the organisation layer and
    lives only on the quoted tier — an `xi` subscriber reaching /app/delivery
    or /app/teams by URL would be using a system they have not bought.
  */
  it("keeps Club OS off every self-serve plan", () => {
    for (const plan of ["free", "xi_monthly", "xi_annual", "player_monthly"] as PlanId[]) {
      expect(canUseRole(plan, "club"), plan).toBe(false);
    }
    expect(canUseRole("managed", "club")).toBe(true);
  });

  it("still honours the retired tier that did include Club", () => {
    // A grandfathered Club subscriber must not lose the system they bought.
    expect(canUseRole("club_monthly", "club")).toBe(true);
    expect(canUseRole("club_annual", "club")).toBe(true);
  });

  it("opens the three individual systems on the paid self-serve tier", () => {
    for (const role of ["player", "coach", "trainer"] as const) {
      expect(canUseRole("xi_monthly", role), role).toBe(true);
    }
  });

  /*
    Free is the one case where the plan names no roles at all: the account
    gets the single system it was provisioned for, chosen from FREE_ROLES.
    Club is not among them, which is what the first test above depends on.
  */
  it("lets a free account open exactly the three individual systems", () => {
    for (const role of ROLE_IDS) {
      expect(canUseRole("free", role), role).toBe(role !== "club");
    }
  });

  it("never opens a system on a cheaper plan that a dearer one closes", () => {
    for (const role of ROLE_IDS) {
      if (canUseRole("free", role)) {
        expect(canUseRole("xi_monthly", role), role).toBe(true);
      }
      if (canUseRole("xi_monthly", role)) {
        expect(canUseRole("managed", role), role).toBe(true);
      }
    }
  });
});
