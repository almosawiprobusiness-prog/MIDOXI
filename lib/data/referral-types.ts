/*
  The MIDO XI referral programme — shared shapes. Client-safe.

  Two decisions shape everything here.

  1. THE REWARD IS MONTHS, NOT MONEY.
     A conversion earns the referrer a free month of MIDO XI Pro. That is a
     reward this product can actually deliver on its own: it is granted by
     extending an entitlement, with no bank account, no payout rail and no tax
     form in the way. It is real the moment someone converts.

     Cash commission is a different business. It needs Stripe Connect,
     onboarding, 1099/W-8 collection and a payout schedule. None of that is
     built, so this file does not pretend a dollar balance exists — see
     `PAYOUT_GAP`, which states the gap in the product rather than hiding it.

  2. A REFERRAL ONLY COUNTS WHEN MONEY MOVES.
     A click is a click. A signup is a signup. Neither earns anything. The
     ledger separates the three so the numbers on the dashboard are the real
     ones, and a referrer can see exactly where people fall out.
*/

/** The life of one referral, in the order it happens. */
export type ReferralStatus =
  /** Signed up with the code. Nothing earned. */
  | "pending"
  /** Started a paid plan. This is the one that earns. */
  | "converted"
  /** Refunded, charged back, or self-referred. Reward reversed. */
  | "void";

export type RewardStatus = "earned" | "applied";

export interface ReferralCode {
  code: string;
  createdAt: string;
}

/** One person who arrived through a code, as the referrer may see them. */
export interface Referral {
  id: string;
  status: ReferralStatus;
  /** Deliberately coarse. A referrer is told a person converted, never who. */
  joinedAt: string;
  convertedAt: string | null;
  /** The tier they started on — "pro" or "elite". Null until converted. */
  tier: string | null;
}

export interface Reward {
  id: string;
  status: RewardStatus;
  /** Months of Pro this reward is worth. */
  months: number;
  earnedAt: string;
  appliedAt: string | null;
}

export interface ReferralStats {
  /** Times the link was opened. Counted without identifying anyone. */
  visits: number;
  /** Accounts created with the code. */
  signups: number;
  /** Of those, how many started paying. */
  conversions: number;
  /** Months earned in total, and how many are still unspent. */
  monthsEarned: number;
  monthsAvailable: number;
}

export interface ReferralOverview {
  code: ReferralCode | null;
  stats: ReferralStats;
  referrals: Referral[];
  rewards: Reward[];
}

// ---------------------------------------------------------------------------
// The reward
// ---------------------------------------------------------------------------

export const REWARD = {
  /** Months of Pro the referrer earns per conversion. */
  monthsPerConversion: 1,
  /** Months of Pro the person who joins gets, on their first paid month. */
  monthsForJoiner: 1,
  /**
   * A conversion is only counted once the subscription has survived this long.
   * Rewards granted on day one are rewards paid on refunds.
   */
  holdDays: 14,
} as const;

/**
 * The ladder. Every step is something the product can grant by itself; none of
 * it is a promise that depends on a payment rail that does not exist yet.
 */
export const REWARD_LADDER: { at: number; label: string; detail: string }[] = [
  { at: 1, label: "1 month of Pro", detail: "Free, the moment your first referral has paid for two weeks." },
  { at: 3, label: "3 months of Pro", detail: "A season's worth of the AI analyst, on the house." },
  { at: 6, label: "6 months of Pro", detail: "Half a year. Most people stop paying for MIDO XI around here." },
  { at: 12, label: "A year of Pro", detail: "Twelve conversions covers a full year." },
];

/**
 * What the programme cannot do yet, stated in the product rather than implied
 * away. Same discipline as the tracking gap in film analysis: architecture and
 * an honest marker, never a fake balance.
 */
export const PAYOUT_GAP = {
  describes: "Rewards are months of MIDO XI Pro, not money.",
  needs:
    "Cash commission needs a payout provider (Stripe Connect), identity and tax onboarding for every affiliate, and a payout schedule.",
  wouldAdd: [
    "A dollar balance that can be withdrawn",
    "Recurring commission on every renewal, not a one-off month",
    "Payouts to clubs and agencies reselling MIDO XI at volume",
  ],
} as const;

// ---------------------------------------------------------------------------
// Codes and links
// ---------------------------------------------------------------------------

/**
 * Referral codes get read out in a dressing room, so the alphabet drops
 * anything ambiguous when spoken or typed: no O/0, no I/1.
 */
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function generateReferralCode(random: () => number = Math.random): string {
  let out = "";
  for (let i = 0; i < 6; i++) out += ALPHABET[Math.floor(random() * ALPHABET.length)];
  return out;
}

export function normaliseReferralCode(code: string): string {
  return code.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/** Only codes this generator could have produced are worth a database round trip. */
export function isPlausibleReferralCode(code: string): boolean {
  const c = normaliseReferralCode(code);
  return c.length === 6 && [...c].every((ch) => ALPHABET.includes(ch));
}

export function referralUrl(code: string, appUrl: string): string {
  return `${appUrl.replace(/\/$/, "")}/join/${code}`;
}

// ---------------------------------------------------------------------------
// Derivations — pure, so the dashboard and the tests agree
// ---------------------------------------------------------------------------

export function statsFrom(referrals: Referral[], rewards: Reward[], visits: number): ReferralStats {
  const live = referrals.filter((r) => r.status !== "void");
  const monthsEarned = rewards.reduce((n, r) => n + r.months, 0);
  const monthsAvailable = rewards
    .filter((r) => r.status === "earned")
    .reduce((n, r) => n + r.months, 0);
  return {
    visits,
    signups: live.length,
    conversions: live.filter((r) => r.status === "converted").length,
    monthsEarned,
    monthsAvailable,
  };
}

/** The next rung, so the dashboard can say what one more referral is worth. */
export function nextRung(conversions: number): { at: number; label: string; detail: string } | null {
  return REWARD_LADDER.find((r) => r.at > conversions) ?? null;
}

/**
 * Where people are falling out. Returned as counts rather than rates so a
 * dashboard built on four visits does not claim a "25% conversion rate".
 */
export function funnel(stats: ReferralStats): { label: string; value: number; hint: string }[] {
  return [
    { label: "Opened your link", value: stats.visits, hint: "Counted without identifying anyone" },
    { label: "Created an account", value: stats.signups, hint: "Signed up with your code" },
    { label: "Started paying", value: stats.conversions, hint: `Counted after ${REWARD.holdDays} days` },
  ];
}

export const REFERRAL_STATUS_META: Record<
  ReferralStatus,
  { label: string; hint: string; tone: "dim" | "signal" | "positive" }
> = {
  pending: { label: "Joined", hint: "On the free OS — nothing earned yet", tone: "dim" },
  converted: { label: "Paying", hint: "Earned you a month of Pro", tone: "positive" },
  void: { label: "Reversed", hint: "Refunded, or the same person twice", tone: "dim" },
};
