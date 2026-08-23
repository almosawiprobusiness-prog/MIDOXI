import type { ReportField } from "./fields";

/*
  Letting a report leave the building.

  Everything MIDO XI has built can currently only be printed. A share link is
  the first time something walks out on its own, and that changes what the
  design has to worry about: the reader is not signed in, is not known, and may
  forward the link to somebody else entirely.

  Three rules follow, and they are all here rather than in the UI so they
  cannot be worked around by a different button:

  1. EVERY LINK EXPIRES. There is no "never" option. A recruitment CV that
     stays live forever is a permanent public record of a fifteen-year-old, and
     "I'll revoke it later" is not a thing anyone does.

  2. THE FIELDS ARE FIXED AT CREATION. The link carries the privacy selection
     that was on screen when it was made. A reader cannot widen it, and a later
     change to the player's defaults cannot widen it retroactively.

  3. THE TOKEN IS THE ONLY CREDENTIAL, so it has to be unguessable and it must
     never appear anywhere it could be logged as content — no names, no dates,
     nothing derived from the player.

  Client-safe: shapes and pure functions.
*/

export type ShareKind = "monthly" | "training" | "film";

export interface ReportShare {
  id: string;
  token: string;
  kind: ShareKind;
  /** The period ("2026-08") or the video id, depending on kind. */
  ref: string;
  fields: ReportField[];
  expiresAt: string;
  revokedAt: string | null;
  views: number;
  lastViewedAt: string | null;
  createdAt: string;
}

export const SHARE_KINDS: { kind: ShareKind; label: string; noun: string }[] = [
  { kind: "monthly", label: "Development report", noun: "development" },
  { kind: "training", label: "Training report", noun: "training" },
  { kind: "film", label: "Film analysis", noun: "film" },
];

export function shareKindLabel(kind: ShareKind): string {
  return SHARE_KINDS.find((k) => k.kind === kind)?.label ?? "Report";
}

/*
  How long a link may live.

  Seven days is the honest default for "I am sending this to my coach now".
  Ninety is the ceiling because a trial CV genuinely needs a season's window,
  and nothing needs longer than that — if it does, the player can make a new
  link, which is a decision rather than a drift.
*/
export const EXPIRY_CHOICES = [
  { days: 7, label: "7 days", hint: "For sending to a coach now" },
  { days: 30, label: "30 days", hint: "For a trial or an application" },
  { days: 90, label: "90 days", hint: "The longest MIDO will keep a link open" },
];

export const MAX_EXPIRY_DAYS = 90;
export const DEFAULT_EXPIRY_DAYS = 7;

export function clampExpiryDays(days: number): number {
  if (!Number.isFinite(days) || days <= 0) return DEFAULT_EXPIRY_DAYS;
  return Math.min(Math.round(days), MAX_EXPIRY_DAYS);
}

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

export type ShareState = "live" | "expired" | "revoked";

export function shareState(share: Pick<ReportShare, "expiresAt" | "revokedAt">, now = new Date()): ShareState {
  if (share.revokedAt) return "revoked";
  return new Date(share.expiresAt).getTime() <= now.getTime() ? "expired" : "live";
}

/** Whether a token may be served. The single gate the public route calls. */
export function isServable(
  share: Pick<ReportShare, "expiresAt" | "revokedAt">,
  now = new Date(),
): boolean {
  return shareState(share, now) === "live";
}

export function expiryLabel(share: Pick<ReportShare, "expiresAt" | "revokedAt">, now = new Date()): string {
  const state = shareState(share, now);
  if (state === "revoked") return "Revoked";
  if (state === "expired") return "Expired";

  const ms = new Date(share.expiresAt).getTime() - now.getTime();
  const days = Math.ceil(ms / 86_400_000);
  if (days <= 1) return "Expires today";
  return `Expires in ${days} days`;
}

/** The full address, for copying. */
export function shareUrl(origin: string, token: string): string {
  return `${origin.replace(/\/$/, "")}/r/${token}`;
}

/**
 * What a reader will actually be shown, in plain words.
 *
 * Printed on the share dialog before the link exists, because "field-level
 * privacy control" means nothing to somebody about to send their kid's
 * development report to a stranger.
 */
export function shareDisclosure(fields: ReportField[], sensitiveLabels: string[]): string {
  if (sensitiveLabels.length === 0) {
    return "They will see your football and nothing personal — no date of birth, no measurements, no contact details.";
  }
  return `They will also see: ${sensitiveLabels.join(", ").toLowerCase()}. Anyone with the link can see it.`;
}
