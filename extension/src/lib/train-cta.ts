/*
  BUILD A TRAINING SESSION — the one conversion path, as pure logic.

  Capture helps the player remember what they saw; MIDO XI trains it.
  This module decides WHEN the bridge is offered and WHERE each click
  goes, with no chrome.* and no DOM, so the rules sit under unit test
  next to library-core.ts.

  The privacy line is structural: every URL built here carries at most
  a capture id and a source enum. The observation, the video URL and
  the library never ride a link — an entitled user's lesson is fetched
  server-side by id, and a free user's lesson stays on the device until
  they explicitly import it.
*/

/**
 * How long a dismissal holds the automatic post-save offer down.
 * Long enough to not nag, short enough that a player who keeps
 * capturing gets asked again while the habit is alive.
 */
export const TRAIN_CTA_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;

/** Free Mode earns the offer with real usage, not on the first save. */
export const LOCAL_MIN_SAVES = 2;

export interface SavedCtaInput {
  /** Server-verified for connected sessions; always false for local. */
  entitled: boolean;
  mode: "connected" | "local";
  /** Library size after this save (local mode only decides on it). */
  savedCount: number;
  /** ISO timestamp of the last "Not now", or null/undefined. */
  dismissedAt: string | null | undefined;
  nowMs: number;
}

/**
 * Should the saved-success state offer BUILD A TRAINING SESSION?
 *
 * For an entitled player it is a product capability and always shows —
 * never an advertisement, never dismissible-with-a-cooldown. For
 * everyone else it is an upsell and obeys restraint: a dismissal holds
 * for TRAIN_CTA_COOLDOWN_MS, and Free Mode waits for LOCAL_MIN_SAVES
 * so the very first capture stays a clean win. The quiet per-moment
 * action in the library exists regardless — this only governs the
 * automatic post-save surface.
 */
export function shouldShowSavedCta(input: SavedCtaInput): boolean {
  if (input.mode === "connected" && input.entitled) return true;
  if (input.mode === "local" && input.savedCount < LOCAL_MIN_SAVES) return false;
  if (input.dismissedAt) {
    const dismissed = Date.parse(input.dismissedAt);
    if (Number.isFinite(dismissed) && input.nowMs - dismissed < TRAIN_CTA_COOLDOWN_MS) return false;
  }
  return true;
}

/**
 * The paid handoff: MIDO XI Training with this lesson as the focus.
 * The id is the whole payload — the server refetches the lesson under
 * RLS, so nothing private appears in the URL or the browser history.
 */
export function trainingHandoffUrl(appUrl: string, midoId: string): string {
  return `${appUrl}/app/training?focus=${encodeURIComponent(`capture:${midoId}`)}&src=extension`;
}

/**
 * The connected-free upgrade destination. The capture id (when the
 * moment already lives in MIDO XI) lets the post-checkout return
 * deliver the session the player paid for.
 */
export function membershipUpgradeUrl(appUrl: string, midoId?: string | null): string {
  const base = `${appUrl}/app/membership?src=capture_training`;
  return midoId ? `${base}&capture=${encodeURIComponent(midoId)}` : base;
}

/**
 * The local-mode path: sign in first, then land on the same upgrade
 * page. Only the source enum travels — the local lesson stays local
 * until the player explicitly imports it from the library view.
 */
export function connectForTrainingUrl(appUrl: string): string {
  return `${appUrl}/login?next=${encodeURIComponent("/app/membership?src=capture_training")}`;
}

/*
  THE HANDOFF INTENT — how a Free Mode lesson survives the trip through
  login/checkout without ever leaving the device.

  When a local player presses "Continue to MIDO XI" (or a connected
  player upgrades for a moment that only exists locally), the extension
  remembers WHICH lesson asked to be trained — as a local id in
  chrome.storage, nothing more. Nothing uploads. When the popup next
  opens connected AND entitled, the intent surfaces as one explicit
  offer: "Use this lesson" — import that single Moment, get its server
  id, open Training. The player consents at the moment of transfer,
  not before.
*/

export interface TrainIntent {
  /** The LOCAL library id of the lesson the player asked to train. */
  localId: string;
  savedAt: string;
}

/** An intent older than this is a stale thought, not a promise owed. */
export const TRAIN_INTENT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

/** Validate a stored intent: shape, bounds, freshness. Null = ignore. */
export function asTrainIntent(v: unknown, nowMs: number): TrainIntent | null {
  if (!v || typeof v !== "object") return null;
  const i = v as { localId?: unknown; savedAt?: unknown };
  if (typeof i.localId !== "string" || !i.localId || i.localId.length > 64) return null;
  if (typeof i.savedAt !== "string") return null;
  const at = Date.parse(i.savedAt);
  // A clock-skewed "future" intent is tolerated by a minute, no more.
  if (!Number.isFinite(at) || nowMs - at > TRAIN_INTENT_MAX_AGE_MS || at - nowMs > 60_000) return null;
  return { localId: i.localId, savedAt: i.savedAt };
}

/** 999 → "$9.99"; 8900 → "$89". Display only. */
export function formatPriceCents(cents: number): string {
  if (!Number.isFinite(cents) || cents <= 0) return "";
  const dollars = cents / 100;
  return Number.isInteger(dollars) ? `$${dollars}` : `$${dollars.toFixed(2)}`;
}

export interface PlayerPricing {
  monthlyCents: number;
  annualCents: number;
}

/** Bounds-checked parse of the session response's pricing block. */
export function asPricing(v: unknown): PlayerPricing | null {
  if (!v || typeof v !== "object") return null;
  const p = v as { monthlyCents?: unknown; annualCents?: unknown };
  if (
    typeof p.monthlyCents !== "number" || !Number.isFinite(p.monthlyCents) || p.monthlyCents <= 0 ||
    typeof p.annualCents !== "number" || !Number.isFinite(p.annualCents) || p.annualCents <= 0
  ) {
    return null;
  }
  return { monthlyCents: p.monthlyCents, annualCents: p.annualCents };
}
