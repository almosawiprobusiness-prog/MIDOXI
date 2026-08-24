import "server-only";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { env, isDemoMode } from "@/lib/env";
import { isRoleId, type RoleId } from "@/lib/roles/roles";
import { getMembership } from "@/lib/billing/membership";
import { canUseRole, rolesFor, FREE_ROLES } from "@/lib/billing/plans";

/** Cookie that carries the active role in demo mode (no DB to write to). */
export const ROLE_COOKIE = "mido_role";

export interface CurrentUser {
  id: string;
  email: string | null;
  /** The operating system currently being used. */
  role: RoleId;
  /**
   * Every role this account may actually open — entitled ∩ provisioned.
   * The role switcher reads this, so it can never offer an unpaid system.
   */
  availableRoles: RoleId[];
  /** Provisioned but not paid for. Shown locked, with the price to unlock. */
  lockedRoles: RoleId[];
  isDemo: boolean;
  isAdmin: boolean;
  onboardingComplete: boolean;
  /** Shell identity. */
  displayName: string;
  /** Second line under the name — position/club, team, organization. */
  identityLine: string;
  /** Small square badge: squad number, initials, or a club mark. */
  badge: string;
}

const DEMO_IDENTITY: Record<RoleId, { displayName: string; identityLine: string; badge: string }> = {
  player: { displayName: "MIDO", identityLine: "CF · Northgate FC", badge: "9" },
  coach: { displayName: "Coach Demo", identityLine: "First team · Northgate FC", badge: "HC" },
  trainer: { displayName: "Perf. Demo", identityLine: "Performance · 6 athletes", badge: "PT" },
  club: { displayName: "Northgate FC", identityLine: "Academy · 4 teams", badge: "NG" },
};

/** Reads the demo/preview role cookie. */
async function cookieRole(): Promise<RoleId | null> {
  try {
    const jar = await cookies();
    const v = jar.get(ROLE_COOKIE)?.value;
    return isRoleId(v) ? v : null;
  } catch {
    return null;
  }
}

/** The demo identity used when no backend is configured. */
export async function demoUser(): Promise<CurrentUser> {
  const role = (await cookieRole()) ?? "player";
  return {
    id: "demo",
    email: "demo@mido.xi",
    role,
    availableRoles: ["player", "coach", "trainer", "club"],
    // Demo has no billing, so nothing is locked — the whole product is on show.
    lockedRoles: [],
    isDemo: true,
    isAdmin: false,
    onboardingComplete: true,
    ...DEMO_IDENTITY[role],
  };
}

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "XI";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/**
 * Resolves the current user for a server context.
 * - Demo mode  -> the seed-backed demo identity, role switchable by cookie.
 * - Real mode  -> the Supabase user + profile, with every provisioned role.
 */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  if (isDemoMode) return demoUser();

  const supabase = await createClient();
  if (!supabase) return demoUser();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [{ data: profile }, { data: pp }, { data: cp }, { data: tp }, { data: clp }] = await Promise.all([
    supabase.from("profiles").select("role, onboarding_complete, full_name, known_as").eq("id", user.id).maybeSingle(),
    supabase.from("player_profiles").select("primary_position, club, squad_number").eq("user_id", user.id).maybeSingle(),
    supabase.from("coach_profiles").select("team, coaching_role, club").eq("user_id", user.id).maybeSingle(),
    supabase.from("trainer_profiles").select("practice, specialism").eq("user_id", user.id).maybeSingle(),
    supabase.from("club_profiles").select("club_name, level").eq("user_id", user.id).maybeSingle(),
  ]);

  // Systems this account has actually set up.
  const provisioned: RoleId[] = [];
  if (pp) provisioned.push("player");
  if (cp) provisioned.push("coach");
  if (tp) provisioned.push("trainer");
  if (clp) provisioned.push("club");

  // What the account has stored as its active system. Not yet trusted.
  const storedRole: RoleId = isRoleId(profile?.role) ? profile.role : "player";
  if (!provisioned.includes(storedRole)) provisioned.unshift(storedRole);

  /*
    The gate, and the only place it is decided. Everything downstream — the
    switcher, the shell, every role-scoped page — reads `availableRoles`.

    The first version of this trusted `profiles.role` on the free branch, which
    was the whole hole: `switchRole` writes that column and provisions the
    matching profile row, so anything that reached the column reached the
    system. Verified by forcing role='club' on a free account and being served
    the Club OS. Nothing here may take a stored value on trust.
  */
  const membership = await getMembership();
  const entitled = rolesFor(membership.planId);

  let available: RoleId[];
  if (entitled.length > 0) {
    /*
      Paid: every system the plan names, whether or not it has been opened yet.

      This used to be `provisioned.filter(...)` — the intersection with the
      systems an account had already set up — and that was a deadlock that cost
      a paying subscriber most of what they bought. `switchRole` is what creates
      a role's profile row, so a system becomes "provisioned" only by being
      entered; and the switcher only offers what is in `available`. Entering
      required provisioning, provisioning required entering. A Touchline
      subscriber, entitled to player, coach and trainer, could reach player and
      nothing else, with no error and no way out — the failure looked exactly
      like the product having no coach system at all.

      Widening this does not widen the hole the comment above describes.
      Provisioning was never the security boundary: `switchRole` re-checks
      `canUseRole(membership.planId, role)` server-side before it writes
      anything, so a client calling it directly with an unentitled role is
      refused there. `entitled` comes from the plan, never from a stored value,
      which is the property that actually matters.
    */
    available = entitled;
  } else {
    /*
      Free: exactly one system, and it must be one free may have. A stored role
      that is not free-eligible — set by a bypass, or left behind by a lapsed
      Club subscription — falls back to a provisioned system that is.
    */
    const choice = canUseRole(membership.planId, storedRole)
      ? storedRole
      : (provisioned.find((r) => canUseRole(membership.planId, r)) ?? FREE_ROLES[0]);
    available = [choice];
  }

  // Never strand an account with no system at all.
  if (available.length === 0) {
    available = [provisioned.find((r) => canUseRole(membership.planId, r)) ?? FREE_ROLES[0]];
  }

  /*
    The active role must be one the account may actually open. Returning a role
    that is not in `available` would render that system's shell around a user
    who is not entitled to it — which is the bug this whole block exists to
    prevent, one level up.
  */
  const role: RoleId = available.includes(storedRole) ? storedRole : available[0];

  const lockedRoles = provisioned.filter((r) => !available.includes(r));

  const name = (profile?.known_as || profile?.full_name || user.email?.split("@")[0] || "Player").trim();

  let identityLine = "";
  let badge = initialsOf(name);
  if (role === "player" && pp) {
    identityLine = [pp.primary_position, pp.club].filter(Boolean).join(" · ");
    if (pp.squad_number) badge = String(pp.squad_number);
  } else if (role === "coach" && cp) {
    identityLine = [cp.coaching_role, cp.team || cp.club].filter(Boolean).join(" · ");
  } else if (role === "trainer" && tp) {
    identityLine = [tp.specialism, tp.practice].filter(Boolean).join(" · ");
  } else if (role === "club" && clp) {
    identityLine = [clp.club_name, clp.level].filter(Boolean).join(" · ");
    badge = initialsOf(clp.club_name || name);
  }

  const email = user.email ?? null;
  return {
    id: user.id,
    email,
    role,
    availableRoles: available,
    lockedRoles,
    isDemo: false,
    isAdmin: email ? env.adminEmails.includes(email.toLowerCase()) : false,
    onboardingComplete: profile?.onboarding_complete ?? false,
    displayName: name,
    identityLine: identityLine || "MIDO XI",
    badge,
  };
}

/** The active role only — cheap helper for data modules. */
export async function getActiveRole(): Promise<RoleId> {
  const user = await getCurrentUser();
  return user?.role ?? "player";
}
