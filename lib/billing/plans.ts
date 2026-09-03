import type { RoleId } from "@/lib/roles/roles";

/*
  Plan catalogue — client-safe.

  Two paid tiers, and a floor:

    Free       one system, your choice, forever. Core tools, no AI.
    MIDO XI    every individual system + the AI layer. You drive it. $29.
    Managed    we run it. All four systems, staff seats, delivered in the
               club's own identity. Quoted, never self-serve.

  THE AXIS THIS FILE USED TO TURN ON, AND WHY IT CHANGED.

  Plans were shaped by *who you are* — Player, Touchline Coach, Touchline
  Trainer, Club — on the principle that a club paying the same as a
  fifteen-year-old is wrong in both directions. That principle is intact; the
  fifteen-year-old is simply answered by Free now, which is the whole
  deterministic product and says so honestly. What replaces the identity ladder
  is a DELIVERY axis: one tier the customer drives, one we run for them.

  `xi` is deliberately the old Touchline bundle — Player + Coach + Trainer at
  the same $29 — so the accounts already on `touchline_*` are already on
  exactly the right product and lose nothing.

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
  /** The one self-serve paid tier. Every individual system, one seat. */
  | "xi"
  /** Done-for-you. Quoted through the quote system, never bought in-app. */
  | "managed"
  /*
    LEGACY, all of it. These tiers are no longer sold — no TIER_CARDS entry,
    never returned by `cheapestPlanFor` — and survive so the accounts that
    bought them keep exactly what they paid for.

      player               $9.99, Player OS only. Folded into Free upward and
                           MIDO XI downward; the AI allowance is the paid part
                           and Free was always the honest home for the rest.
      touchline            The Player+Coach+Trainer bundle `xi` now is.
      touchline_coach      Split out of Touchline and never sold — no Stripe
      touchline_trainer    price was ever created for either. Kept only
                           because migration 0043 wrote their rows and a comp
                           may name them.
      club                 Folded into Managed. Clubs negotiate anyway, and a
                           club is exactly who buys done-for-you.
  */
  | "player"
  | "touchline"
  | "touchline_coach"
  | "touchline_trainer"
  | "club";

export type PlanId =
  | "free"
  | "xi_monthly" | "xi_annual"
  | "managed"
  // Grandfathered — see the Tier union.
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
  /**
   * Price lives in a quote, not in this catalogue.
   *
   * `priceCents: 0` on a quoted plan means "no list price", NOT "free" —
   * anything formatting a price must check this first or it will cheerfully
   * advertise Managed at $0. `formatPrice` cannot tell the difference on its
   * own, which is exactly why the flag is on the plan rather than inferred.
   */
  quoted?: boolean;
}

/** Days of full access before the first charge. Card required. */
export const TRIAL_DAYS = 7;

const PLAYER_AI: Entitlements = {
  ai_interactions: 150,
  deep_analyses: 20,
  study_discoveries: 30,
};

const XI_AI: Entitlements = {
  ai_interactions: 400,
  deep_analyses: 60,
  study_discoveries: 80,
};

const MANAGED_AI: Entitlements = {
  ai_interactions: 1500,
  deep_analyses: 200,
  study_discoveries: 250,
};

/*
  MIDO XI carries every system a person can work in. Club OS is absent on
  purpose: it is the organisation layer — staff, teams, the methodology every
  coach writes inside — and it is meaningless on one seat. Seats are the honest
  line between the two paid tiers, so that is where the line is drawn.
*/
const XI_ROLES: RoleId[] = ["player", "coach", "trainer"];
const MANAGED_ROLES: RoleId[] = ["player", "coach", "trainer", "club"];

/* Retired shapes, preserved exactly as they were sold. */
const TOUCHLINE_ROLES: RoleId[] = ["player", "coach", "trainer"];
const COACH_ROLES: RoleId[] = ["player", "coach"];
const TRAINER_ROLES: RoleId[] = ["player", "trainer"];
const CLUB_ROLES: RoleId[] = ["player", "coach", "trainer", "club"];

export const PLANS: Record<PlanId, PlanDef> = {
  free:       { id: "free",       tier: "free",    name: "MIDO XI",         priceCents: 0,     interval: null,    entitlements: {},      roles: [],           seats: 1 },
  xi_monthly: { id: "xi_monthly", tier: "xi",      name: "MIDO XI",         priceCents: 2900,  interval: "month", entitlements: XI_AI,   roles: XI_ROLES,     seats: 1 },
  xi_annual:  { id: "xi_annual",  tier: "xi",      name: "MIDO XI",         priceCents: 27900, interval: "year",  entitlements: XI_AI,   roles: XI_ROLES,     seats: 1 },

  /*
    Managed has no interval and no Stripe price because it is not bought in the
    app — it is quoted, accepted and invoiced through the quote system. The row
    exists here so entitlements, seats and role gating resolve for an account
    that is on it; `priceCents: 0` is meaningless and `quoted` says so.
  */
  managed:    { id: "managed",    tier: "managed", name: "MIDO XI Managed", priceCents: 0,     interval: null,    entitlements: MANAGED_AI, roles: MANAGED_ROLES, seats: 10, quoted: true },

  // ---- grandfathered. Not buyable; still honoured. ----
  player_monthly:            { id: "player_monthly",            tier: "player",            name: "MIDO XI Player",            priceCents: 999,   interval: "month", entitlements: PLAYER_AI, roles: ["player"],      seats: 1,  legacy: true },
  player_annual:             { id: "player_annual",             tier: "player",            name: "MIDO XI Player",            priceCents: 8900,  interval: "year",  entitlements: PLAYER_AI, roles: ["player"],      seats: 1,  legacy: true },
  touchline_monthly:         { id: "touchline_monthly",         tier: "touchline",         name: "MIDO XI Touchline",         priceCents: 2900,  interval: "month", entitlements: XI_AI,     roles: TOUCHLINE_ROLES, seats: 1,  legacy: true },
  touchline_annual:          { id: "touchline_annual",          tier: "touchline",         name: "MIDO XI Touchline",         priceCents: 27900, interval: "year",  entitlements: XI_AI,     roles: TOUCHLINE_ROLES, seats: 1,  legacy: true },
  touchline_coach_monthly:   { id: "touchline_coach_monthly",   tier: "touchline_coach",   name: "MIDO XI Touchline Coach",   priceCents: 2900,  interval: "month", entitlements: XI_AI,     roles: COACH_ROLES,     seats: 1,  legacy: true },
  touchline_coach_annual:    { id: "touchline_coach_annual",    tier: "touchline_coach",   name: "MIDO XI Touchline Coach",   priceCents: 27900, interval: "year",  entitlements: XI_AI,     roles: COACH_ROLES,     seats: 1,  legacy: true },
  touchline_trainer_monthly: { id: "touchline_trainer_monthly", tier: "touchline_trainer", name: "MIDO XI Touchline Trainer", priceCents: 2900,  interval: "month", entitlements: XI_AI,     roles: TRAINER_ROLES,   seats: 1,  legacy: true },
  touchline_trainer_annual:  { id: "touchline_trainer_annual",  tier: "touchline_trainer", name: "MIDO XI Touchline Trainer", priceCents: 27900, interval: "year",  entitlements: XI_AI,     roles: TRAINER_ROLES,   seats: 1,  legacy: true },
  club_monthly:              { id: "club_monthly",              tier: "club",              name: "MIDO XI Club",              priceCents: 14900, interval: "month", entitlements: MANAGED_AI, roles: CLUB_ROLES,     seats: 10, legacy: true },
  club_annual:               { id: "club_annual",               tier: "club",              name: "MIDO XI Club",              priceCents: 149000, interval: "year", entitlements: MANAGED_AI, roles: CLUB_ROLES,     seats: 10, legacy: true },
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
  /** No list price — the card shows a contact route instead of a number. */
  quoted?: boolean;
  /** What the button says when there is nothing to check out. */
  quotedCta?: string;
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
    tier: "xi",
    name: "MIDO XI",
    tagline: "Every system, and the analyst that reads your football with you.",
    monthlyId: "xi_monthly",
    annualId: "xi_annual",
    monthlyCents: 2900,
    annualCents: 27900,
    trialDays: TRIAL_DAYS,
    systems: "Player + Coach + Trainer",
    popular: true,
    perks: [
      "Everything in Free, across all three systems",
      "MIDO reads your own film and tells you what it sees",
      "Sessions and programmes drafted from your objective, editable block by block",
      "Match plans written from your own opposition notes",
      "Your record kept — timeline, evidence, and a report worth handing over",
    ],
  },
  {
    tier: "managed",
    name: "MIDO XI Managed",
    tagline: "We run it. You get the week's work back, in your own colours.",
    monthlyCents: 0,
    annualCents: 0,
    quoted: true,
    quotedCta: "Request a quote",
    systems: "All four, across your staff",
    perks: [
      "Everything in MIDO XI, for the whole staff",
      "Your film analysed and your sessions written by us",
      "Reports delivered in your club's identity, not ours",
      "The methodology written once — every coach's session drafted inside it",
      "AI volume sized to your squad, not to a plan",
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
  if (tier === "managed") return "Managed";
  if (tier === "xi") return "MIDO XI";
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
 *
 * Returns 0 for a quoted tier, which is correct rather than lossy: Managed is
 * invoiced against an accepted quote, so there is no catalogue month to credit
 * and it never enters the self-serve referral path in the first place.
 */
export function monthlyCentsForTier(tier: Tier): number {
  const monthly = Object.values(PLANS).find((p) => p.tier === tier && p.interval === "month");
  return monthly?.priceCents ?? 0;
}

export function formatPrice(cents: number): string {
  if (cents === 0) return "Free";
  return `$${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}`;
}

/**
 * What a plan costs, in words, safe for a quoted plan.
 *
 * `formatPrice(0)` says "Free", which is right for the free tier and a lie for
 * Managed. Anything user-facing goes through here instead.
 */
export function planPriceLabel(plan: PlanDef): string {
  if (plan.quoted) return "Quoted";
  return formatPrice(plan.priceCents);
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
      `!p.legacy` matters more than it looks. Several retired tiers sit at the
      same $29 as `xi`, so on price alone they can tie for first — and an
      upgrade prompt pointing at a plan checkout cannot sell is a dead end the
      user has no way to understand.

      Quoted plans are candidates but never billed monthly, so they are matched
      on `quoted` rather than on interval. Club is the only system they answer
      for, and Managed is the only way to open it.
    */
    .filter((p) => !p.legacy && p.roles.includes(role) && (p.interval === "month" || p.quoted))
    /*
      A quoted plan sorts last regardless of its `priceCents: 0`. Sorting on the
      raw number would make Managed the "cheapest" way into every system and
      send a player who wants film reads to a sales conversation.
    */
    .sort((a, b) => (a.quoted ? Infinity : a.priceCents) - (b.quoted ? Infinity : b.priceCents));
  return candidates[0] ?? null;
}
