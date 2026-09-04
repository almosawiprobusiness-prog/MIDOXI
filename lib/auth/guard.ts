import "server-only";
import { redirect } from "next/navigation";
import { getCurrentUser, type CurrentUser } from "./session";
import type { RoleId } from "@/lib/roles/roles";

/*
  Page-level role gating.

  `session.ts` computes `availableRoles` as *entitled ∩ provisioned* and says
  "every role-scoped page reads it". Until this file existed, none did — the
  switcher hid systems an account could not open, and `switchRole` refused to
  change into one, but a page was reachable by typing its URL. Hiding is not
  enforcing; this is where it is enforced for a route.

  TWO DIFFERENT QUESTIONS, AND ONLY ONE OF THEM IS A GATE.

  1. MAY this account open the system? That is entitlement, it is about money
     and access, and getting it wrong hands someone a system they have not
     paid for. `requireRole` redirects.

  2. IS this account currently in that system? That is only context. The
     account is entitled, the data is its own, and a deep link — from a
     notification, an email, a bookmark — should still work. Refusing it would
     be a gate that protects nothing and loses the click, so `viewingFromOtherOs`
     merely reports the mismatch and lets the page say so.
*/

/**
 * Require that this account may open `role`, or send it somewhere it may.
 *
 * Returns the session so the caller does not fetch it twice.
 */
export async function requireRole(role: RoleId): Promise<CurrentUser> {
  const user = await getCurrentUser();

  // The layout already redirects an anonymous visitor; belt and braces, since
  // this function's whole job is to be the thing that does not assume.
  if (!user) redirect("/login");

  if (!user.availableRoles.includes(role)) redirect("/app");

  return user;
}

/**
 * True when the account is entitled to `role` but is working in another system.
 *
 * Not an error — the page renders. It exists so a page that belongs to one
 * operating system can say so, rather than appearing in a shell whose
 * navigation does not contain it, which is how this was noticed.
 */
export function viewingFromOtherOs(user: CurrentUser, role: RoleId): boolean {
  return user.role !== role;
}
