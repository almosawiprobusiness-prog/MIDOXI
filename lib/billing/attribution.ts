/*
  Checkout attribution — where a subscription purchase came from.

  Deliberately tiny and closed. The first (and so far only) source is
  the Capture → Training conversion path: "I saved a lesson, I asked
  for training, that needed Player." Knowing a purchase originated
  there — rather than "web checkout" — is the whole experiment
  (docs/product/CAPTURE_TO_TRAINING_CONVERSION.md).

  Pure and client-safe on purpose: the membership page reads it from
  the URL, the server action re-validates it, and Stripe metadata gets
  exactly the sanitized result. Only enums and a UUID ever pass —
  never lesson text, never a URL, so nothing private can reach Stripe
  even by accident.
*/

export const CHECKOUT_SOURCES = ["capture_training"] as const;
export type CheckoutSource = (typeof CHECKOUT_SOURCES)[number];

export interface CheckoutAttribution {
  source: CheckoutSource;
  /** The saved capture the purchase should deliver training for. */
  captureId?: string;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(v: unknown): v is string {
  return typeof v === "string" && UUID_RE.test(v);
}

/**
 * Keep only a recognised source and a well-formed capture id. Anything
 * else — unknown sources, junk ids, free text — returns null or drops
 * the field, so a hand-edited URL cannot smuggle content into billing
 * metadata. Ownership of the capture is NOT checked here: the id is an
 * opaque breadcrumb, and every read through it goes via RLS.
 */
export function sanitizeCheckoutAttribution(raw: {
  source?: unknown;
  captureId?: unknown;
}): CheckoutAttribution | null {
  if (!(CHECKOUT_SOURCES as readonly unknown[]).includes(raw.source)) return null;
  const attribution: CheckoutAttribution = { source: raw.source as CheckoutSource };
  if (isUuid(raw.captureId)) attribution.captureId = raw.captureId.toLowerCase();
  return attribution;
}
