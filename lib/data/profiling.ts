import type { ProfileSettings } from "./profile";

/*
  Progressive profiling — asking for one thing, at the moment it matters.

  A twenty-field form at signup is how a product gets a database full of blanks:
  the person filling it in has no idea which fields do anything, so they skip
  the ones that look like admin and abandon the rest. Half of them are the ones
  that make the product work.

  So MIDO asks for one thing at a time, and every ask states **what it unlocks**.
  That is the whole design, and it is the difference between a prompt and a nag:

    "MIDO does not know your position. Without it, study picks and session
     drafts are written for nobody in particular."

  Two rules:

  1. **Never ask for something that does not change what the product does.**
     Every prompt below names a real behaviour that is currently degraded. If a
     field cannot be justified that way, it does not get a prompt — it stays in
     Settings for whoever wants to fill it in.

  2. **One at a time, highest value first, and dismissible.** A stack of prompts
     is a form with extra steps.
*/

export type ProfileField =
  | "primaryPosition"
  | "foot"
  | "club"
  | "level"
  | "dateOfBirth"
  | "playStyle";

export interface ProfilePrompt {
  field: ProfileField;
  /** The question, in plain words. */
  ask: string;
  /** What is worse right now because this is missing. Never generic. */
  unlocks: string;
  /** Where the field is edited. */
  href: string;
  /** Lower is asked first. */
  priority: number;
  /** Suggested values, where the field is a short closed set. */
  options?: string[];
}

const POSITIONS = ["GK", "CB", "FB", "DM", "CM", "AM", "W", "CF"];
const FEET = ["Right", "Left", "Both"];

/**
 * Every prompt MIDO can make, in priority order. The order is by how much the
 * missing field degrades the product, not by how easy it is to answer.
 */
const PROMPTS: (ProfilePrompt & { missing: (p: ProfileSettings) => boolean })[] = [
  {
    field: "primaryPosition",
    ask: "What position do you play?",
    unlocks:
      "Study picks, session drafts and every concept MIDO surfaces are filtered by position. Without it they are written for nobody in particular.",
    href: "/app/settings",
    priority: 0,
    options: POSITIONS,
    missing: (p) => !p.primaryPosition,
  },
  {
    field: "foot",
    ask: "Which foot?",
    unlocks:
      "It changes which side of a movement MIDO suggests you attack, and which finishes are worth studying.",
    href: "/app/settings",
    priority: 1,
    options: FEET,
    missing: (p) => !p.foot,
  },
  {
    field: "level",
    ask: "What level are you playing at?",
    unlocks:
      "A session for an academy U16 and a session for a Sunday league side are not the same session. MIDO currently guesses.",
    href: "/app/settings",
    priority: 2,
    missing: (p) => !p.level,
  },
  {
    field: "club",
    ask: "Which club do you play for?",
    unlocks:
      "Match pages currently say “Your team” instead of your club, and a coach inviting you cannot see who you play for.",
    href: "/app/settings",
    priority: 3,
    missing: (p) => !p.club,
  },
  {
    field: "dateOfBirth",
    ask: "When were you born?",
    unlocks:
      "Age band decides what training load is appropriate. Without it MIDO will not make load recommendations at all.",
    href: "/app/settings",
    priority: 4,
    missing: (p) => !p.dateOfBirth,
  },
  {
    field: "playStyle",
    ask: "How would you describe the way you play?",
    unlocks:
      "In your own words. It is what MIDO reads before it suggests anything, and it is the one thing here nobody else can write for you.",
    href: "/app/settings",
    priority: 5,
    missing: (p) => !p.playStyle,
  },
];

/** Everything still missing, most valuable first. */
export function missingFields(profile: ProfileSettings): ProfilePrompt[] {
  return PROMPTS.filter((p) => p.missing(profile))
    .sort((a, b) => a.priority - b.priority)
    .map((p) => ({
      field: p.field,
      ask: p.ask,
      unlocks: p.unlocks,
      href: p.href,
      priority: p.priority,
      options: p.options,
    }));
}

/**
 * The single thing to ask for next, skipping anything already dismissed.
 * Returns null when there is nothing worth asking — which is the common case
 * for an established account, and the point.
 */
export function nextPrompt(
  profile: ProfileSettings,
  dismissed: ProfileField[] = [],
): ProfilePrompt | null {
  return missingFields(profile).find((p) => !dismissed.includes(p.field)) ?? null;
}

/** How complete the profile is, counting only fields that change behaviour. */
export function completeness(profile: ProfileSettings): { filled: number; of: number } {
  const of = PROMPTS.length;
  return { filled: of - missingFields(profile).length, of };
}
