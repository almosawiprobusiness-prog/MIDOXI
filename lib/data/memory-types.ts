import { Brain, Dumbbell, Lock, RotateCcw, Shuffle, MessageSquare, type LucideIcon } from "lucide-react";

/*
  What MIDO remembers, and why each kind exists.

  The kinds are not a taxonomy for its own sake. Each one changes what MIDO
  should SAY, and a kind that does not change anything would be a note rather
  than a memory:

    weakness    keep it on the agenda
    strength    build around it, and stop trying to fix it
    constraint  do not recommend what they cannot do
    tried       do not recommend it a second time
    context     read everything else in light of it
    coach       somebody else's view, kept as theirs

  Client-safe: shapes and labels only.
*/

export type MemoryKind = "weakness" | "strength" | "constraint" | "tried" | "context" | "coach";

export interface Memory {
  id: string;
  kind: MemoryKind;
  body: string;
  concept: string | null;
  /** 'self' = the player wrote it. 'mido' = proposed from the record, confirmed. */
  source: "self" | "mido";
  /** What a proposal was based on, in the player's own data. */
  because: string | null;
  updatedAt: string;
}

export interface MemoryInput {
  kind: MemoryKind;
  body: string;
  concept?: string | null;
  because?: string | null;
  source?: "self" | "mido";
}

export interface KindMeta {
  kind: MemoryKind;
  label: string;
  icon: LucideIcon;
  color: string;
  /** Shown as the placeholder — the shape of a good one. */
  example: string;
  /** What MIDO does differently because of it. The reason the kind exists. */
  effect: string;
}

export const MEMORY_KINDS: KindMeta[] = [
  {
    kind: "weakness",
    label: "Working on",
    icon: Brain,
    color: "var(--signal)",
    example: "First touch under pressure when receiving on the left",
    effect: "Kept on the agenda, and looked for in your film.",
  },
  {
    kind: "strength",
    label: "Strength",
    icon: Dumbbell,
    color: "var(--positive)",
    example: "Timing of runs in behind — consistently early on the shoulder",
    effect: "Built around, rather than treated as something to fix.",
  },
  {
    kind: "constraint",
    label: "Constraint",
    icon: Lock,
    color: "var(--review)",
    example: "Two sessions a week, no gym access, forty minutes' travel",
    effect: "Nothing is suggested that you could not actually do.",
  },
  {
    kind: "tried",
    label: "Already tried",
    icon: RotateCcw,
    color: "var(--info)",
    example: "Did the body-shape rondo for six weeks — it did not transfer to matches",
    effect: "Not recommended to you a second time.",
  },
  {
    kind: "context",
    label: "Context",
    icon: Shuffle,
    color: "#c58bff",
    example: "Moved from 8 to 6 in September, still learning the position",
    effect: "Everything else is read in light of it.",
  },
  {
    kind: "coach",
    label: "From a coach",
    icon: MessageSquare,
    color: "var(--correction)",
    example: "Coach wants me arriving later in the box rather than earlier",
    effect: "Kept as their view, not adopted as MIDO's.",
  },
];

export function memoryMeta(kind: MemoryKind): KindMeta {
  return MEMORY_KINDS.find((k) => k.kind === kind) ?? MEMORY_KINDS[0];
}

export const MEMORY_MIN = 3;
export const MEMORY_MAX = 400;
/**
 * How many are injected into a prompt.
 *
 * Not a storage cap — a player may keep as many as they like. It is a limit on
 * how much MIDO is asked to hold in mind at once, because a system prompt with
 * eighty facts in it produces answers that reference all of them and act on
 * none.
 */
export const MEMORY_PROMPT_LIMIT = 24;

export function memoryIssue(body: string): string | null {
  const t = body.trim();
  if (t.length < MEMORY_MIN) return "Write a little more than that.";
  if (t.length > MEMORY_MAX) {
    return `Keep it to one sentence — ${t.length} characters, and the limit is ${MEMORY_MAX}. Anything longer belongs as a note on a goal.`;
  }
  return null;
}

/**
 * The memories, rendered for a system prompt.
 *
 * Grouped by kind with the effect stated, because a flat list of sentences
 * gives a model no reason to treat "cannot get to a gym" differently from
 * "wants to be better at heading".
 */
export function memoryPromptBlock(memories: Memory[]): string {
  if (memories.length === 0) return "";
  const groups = MEMORY_KINDS.map((k) => ({
    meta: k,
    items: memories.filter((m) => m.kind === k.kind).slice(0, MEMORY_PROMPT_LIMIT),
  })).filter((g) => g.items.length > 0);

  const lines = groups.map((g) => {
    const items = g.items.map((m) => `  - ${m.body}`).join("\n");
    return `${g.meta.label.toUpperCase()} (${g.meta.effect})\n${items}`;
  });

  // The prohibition is only stated when there is something to prohibit.
  // Pointing the model at a section that is not in the prompt wastes a cached
  // token and quietly invites it to imagine one.
  const hasTried = groups.some((g) => g.meta.kind === "tried");
  const rule = hasTried
    ? "These are facts they confirmed, not guesses. Use them. Do not ask about something already here, and never recommend anything listed under ALREADY TRIED."
    : "These are facts they confirmed, not guesses. Use them, and do not ask about something already here.";

  return ["WHAT YOU ALREADY KNOW ABOUT THIS PLAYER.", rule, "", ...lines].join("\n");
}
