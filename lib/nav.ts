/*
  Navigation now resolves from the role registry — see lib/roles/roles.ts.
  This module stays as the import surface the shell already uses.
*/
export type { NavItem, QuickAction } from "@/lib/roles/roles";
export { navForRole, roleDef, sectionTitleFor, ROLES, ROLE_IDS } from "@/lib/roles/roles";

import { ROLES } from "@/lib/roles/roles";

/** Back-compat: the player operating system's navigation. */
export const playerNav = ROLES.player.nav;
