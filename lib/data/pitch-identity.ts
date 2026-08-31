/*
  Pitch identity — how MIDO finds the player in footage.

  The structured half (kit colours, team side, number, position) is more
  reliable than free text because it cannot forget the one field the model
  needs most; the free note stays for what structure cannot say ("black
  boots", "captain's armband", "usually the highest presser").

  Pure and client-safe: the settings form validates with it and the reader
  composes with it, from one definition.
*/

export interface PitchIdentityParts {
  teamSide?: string | null; // "home" | "away"
  kitPrimary?: string | null; // "royal blue"
  kitSecondary?: string | null; // "white shorts"
  squadNumber?: number | null;
  position?: string | null; // "ST"
  note?: string | null; // the free "how to spot you" line
}

/** A short list keeps the value model-legible; free text invited "our third kit". */
export const KIT_COLORS = [
  "white", "black", "red", "royal blue", "navy", "sky blue", "green",
  "yellow", "orange", "purple", "maroon", "grey", "pink",
] as const;

export function kitColorIssue(v: string): string | null {
  if (!v) return null;
  if (v.length > 24) return "Keep the colour short — 'royal blue', not a description.";
  return null;
}

/**
 * The one string the model sees. Ordered by how strongly each part
 * identifies: side and kit narrow to a team, the number narrows to a player,
 * position and the note help confirm. Returns "" when nothing is set — the
 * caller treats that as identity-not-stated, never as an empty description.
 */
export function composePitchIdentity(p: PitchIdentityParts): string {
  const bits: string[] = [];
  if (p.teamSide === "home" || p.teamSide === "away") bits.push(`${p.teamSide} team`);
  const kit = [p.kitPrimary, p.kitSecondary].filter(Boolean).join(" and ");
  if (kit) bits.push(`${kit} kit`);
  if (p.squadNumber != null) bits.push(`number ${p.squadNumber}`);
  if (p.position) bits.push(`plays ${p.position}`);
  const head = bits.join(", ");
  const note = (p.note ?? "").trim();
  if (head && note) return `${head}. ${note}`;
  return head || note;
}
