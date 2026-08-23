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
*/

function resolve(planId: PlanId, storedRole: RoleId, provisioned: RoleId[]) {
  const entitled = rolesFor(planId);
  const withStored = provisioned.includes(storedRole) ? provisioned : [storedRole, ...provisioned];

  let available: RoleId[];
  if (entitled.length > 0) {
    available = withStored.filter((r) => entitled.includes(r));
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

  it("does not require provisioning to entitle — you just have not set it up yet", () => {
    const r = resolve("club_monthly", "player", ["player"]);
    expect(r.available).toEqual(["player"]);
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
