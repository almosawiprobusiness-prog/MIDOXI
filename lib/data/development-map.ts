import type { DevelopmentCategory, DevelopmentGoal } from "@/lib/types";
import { CATEGORIES } from "./development-types";

/*
  The Development Map — current → target → gap, across the five parts of the game.

  The obvious way to build this is the wrong way. A map that showed "Technical:
  current 6/10, target 8/10" would be inventing two numbers nobody produced:
  MIDO does not assess players, has no scout, and holds no rating. Those bars
  would be exactly the invented attribute ratings that came off the profile page.

  So each term is redefined as something that already exists in the user's own
  record:

    current  — what the evidence says. Progress across this category's goals,
               which moves only when evidence is attached to them.
    target   — the goals the player set. The target IS the goal; nobody else
               gets to decide what a player is aiming at.
    gap      — what is between the two, said concretely: which goals are still
               open, and what kind of evidence they are short of.

  The most useful thing the map does is not per-category progress at all. It is
  **coverage**: showing which parts of the game a player is working on and which
  they are ignoring entirely. That is a genuine insight, it comes from real
  data, and no number had to be made up to produce it.
*/

export const CATEGORY_META: Record<
  DevelopmentCategory,
  { label: string; blurb: string; color: string }
> = {
  technical: {
    label: "Technical",
    blurb: "What you can do with the ball.",
    color: "var(--signal)",
  },
  tactical: {
    label: "Tactical",
    blurb: "What you understand about the game.",
    color: "var(--signal-bright)",
  },
  physical: {
    label: "Physical",
    blurb: "What your body lets you do.",
    color: "var(--positive)",
  },
  mental: {
    label: "Mental",
    blurb: "How you handle the moments that decide games.",
    color: "var(--review)",
  },
  positional: {
    label: "Positional",
    blurb: "The specific demands of where you play.",
    color: "var(--info)",
  },
};

/** The four kinds of evidence a goal can be moved by. */
export const EVIDENCE_KINDS = ["clips", "training", "study", "coachNotes"] as const;
export type EvidenceKind = (typeof EVIDENCE_KINDS)[number];

export const EVIDENCE_LABEL: Record<EvidenceKind, string> = {
  clips: "film",
  training: "training",
  study: "study",
  coachNotes: "coach input",
};

export interface CategoryRow {
  category: DevelopmentCategory;
  /** Goals set in this category — the targets. */
  goals: DevelopmentGoal[];
  open: DevelopmentGoal[];
  achieved: DevelopmentGoal[];
  /** Mean progress across this category's goals, 0–100. Null when none set. */
  progress: number | null;
  evidence: number;
  /** Evidence kinds no goal in this category has any of. */
  missingEvidence: EvidenceKind[];
  /** One sentence naming what stands between current and target. */
  gap: string;
}

export interface DevelopmentMap {
  rows: CategoryRow[];
  /** Categories with at least one goal, out of five. */
  covered: number;
  /** Categories with nothing set. The map's real finding. */
  untouched: DevelopmentCategory[];
  totalGoals: number;
  totalEvidence: number;
}

function evidenceTotal(g: DevelopmentGoal): number {
  const e = g.evidence;
  return e.clips + e.training + e.study + e.coachNotes + (e.matches ?? 0);
}

/**
 * What is missing, said in terms of the thing the player would actually do
 * next — not a percentage, and never a judgement about ability.
 */
function gapFor(row: Omit<CategoryRow, "gap">): string {
  const { category, goals, open, achieved, evidence, missingEvidence, progress } = row;

  if (goals.length === 0) {
    return `Nothing set in ${CATEGORY_META[category].label.toLowerCase()}. Either it is not a priority right now, or it is the part of your game nobody is looking at.`;
  }
  if (open.length === 0) {
    return `All ${achieved.length} ${achieved.length === 1 ? "goal" : "goals"} here achieved. Worth setting the next one before this area goes quiet.`;
  }
  if (evidence === 0) {
    return `${open.length} open, and no evidence attached to any of them. Progress here will not move until you attach something.`;
  }
  if (missingEvidence.length > 0) {
    const names = missingEvidence.map((k) => EVIDENCE_LABEL[k]);
    const list =
      names.length === 1
        ? names[0]
        : `${names.slice(0, -1).join(", ")} or ${names[names.length - 1]}`;
    return `${open.length} open at ${progress}%. Nothing here is backed by ${list} yet — that is the fastest thing to change.`;
  }
  return `${open.length} open at ${progress}%, with ${evidence} ${evidence === 1 ? "piece" : "pieces"} of evidence behind them. Keep attaching.`;
}

export function buildDevelopmentMap(goals: DevelopmentGoal[]): DevelopmentMap {
  const rows: CategoryRow[] = CATEGORIES.map((category) => {
    const mine = goals.filter((g) => g.category === category);
    const open = mine.filter((g) => g.status !== "achieved");
    const achieved = mine.filter((g) => g.status === "achieved");
    const evidence = mine.reduce((n, g) => n + evidenceTotal(g), 0);

    const missingEvidence = EVIDENCE_KINDS.filter(
      (kind) => mine.length > 0 && mine.every((g) => g.evidence[kind] === 0),
    );

    const base = {
      category,
      goals: mine,
      open,
      achieved,
      progress: mine.length
        ? Math.round(mine.reduce((n, g) => n + g.progress, 0) / mine.length)
        : null,
      evidence,
      missingEvidence,
    };
    return { ...base, gap: gapFor(base) };
  });

  const untouched = rows.filter((r) => r.goals.length === 0).map((r) => r.category);

  return {
    rows,
    covered: CATEGORIES.length - untouched.length,
    untouched,
    totalGoals: goals.length,
    totalEvidence: goals.reduce((n, g) => n + evidenceTotal(g), 0),
  };
}

/**
 * The one line worth putting at the top. Deliberately an observation about the
 * player's *record*, never about the player.
 */
export function mapHeadline(map: DevelopmentMap): string {
  if (map.totalGoals === 0) {
    return "Nothing set yet. The map fills in as you decide what you are working on.";
  }
  if (map.untouched.length === 0) {
    return `All five areas have something set, across ${map.totalGoals} ${map.totalGoals === 1 ? "goal" : "goals"}. That is unusually broad — check none of it is going stale.`;
  }
  if (map.covered === 1) {
    const only = map.rows.find((r) => r.goals.length > 0);
    return `Everything you are working on is ${CATEGORY_META[only!.category].label.toLowerCase()}. Narrow is not wrong, but it is worth being a choice rather than an accident.`;
  }
  const names = map.untouched.map((c) => CATEGORY_META[c].label.toLowerCase());
  const list =
    names.length === 1 ? names[0] : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
  return `${map.covered} of 5 areas have goals set. Nothing in ${list} — worth knowing whether that is deliberate.`;
}
