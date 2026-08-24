import { describe, it, expect } from "vitest";
import { FREE_ROLES, canUseRole, rolesFor, type PlanId } from "../../lib/billing/plans";
import { ROLE_IDS, type RoleId } from "../../lib/roles/roles";

/*
  The role gate, restated.

  `lib/auth/session.ts` is `server-only`, so the resolution cannot be imported
  here. What is pinned instead is the algorithm it implements — and it is worth
  pinning, because the first version of it shipped a real hole:

    available = entitled.length > 0 ? provisioned ∩ entitled : [storedRole]

  That free branch trusted `profiles.role`. `switchRole` writes exactly that
  column and provisions the matching profile row, so anything able to reach the
  column reached the system. Confirmed live: forcing `role = 'club'` on a free
  account served the whole Club OS.

  The rule now is that no stored value is trusted — a free account gets one
  system and it must be one free is allowed to have.

  The SECOND version then shipped the opposite failure. Keeping the
  `provisioned ∩ entitled` intersection on the paid branch looked conservative
  and was in fact a deadlock: `switchRole` is what creates a role's profile row,
  so a system becomes provisioned only by being entered, and the switcher only
  offers what is available. A Touchline subscriber — entitled to player, coach
  and trainer — could open player and nothing else, silently, having paid for
  three. Found on a real paid account, not in a test.

  Both failures are pinned below, because they pull in opposite directions and
  a fix for either one is a plausible way to reintroduce the other.
*/

function resolve(planId: PlanId, storedRole: RoleId, provisioned: RoleId[]) {
  const entitled = rolesFor(planId);
  const withStored = provisioned.includes(storedRole) ? provisioned : [storedRole, ...provisioned];

  let available: RoleId[];
  if (entitled.length > 0) {
    available = entitled;
  } else {
    const choice = canUseRole(planId, storedRole)
      ? storedRole
      : (withStored.find((r) => canUseRole(planId, r)) ?? FREE_ROLES[0]);
    available = [choice];
  }
  if (available.length === 0) {
    available = [withStored.find((r) => canUseRole(planId, r)) ?? FREE_ROLES[0]];
  }
  const role = available.includes(storedRole) ? storedRole : available[0];
  return { role, available, locked: withStored.filter((r) => !available.includes(r)) };
}

describe("the bypass that shipped", () => {
  it("refuses Club to a free account even when the database says role=club", () => {
    // Exactly the state a successful switchRole('club') would leave behind.
    const r = resolve("free", "club", ["coach", "club"]);
    expect(r.available).not.toContain("club");
    expect(r.role).not.toBe("club");
    expect(r.locked).toContain("club");
  });

  it("falls back to a system free is actually allowed to have", () => {
    expect(resolve("free", "club", ["coach", "club"]).role).toBe("coach");
  });

  it("still gives something when nothing provisioned is eligible", () => {
    const r = resolve("free", "club", ["club"]);
    expect(FREE_ROLES).toContain(r.role);
    expect(r.available).toHaveLength(1);
  });
});

describe("the deadlock that shipped after it", () => {
  /*
    The state of a real paying account: subscribed to Touchline, and never
    having opened anything but Player — so `player_profiles` is the only role
    row that exists.
  */
  const freshTouchline = () => resolve("touchline_monthly", "player", ["player"]);

  it("opens every system Touchline pays for, not just the one already set up", () => {
    const r = freshTouchline();
    expect(r.available).toContain("coach");
    expect(r.available).toContain("trainer");
    expect(r.available).toContain("player");
  });

  it("does not require a profile row to exist before the system can be entered", () => {
    // The row is created BY entering. Requiring it first is the deadlock.
    expect(freshTouchline().available).toEqual(rolesFor("touchline_monthly"));
  });

  it("still withholds Club, which Touchline does not buy", () => {
    const r = freshTouchline();
    expect(r.available).not.toContain("club");
  });

  it("leaves the active system where it was", () => {
    // Widening what is reachable must not move somebody out of Player.
    expect(freshTouchline().role).toBe("player");
  });

  it("opens all four for Club, from a standing start", () => {
    const r = resolve("club_monthly", "player", ["player"]);
    for (const id of ROLE_IDS) expect(r.available, id).toContain(id);
  });

  it("gives a Player subscriber exactly what Player buys", () => {
    // The narrow plan must stay narrow — this is the check that would fail if
    // somebody "fixed" the deadlock by handing out every role.
    expect(resolve("player_monthly", "player", ["player"]).available).toEqual(["player"]);
  });
});

describe("free is one system", () => {
  it("opens exactly one, however many profiles exist", () => {
    // Filling in all four profiles must not buy all four systems.
    const r = resolve("free", "player", ["player", "coach", "trainer", "club"]);
    expect(r.available).toEqual(["player"]);
    expect(r.locked.sort()).toEqual(["club", "coach", "trainer"]);
  });

  it("honours which one they chose", () => {
    for (const choice of FREE_ROLES) {
      expect(resolve("free", choice, ["player", "coach", "trainer"]).available).toEqual([choice]);
    }
  });
});

describe("paid tiers", () => {
  it("opens every provisioned system the plan names", () => {
    const r = resolve("touchline_monthly", "coach", ["player", "coach", "trainer"]);
    expect(r.available.sort()).toEqual(["coach", "player", "trainer"]);
    expect(r.locked).toEqual([]);
  });

  it("locks what the plan does not name, even when provisioned", () => {
    const r = resolve("touchline_monthly", "coach", ["player", "coach", "trainer", "club"]);
    expect(r.available).not.toContain("club");
    expect(r.locked).toEqual(["club"]);
  });

  it("opens everything on Club", () => {
    const r = resolve("club_monthly", "club", [...ROLE_IDS]);
    expect(r.available.sort()).toEqual([...ROLE_IDS].sort());
    expect(r.locked).toEqual([]);
  });

  /*
    This test is where the deadlock hid.

    Its NAME was right — provisioning should not be what entitles you — and its
    assertion said the exact opposite, pinning a Club subscriber to the single
    system they happened to have set up. It passed for months and read, at a
    glance, like the correct behaviour being protected.

    Worth remembering: a green test proves the code does what the ASSERTION
    says, never what the title says.
  */
  it("does not require provisioning to entitle — you just have not set it up yet", () => {
    const r = resolve("club_monthly", "player", ["player"]);
    expect(r.available.sort()).toEqual([...ROLE_IDS].sort());
    expect(r.locked).toEqual([]);
  });
});

describe("a lapsed subscription", () => {
  it("drops a Club user back to one free system rather than stranding them", () => {
    // Was on Club, subscription ended, plan is free again.
    const r = resolve("free", "club", ["player", "coach", "trainer", "club"]);
    expect(r.available).toHaveLength(1);
    expect(FREE_ROLES).toContain(r.available[0]);
    expect(r.role).toBe(r.available[0]);
  });

  it("never returns an active role the account cannot open", () => {
    // The invariant that stops a shell rendering around an unentitled user.
    for (const plan of ["free", "player_monthly", "touchline_monthly", "club_monthly"] as PlanId[]) {
      for (const stored of ROLE_IDS) {
        const r = resolve(plan, stored, [...ROLE_IDS]);
        expect(r.available, `${plan}/${stored}`).toContain(r.role);
        expect(canUseRole(plan, r.role), `${plan}/${stored}`).toBe(true);
      }
    }
  });
});
