/*
  Connections — shared shapes. Client-safe.

  A connection is a link between a person's own MIDO XI account and a record
  someone else keeps about them: a coach's squad row, a trainer's roster row, a
  club's staff row. The person linked decides what it shares.
*/

export type LinkKind = "coach-player" | "trainer-athlete" | "club-staff";

/** What a linked professional can see. The player picks this, not the coach. */
export type ShareScope = "identity" | "development" | "full";

export const SHARE_SCOPES: {
  value: ShareScope;
  label: string;
  summary: string;
  /** Exactly what this opens, in the order the database grants it. */
  opens: string[];
  color: string;
}[] = [
  {
    value: "identity",
    label: "Identity only",
    summary: "They see who you are, nothing else.",
    opens: ["Your name and position", "The notes they write about you"],
    color: "var(--text-dim)",
  },
  {
    value: "development",
    label: "Development",
    summary: "They see what you are working on and how you have played.",
    opens: ["Everything in identity", "Your development goals", "Your match log"],
    color: "var(--signal-bright)",
  },
  {
    value: "full",
    label: "Full",
    summary: "They also see your daily check-ins, so readiness is real rather than guessed.",
    opens: ["Everything in development", "Your daily check-ins and readiness"],
    color: "var(--positive)",
  },
];

export function scopeMeta(scope: ShareScope) {
  return SHARE_SCOPES.find((s) => s.value === scope) ?? SHARE_SCOPES[0];
}

export const LINK_KINDS: Record<LinkKind, { label: string; theirRole: string; yourRole: string }> = {
  "coach-player": { label: "Coach", theirRole: "coach", yourRole: "player" },
  "trainer-athlete": { label: "Trainer", theirRole: "trainer", yourRole: "athlete" },
  "club-staff": { label: "Club", theirRole: "club", yourRole: "staff member" },
};

export type InviteStatus = "open" | "accepted" | "revoked" | "expired";

export interface Invite {
  id: string;
  code: string;
  kind: LinkKind;
  label: string;
  issuerLabel: string;
  status: InviteStatus;
  expiresAt: string;
  createdAt: string;
}

export interface InvitePreview {
  kind: LinkKind;
  label: string;
  issuerLabel: string;
  status: InviteStatus;
  expiresAt: string;
}

/** A link as the linked person sees it — the "who can see me" list. */
export interface Connection {
  id: string;
  kind: LinkKind;
  /** Who holds this record: the coach's team, the trainer's practice, the club. */
  holder: string;
  /** How they have you recorded. */
  label: string;
  scope: ShareScope | null;
  createdAt: string;
}

/** Codes read aloud and typed on a phone: no O/0, no I/1. */
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function generateCode(random: () => number = Math.random): string {
  let out = "";
  for (let i = 0; i < 8; i++) {
    if (i === 4) out += "-";
    out += ALPHABET[Math.floor(random() * ALPHABET.length)];
  }
  return out;
}

export function normaliseCode(code: string): string {
  return code.trim().toUpperCase();
}

/** Days left on an invite, floored at zero. */
export function daysLeft(expiresAt: string): number {
  const ms = new Date(expiresAt).getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / 864e5));
}

export function inviteIsUsable(invite: { status: InviteStatus; expiresAt: string }): boolean {
  return invite.status === "open" && daysLeft(invite.expiresAt) > 0;
}
