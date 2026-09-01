import type { RoleId } from "@/lib/roles/roles";

/*
  What MIDO can build — the canonical list. Client-safe.

  This exists because "the AI can build anything football-wise" is not a claim
  software can honour, and pretending otherwise is how a product ends up with a
  chat box that produces confident nonsense for anything outside its reach.

  So the reach is written down. Every entry names a builder that genuinely
  exists in this codebase, the route that runs it, what it needs before it can
  run, and whether it costs anything. Anything not on this list is answered by
  `LIMITS` — an explicit "no, and here is why" — instead of being silently
  dropped or improvised.

  Adding a builder means adding it here. A capability with no route is a lie the
  tests will catch.
*/

/** Whether a builder costs the user anything to run. */
export type BuildPath =
  /** Rules and curated football knowledge. Free, instant, no tokens. */
  | "deterministic"
  /** Claude. Metered against the plan. */
  | "ai"
  /** A free draft, which Claude will deepen on request. */
  | "both";

export interface Capability {
  id: string;
  /** What a football person would call the thing. */
  builds: string;
  /** One line on what comes out. */
  produces: string;
  href: string;
  roles: RoleId[];
  path: BuildPath;
  /** What must exist before this can run. Empty means it works from nothing. */
  needs: string[];
  /** How someone would ask for it. */
  match: RegExp;
  example: string;
}

export const CAPABILITIES: Capability[] = [
  {
    id: "session",
    builds: "A training session",
    produces: "A warm-up, main blocks and a finish, with coaching points and timings.",
    href: "/app/sessions",
    roles: ["coach", "trainer", "club"],
    path: "both",
    needs: ["A theme, or a squad to build it for"],
    match: /\b(session|drill|practice|training\s+plan|rondo|warm[-\s]?up)\b/i,
    example: "Build a pressing session for Tuesday",
  },
  {
    id: "match-plan",
    builds: "A match plan",
    produces: "How to attack, defend and manage the game against one opponent.",
    href: "/app/opposition",
    roles: ["coach", "club"],
    path: "ai",
    needs: ["An opposition report with something actually written in it"],
    match: /\b(match\s*plan|game\s*plan|how\s+(do\s+)?(we|i)\s+(beat|play\s+against)|prepare\s+for)\b/i,
    example: "How do we beat a team that presses high?",
  },
  {
    id: "tactical-board",
    builds: "A tactical board",
    produces: "Players, movements and space drawn on a pitch — then editable, and attachable to a session, a goal or a player.",
    href: "/app/tactics",
    roles: ["player", "coach", "trainer", "club"],
    /*
      `both` is exact here rather than generous. Without an allowance
      MIDO still returns a real starting shape to draw on, and says that
      is what it did; with one it draws the idea.
    */
    path: "both",
    needs: [],
    match: /\b(tactical\s*board|draw\s+(me\s+)?(a|the)\s+\w+|board\s+(for|showing)|diagram|illustrate|whiteboard)\b/i,
    example: "Draw a 4v4+3 for playing through midfield",
  },
  {
    id: "opposition",
    builds: "An opposition report",
    produces: "Shape, threats, weaknesses and set-piece habits, in your own words.",
    href: "/app/opposition",
    roles: ["coach", "club"],
    path: "deterministic",
    needs: [],
    match: /\b(opposition|scout(ing)?\s*report|oppo|scout\s+them)\b/i,
    example: "Start an opposition report on Saturday's away game",
  },
  {
    id: "program",
    builds: "A physical programme",
    produces: "Weeks of progressive work built on the qualities you selected.",
    href: "/app/programs",
    roles: ["trainer", "club"],
    path: "both",
    needs: ["An athlete, and the qualities you want to develop"],
    match: /\b(program(me)?|block|periodis|periodiz|strength\s+plan|gym\s+plan|pre[-\s]?season)\b/i,
    example: "Build a six-week speed block",
  },
  {
    id: "assessment",
    builds: "An assessment",
    produces: "A test protocol and a place to record the result over time.",
    href: "/app/assessments",
    roles: ["trainer", "club"],
    path: "deterministic",
    needs: ["An athlete"],
    match: /\b(assess(ment)?|\w+\s+test\b|test\s+(battery|protocol|day)|retest|benchmark)\b/i,
    example: "Set up a jump test for the squad",
  },
  {
    id: "study",
    builds: "A study",
    produces: "Study, understand, train, apply and review — built around one player, coach or idea.",
    href: "/app/study",
    roles: ["player", "coach", "trainer", "club"],
    path: "both",
    needs: [],
    match: /\b(study|learn|understand|teach\s+me|break\s+down|analyse|analyze)\b/i,
    example: "Study Harry Kane",
  },
  {
    id: "study-picks",
    builds: "Film worth studying",
    produces: "Four to six pieces of film chosen for your position and goals, each with a reason.",
    href: "/app/film-room",
    roles: ["player", "coach"],
    path: "ai",
    needs: ["A position, and at least one development goal"],
    match: /\b(what\s+should\s+i\s+watch|find\s+(me\s+)?film|recommend|study\s+picks|footage\s+on)\b/i,
    example: "What should I watch this week?",
  },
  {
    id: "frame-read",
    builds: "A read of a piece of film",
    produces: "Timestamped observations from sampled frames, mapped to football ideas.",
    href: "/app/film-room",
    roles: ["player", "coach", "trainer"],
    path: "ai",
    needs: ["Film whose host allows its frames to be read"],
    match: /\b(frame|(read|analyse|analyze|watch)\s+(this\s+|the\s+)?(clip|video|film)|what\s+happens\s+(here|at))\b/i,
    example: "Read this clip between 0:12 and 0:20",
  },
  {
    id: "development",
    builds: "A development plan",
    produces: "Goals with evidence attached, so progress is shown rather than asserted.",
    href: "/app/development",
    roles: ["player", "coach", "club"],
    path: "both",
    needs: [],
    match: /\b(develop(ment)?\s*(plan|map)?|improve|work(ing)?\s+on|get\s+better|weakness|goal)\b/i,
    example: "What should I be working on?",
  },
  {
    id: "tactics",
    builds: "A tactical board",
    produces: "A shape and movements you can draw, save and show a squad.",
    href: "/app/tactics",
    roles: ["coach", "club"],
    path: "deterministic",
    needs: [],
    match: /\b(tactic|shape|formation|board|4-?3-?3|3-?5-?2|build[-\s]?up\s+pattern)\b/i,
    example: "Set up a 4-3-3 build-up shape",
  },
  {
    id: "methodology",
    builds: "A club methodology",
    produces: "The playing identity, training principles and development model, written once.",
    href: "/app/methodology",
    roles: ["club"],
    path: "both",
    needs: [],
    match: /\b(methodology|playing\s+identity|club\s+philosophy|dna|curriculum)\b/i,
    example: "Write our playing identity",
  },
];

/*
  What MIDO is asked for and cannot build. Each of these is a real request a
  football person makes, and each has a real reason it is out of reach — a
  missing data source, a missing integration, or a judgement that belongs to a
  qualified human and not to software.

  Answering "no, because…" is worth far more than answering confidently and
  being wrong, and it is the only honest way to hold a claim as broad as "MIDO
  builds football things".
*/
export interface Limit {
  asked: string;
  why: string;
  /** What would make it possible, when anything would. */
  wouldNeed: string | null;
  match: RegExp;
}

export const LIMITS: Limit[] = [
  {
    asked: "Distances, speeds, sprint counts or heat maps",
    why: "MIDO reads sampled frames. Frames show what happened; they do not measure it.",
    wouldNeed: "A tracking vendor — a camera system or a licensed data feed.",
    match: /\b(distance|km|sprint\s+count|top\s+speed|heat\s?map|xg|expected\s+goals|possession\s+%|tracking\s+data)\b/i,
  },
  {
    asked: "Real fixtures, results or league tables",
    why: "MIDO has no fixture feed. Everything in your match log is what you or your coach entered.",
    wouldNeed: "A licensed fixtures and results provider.",
    match: /\b(fixture\s+list|league\s+table|standings|who\s+do\s+we\s+play|next\s+opponent'?s\s+results)\b/i,
  },
  {
    asked: "Statistics about professional players",
    why: "The curated library holds how a player plays, not their season numbers. Numbers MIDO cannot verify are numbers MIDO does not state.",
    wouldNeed: "A licensed statistics provider.",
    match: /\b(how\s+many\s+goals|stats?\s+(for|on)\s+|assists\s+(last|this)\s+season|career\s+(goals|stats))\b/i,
  },
  {
    asked: "Injury diagnosis, or clearing someone to play",
    why: "That is a medical judgement. Software that guesses at it is dangerous, not helpful.",
    wouldNeed: null,
    match: /\b(injur(y|ed)|diagnos|torn|strain|acl|hamstring\s+(tear|pull)|am\s+i\s+fit|cleared\s+to\s+play|return\s+to\s+play)\b/i,
  },
  {
    asked: "Nutrition or supplement prescriptions",
    why: "Dosing and diet plans belong to a qualified practitioner who knows the person.",
    wouldNeed: null,
    match: /\b(diet|nutrition|meal\s+plan|supplement|creatine|protein\s+intake|how\s+many\s+calories)\b/i,
  },
  {
    asked: "A judgement on whether someone will make it professionally",
    why: "Nobody can tell you that, and a system that pretends to would be shaping a young player's life on a guess.",
    wouldNeed: null,
    match: /\b(will\s+i\s+(make\s+it|go\s+pro|get\s+signed)|good\s+enough\s+(for|to)\s+(pro|academy)|scouted)\b/i,
  },
];

// ---------------------------------------------------------------------------
// Routing
// ---------------------------------------------------------------------------

/** The best builder for a request, preferring one this role actually owns. */
export function findCapability(input: string, role: RoleId): Capability | null {
  const hits = CAPABILITIES.filter((c) => c.match.test(input));
  if (hits.length === 0) return null;
  return hits.find((c) => c.roles.includes(role)) ?? hits[0];
}

/** A reason MIDO cannot do this, when there is one. Checked before building. */
export function findLimit(input: string): Limit | null {
  return LIMITS.find((l) => l.match.test(input)) ?? null;
}

/** What this role can build, for an honest "here is what I can do" answer. */
export function capabilitiesFor(role: RoleId): Capability[] {
  return CAPABILITIES.filter((c) => c.roles.includes(role));
}

/** The builders that cost nothing to run — the free half of the product. */
export function freeCapabilities(role: RoleId): Capability[] {
  return capabilitiesFor(role).filter((c) => c.path !== "ai");
}
