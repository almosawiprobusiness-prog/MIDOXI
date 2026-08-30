/*
  The platform fee on trainer payments — Option B, decided 30 Aug 2026:
  a small application fee that STEPS DOWN as the trainer's roster grows.
  Growth is rewarded, not taxed: the busier the practice, the smaller
  MIDO XI's slice of each payment.

  Charged via Stripe's `application_fee_amount` on destination charges,
  computed at payment-link creation from the trainer's ACTIVE athlete
  count at that moment. A link created at 2% stays 2% — the fee a
  trainer saw when they made the link is the fee they pay on it.

  Pure and client-safe: the Lab shows the same schedule this module
  charges from, so the UI can never advertise a rate the charge ignores.
*/

export interface FeeTier {
  /** Active athletes needed to reach this tier. */
  minAthletes: number;
  /** Fee in basis points (100 bps = 1%). */
  bps: number;
  label: string;
}

/** Descending order — first tier whose threshold is met wins. */
export const CONNECT_FEE_TIERS: FeeTier[] = [
  { minAthletes: 16, bps: 100, label: "1% — 16+ athletes" },
  { minAthletes: 6, bps: 150, label: "1.5% — 6–15 athletes" },
  { minAthletes: 0, bps: 200, label: "2% — up to 5 athletes" },
];

/** The fee rate for a roster of this size, in basis points. */
export function connectFeeBps(activeAthletes: number): number {
  const n = Number.isFinite(activeAthletes) ? Math.max(0, Math.floor(activeAthletes)) : 0;
  for (const tier of CONNECT_FEE_TIERS) {
    if (n >= tier.minAthletes) return tier.bps;
  }
  return CONNECT_FEE_TIERS[CONNECT_FEE_TIERS.length - 1].bps;
}

/**
 * The application fee for one payment, in cents.
 *
 * Rounded half-up; never negative; never the whole amount. Stripe
 * rejects an application fee >= the charge, so the cap is belt and
 * braces for pathological inputs, not a real tier.
 */
export function applicationFeeCents(amountCents: number, activeAthletes: number): number {
  if (!Number.isFinite(amountCents) || amountCents <= 0) return 0;
  const fee = Math.round((amountCents * connectFeeBps(activeAthletes)) / 10_000);
  return Math.min(Math.max(0, fee), Math.max(0, amountCents - 1));
}

/** "2%" — for the Lab's fee card and the payment-link confirmation. */
export function feePercentLabel(activeAthletes: number): string {
  const bps = connectFeeBps(activeAthletes);
  return `${(bps / 100).toString().replace(/\.0$/, "")}%`;
}

/**
 * What would make the fee smaller, in the trainer's terms — or null
 * when they already sit on the lowest tier.
 */
export function nextTierHint(activeAthletes: number): string | null {
  const current = connectFeeBps(activeAthletes);
  const better = [...CONNECT_FEE_TIERS]
    .reverse()
    .find((t) => t.bps < current);
  if (!better) return null;
  const need = better.minAthletes - Math.max(0, Math.floor(activeAthletes));
  return `${need} more active athlete${need === 1 ? "" : "s"} drops your fee to ${(better.bps / 100)
    .toString()
    .replace(/\.0$/, "")}%.`;
}

/** Bounds for what a trainer may charge per product. */
export const PRODUCT_MIN_CENTS = 100; // $1 — Stripe's practical floor
export const PRODUCT_MAX_CENTS = 500_000; // $5,000 — a typo guard, not a business rule
