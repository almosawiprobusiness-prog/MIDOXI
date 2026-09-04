/*
  The client link, as pure rules.

  Split from `deliverable-links.ts` for the same reason `lib/tactics/compose.ts`
  is split from the board engine: that file imports `server-only` for the
  privileged read, and these rules need to be testable without a server —
  and readable by a client component, which the link panel is.

  The rules themselves come from `lib/reports/share-types.ts`. They are not
  reinvented here, only applied to a different document.
*/

/** Days a link stays live. There is no "never"; see share-types.ts. */
export const DEFAULT_LINK_DAYS = 30;
export const MAX_LINK_DAYS = 180;

export function clampLinkDays(days: number): number {
  if (!Number.isFinite(days) || days <= 0) return DEFAULT_LINK_DAYS;
  return Math.min(Math.round(days), MAX_LINK_DAYS);
}

export function deliverableUrl(origin: string, token: string): string {
  return `${origin.replace(/\/$/, "")}/d/${token}`;
}

export type LinkState = "none" | "live" | "expired" | "revoked";

/**
 * Where a link stands.
 *
 * Withdrawal beats an expiry still in the future: someone who revoked a link
 * meant it, and reporting "live" because there is time left would be wrong in
 * the one direction that matters.
 */
export function linkState(d: {
  shareToken: string | null;
  shareExpiresAt: string | null;
  shareRevokedAt: string | null;
}): LinkState {
  if (!d.shareToken) return "none";
  if (d.shareRevokedAt) return "revoked";
  if (d.shareExpiresAt && new Date(d.shareExpiresAt).getTime() <= Date.now()) return "expired";
  return "live";
}
