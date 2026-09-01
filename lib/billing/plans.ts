import type { RoleId } from "@/lib/roles/roles";

/*
  Plan catalogue — client-safe.

  MIDO XI is four operating systems over one engine, so the plans are shaped by
  **who you are**, not by which features got bundled together. A club paying the
  same as a fifteen-year-old is wrong in both directions.

    Free       one system, your choice, forever. Core tools, no AI.
    Player     the Player OS + the AI analyst.
    Touchline  Player + Coach + Trainer. The professional tier.
    Club       all four, plus staff seats and the methodology engine.

  Two things this file decides that nothing else may override:

  1. **Which systems a plan unlocks** (`roles`). Enforced in `lib/auth/session.ts`,
     where a user's available roles become *entitled ∩ provisioned* — so the
     switcher cannot offer a system the account has not paid for.

  2. **How much metered AI it includes** (`entitlements`). Free is genuinely
     zero: the free tier is the whole deterministic product, and every AI path
     says so honestly rather than teasing.

  The DB `subscription_plans` row stays authoritative at runtime; this drives
  presentation and the shared shapes.
*/

export type Tier =
  | "free"
  | "player"
  /*
    LEGACY. Touchline used to be one $29 tier granting Player + Coach +
    Trainer together. It was split into the two tiers below, because a coach
    was paying for trainer tooling they never opened and vice versa. It is no
    longer sold — no TIER_CARDS entry, excluded from `cheapestPlanFor` — and
    survives only so the accounts that bought it keep exactly what they paid
    for. Someone who genuinely needs both systems buys Club.
  */
  | "touchline"
  | "touchline_coach"
  | "touchline_trainer"
  | "club";

export type PlanId =
  | "free"
  | "player_monthly" | "player_annual"
  | "touchline_monthly" | "touchline_annual"
  | "touchline_coach_monthly" | "touchline_coach_annual"
  | "touchline_trainer_monthly" | "touchline_trainer_annual"
  | "club_monthly" | "club_annual";

export type BillingInterval = "month" | "year";

/** Metered AI features. Keys match `usage_periods.counters` and entitlements. */
/*
  Metered AI features.

  Every name here must be consumed by a real code path. `weekly_reviews` used to
  be on this list and in all three paid tiers at 4 / 8 / 20 — advertised on the
  pricing page, metered on the membership page, and produced by nothing. A limit
  with no feature behind it is a sale of something that does not exist, and it
  is the easiest kind of fiction to ship because nothing errors.

  `tests/unit/ai-limits.test.ts` fails if a plan sells a feature nothing
  consumes.
*/
export type MeteredFeature =
  | "ai_interactions"
  | "deep_analyses"
  | "study_discoveries";

export type Entitlements = Partial<Record<MeteredFeature, number>>;

export interface PlanDef {
  id: PlanId;
  tier: Tier;
  name: string;
  priceCents: number;
  interval: BillingInterval | null;
  entitlements: Entitlements;
  /**
   * Systems this plan unlocks. Empty on free, which is special-cased: a free
   * account gets exactly the one system it is provisioned for.
   */
  roles: RoleId[];
  /** Staff who can be attached to the organization. 1 = just the account. */
  seats: number;
  /**
   * Grandfathered, not sold. Kept so existing subscribers keep what they
   * bought; hidden from the pricing page and never offered as an upgrade.
   */
  legacy?: boolean;
}

/** Days of full access before the first charge. Card required. */
export const TRIAL_DAYS = 7;

const PLAYER_AI: Entitlements = {
  ai_interactions: 150,
  deep_analyses: 20,
  study_discoveries: 30,
};

const TOUCHLINE_AI: Entitlements = {
  ai_interactions: 400,
  deep_analyses: 60,
  study_discoveries: 80,
};

const CLUB_AI: Entitlements = {
  ai_interactions: 1500,
  deep_analyses: 200,
  study_discoveries: 250,
};

/* The retired bundle. Only grandfathered plans still name it. */
const TOUCHLINE_ROLES: RoleId[] = ["player", "coach", "trainer"];
/*
  Each professional tier carries Player with it on purpose: a coach who cannot
  see the player-side record is reading half the picture, and the person
  running sessions is very often still playing.
*/
const COACH_ROLES: RoleId[] = ["player", "coach"];
const TRAINER_ROLES: RoleId[] = ["player", "trainer"];
const CLUB_ROLES: RoleId[] = ["player", "coach", "trainer", "club"];

export const PLANS: Record<PlanId, PlanDef> = {
  free:               { id: "free",               tier: "free",      name: "MIDO XI",            priceCents: 0,      interval: null,    entitlements: {},            roles: [],              seats: 1 },
  player_monthly:     { id: "player_monthly",     tier: "player",    name: "MIDO XI Player",     priceCents: 999,    interval: "month", entitlements: PLAYER_AI,     roles: ["player"],      seats: 1 },
  player_annual:      { id: "player_annual",      tier: "player",    name: "MIDO XI Player",     priceCents: 8900,   interval: "year",  entitlements: PLAYER_AI,     roles: ["player"],      seats: 1 },
  // Grandfathered — see the Tier union. Not buyable; still honoured.
  touchline_monthly:  { id: "touchline_monthly",  tier: "touchline", name: "MIDO XI Touchline",  priceCents: 2900,   interval: "month", entitlements: TOUCHLINE_AI,  roles: TOUCHLINE_ROLES, seats: 1, legacy: true },
  touchline_annual:   { id: "touchline_annual",   tier: "touchline", name: "MIDO XI Touchline",  priceCents: 27900,  interval: "year",  entitlements: TOUCHLINE_AI,  roles: TOUCHLINE_ROLES, seats: 1, legacy: true },

  touchline_coach_monthly:    { id: "touchline_coach_monthly",    tier: "touchline_coach",   name: "MIDO XI Touchline Coach",   priceCents: 2900,  interval: "month", entitlements: TOUCHLINE_AI, roles: COACH_ROLES,   seats: 1 },
  touchline_coach_annual:     { id: "touchline_coach_annual",     tier: "touchline_coach",   name: "MIDO XI Touchline Coach",   priceCents: 27900, interval: "year",  entitlements: TOUCHLINE_AI, roles: COACH_ROLES,   seats: 1 },
  touchline_trainer_monthly:  { id: "touchline_trainer_monthly",  tier: "touchline_trainer", name: "MIDO XI Touchline Trainer", priceCents: 2900,  interval: "month", entitlements: TOUCHLINE_AI, roles: TRAINER_ROLES, seats: 1 },
  touchline_trainer_annual:   { id: "touchline_trainer_annual",   tier: "touchline_trainer", name: "MIDO XI Touchline Trainer", priceCents: 27900, interval: "year",  entitlements: TOUCHLINE_AI, roles: TRAINER_ROLES, seats: 1 },
  club_monthly:       { id: "club_monthly",       tier: "club",      name: "MIDO XI Club",       priceCents: 14900,  interval: "month", entitlements: CLUB_AI,       roles: CLUB_ROLES,      seats: 10 },
  club_annual:        { id: "club_annual",        tier: "club",      name: "MIDO XI Club",       priceCents: 149000, interval: "year",  entitlements: CLUB_AI,       roles: CLUB_ROLES,      seats: 10 },
};

// ---------------------------------------------------------------------------
// Presentation
// ---------------------------------------------------------------------------

export interface TierCard {
  tier: Tier;
  name: string;
  tagline: string;
  monthlyId?: PlanId;
  annualId?: PlanId;
  monthlyCents: number;
  annualCents: number;
  /** What you get. Written as what it does, not as feature names. */
  perks: string[];
  /** The systems this opens, for the little OS row on the card. */
  systems: string;
  popular?: boolean;
  /** Shown when the tier offers a trial. */
  trialDays?: number;
}

export const TIER_CARDS: TierCard[] = [
  {
    tier: "free",
    name: "MIDO XI",
    tagline: "One system, yours, forever. The whole football loop — you just do the thinking.",
    monthlyCents: 0,
    annualCents: 0,
    systems: "Pick one — Player, Coach or Trainer",
    perks: [
      "Every tool in the system you choose",
      "Matches, film, training, development, study",
      "The curated football library, in full",
      "Your data exports whenever you want it",
    ],
  },
  {
    tier: "player",
    name: "Player",
    tagline: "Your private development team. The analyst that reads your game with you.",
    monthlyId: "player_monthly",
    annualId: "player_annual",
    monthlyCents: 999,
    annualCents: 8900,
    trialDays: TRIAL_DAYS,
    systems: "Player OS",
    perks: [
      "Everything in Free",
      "AI study built around your position and goals",
      "MIDO reads your own film and tells you what it sees",
      "Your record kept — timeline, evidence, and a monthly report for your coach",
      "Ask MIDO anything, in your own words",
    ],
  },
  /*
    The two halves of the old Touchline, at the same price. Splitting them is
    not a price rise dressed up as choice: it is the same $29 for the systems
    you actually work in. A coach was paying for programme-writing tools they
    never opened, and a trainer for opposition planning they never used.
  */
  {
    tier: "touchline_coach",
    name: "Touchline Coach",
    tagline: "For the people who pick the team. Your coaching week, and the player you still are.",
    monthlyId: "touchline_coach_monthly",
    annualId: "touchline_coach_annual",
    monthlyCents: 2900,
    annualCents: 27900,
    trialDays: TRIAL_DAYS,
    systems: "Player + Coach",
    popular: true,
    perks: [
      "Two operating systems, one login",
      "Sessions drafted from your objective, editable block by block",
      "Match plans written from your own opposition notes",
      "Squad development tracked across the group",
      "Everything in Player",
    ],
  },
  {
    tier: "touchline_trainer",
    name: "Touchline Trainer",
    tagline: "For the people who build the body. Your programmes, and the player you still are.",
    monthlyId: "touchline_trainer_monthly",
    annualId: "touchline_trainer_annual",
    monthlyCents: 2900,
    annualCents: 27900,
    trialDays: TRIAL_DAYS,
    systems: "Player + Trainer",
    perks: [
      "Two operating systems, one login",
      "Physical programmes with waved weeks and a real retest",
      "Load and readiness read across everyone you train",
      "Sessions drafted from the athlete's own record",
      "Everything in Player",
    ],
  },
  {
    tier: "club",
    name: "Club",
    tagline: "The intelligence layer across the organization — and the methodology every coach writes inside.",
    monthlyId: "club_monthly",
    annualId: "club_annual",
    monthlyCents: 14900,
    annualCents: 149000,
    systems: "All four",
    perks: [
      "All four operating systems",
      "10 staff seats, unlimited teams",
      "Write the club methodology once — every coach's session is drafted inside it",
      "Development trends across age groups",
      "High-volume AI for the whole staff",
    ],
  },
];

/** Human labels for metered features, in display order. */
export const FEATURE_LABELS: { key: MeteredFeature; label: string; hint: string }[] = [
  { key: "study_discoveries", label: "AI study picks", hint: "Personalised film for your position & goals" },
  { key: "deep_analyses", label: "Film reads", hint: "MIDO watches a clip and tells you what it sees" },
  { key: "ai_interactions", label: "AI conversations", hint: "Ask your analyst anything" },
];

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export function tierOf(id: PlanId): Tier {
  return PLANS[id]?.tier ?? "free";
}

/** True for any paid tier. */
export function isPaidPlan(id: PlanId): boolean {
  return tierOf(id) !== "free";
}
/** Back-compat alias — "Pro" historically meant "any paid plan". */
export const isProPlan = isPaidPlan;

export function tierLabel(tier: Tier): string {
  if (tier === "club") return "Club";
  if (tier === "touchline_coach") return "Touchline Coach";
  if (tier === "touchline_trainer") return "Touchline Trainer";
  if (tier === "touchline") return "Touchline";
  if (tier === "player") return "Player";
  return "Free";
}

/**
 * A month of this tier, in cents, at its own monthly price.
 *
 * Read from PLANS rather than TIER_CARDS so it still answers for a
 * grandfathered tier that no longer has a card — the referral joiner credit
 * asks this question, and a legacy subscriber converting must not silently
 * be credited zero.
 */
export function monthlyCentsForTier(tier: Tier): number {
  const monthly = Object.values(PLANS).find((p) => p.tier === tier && p.interval === "month");
  return monthly?.priceCents ?? 0;
}

export function formatPrice(cents: number): string {
  if (cents === 0) return "Free";
  return `$${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}`;
}

/** Months free on the annual price, for an honest "save X" label. */
export function annualSaving(monthlyCents: number, annualCents: number): {
  pct: number;
  monthsFree: number;
} {
  if (!monthlyCents || !annualCents) return { pct: 0, monthsFree: 0 };
  const full = monthlyCents * 12;
  return {
    pct: Math.round(((full - annualCents) / full) * 100),
    monthsFree: Math.round(((full - annualCents) / monthlyCents) * 10) / 10,
  };
}

/**
 * Which systems a plan unlocks.
 *
 * Free returns `[]` — the caller supplies the one system the account is
 * provisioned for. That is the whole free-tier rule in one place: you get the
 * system you chose, and only that one.
 */
export function rolesFor(id: PlanId): RoleId[] {
  return PLANS[id]?.roles ?? [];
}

/**
 * The systems a free account may choose between.
 *
 * Club is absent on purpose: it is an organisation tier with staff seats and
 * the methodology engine, and there is no free version of it. Player, Coach and
 * Trainer each have a genuinely useful free form.
 */
export const FREE_ROLES: RoleId[] = ["player", "coach", "trainer"];

/**
 * May this account open this system?
 *
 * The single answer both the switcher and the server action must agree on.
 * Free entitles one system chosen from `FREE_ROLES`; paid entitles whatever the
 * plan names.
 */
export function canUseRole(planId: PlanId, role: RoleId): boolean {
  const entitled = rolesFor(planId);
  if (entitled.length > 0) return entitled.includes(role);
  return FREE_ROLES.includes(role);
}

/** Staff seats a plan allows. */
export function seatsFor(id: PlanId): number {
  return PLANS[id]?.seats ?? 1;
}

/** The cheapest plan that unlocks a given system — for a precise upgrade prompt. */
export function cheapestPlanFor(role: RoleId): PlanDef | null {
  const candidates = Object.values(PLANS)
    /*
      `!p.legacy` matters more than it looks. The retired Touchline bundle is
      the same $29 as the two tiers that replaced it, so on price alone it can
      tie for first — and an upgrade prompt pointing at a plan checkout cannot
      sell is a dead end the user has no way to understand.
    */
    .filter((p) => !p.legacy && p.roles.includes(role) && p.interval === "month")
    .sort((a, b) => a.priceCents - b.priceCents);
  return candidates[0] ?? null;
}
