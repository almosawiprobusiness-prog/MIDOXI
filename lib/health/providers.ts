/*
  Wearables — shared shapes and the honest truth about each one.

  Client-safe: no server imports.

  The distinction that runs through this file is between providers
  with a SERVER API and providers without one. It is not a detail —
  it decides whether "connect" means an OAuth handshake or a file
  somebody exports from their phone, and pretending the two are the
  same is how a product ends up with a Connect button that cannot
  possibly work.
*/

export type ProviderId =
  | "whoop"
  | "garmin"
  | "oura"
  | "polar"
  | "apple_import"
  | "samsung_import";

export type ConnectionStatus = "active" | "expired" | "revoked";

export interface ProviderDef {
  id: ProviderId;
  name: string;
  /** OAuth against the provider's own servers, or a file the player exports. */
  kind: "oauth" | "import";
  /** Live in the product now. */
  available: boolean;
  /** What it actually gives us, in the player's words. */
  measures: string[];
  /** Said plainly on the page. */
  note?: string;
}

export const PROVIDERS: ProviderDef[] = [
  {
    id: "whoop",
    name: "WHOOP",
    kind: "oauth",
    available: true,
    measures: ["Recovery", "HRV", "Resting heart rate", "Sleep", "Blood oxygen", "Strain"],
  },
  {
    id: "garmin",
    name: "Garmin",
    kind: "oauth",
    available: false,
    measures: ["Body Battery", "HRV", "Resting heart rate", "Sleep"],
    note: "Has a server API and works the same way as WHOOP. Not built yet.",
  },
  {
    id: "oura",
    name: "Oura",
    kind: "oauth",
    available: false,
    measures: ["Readiness", "HRV", "Resting heart rate", "Sleep"],
    note: "Has a server API and works the same way as WHOOP. Not built yet.",
  },
  {
    id: "polar",
    name: "Polar",
    kind: "oauth",
    available: false,
    measures: ["Nightly recharge", "Resting heart rate", "Sleep"],
    note: "Has a server API and works the same way as WHOOP. Not built yet.",
  },
  {
    /*
      The one people ask for most, and the one that cannot work the way
      they expect. HealthKit is on-device only: there is no endpoint any
      server can call, so nothing here can "connect" to Apple Health.
      Data leaves an iPhone only through an app on that iPhone, or
      through a file the owner exports themselves.
    */
    id: "apple_import",
    name: "Apple Health",
    kind: "import",
    available: false,
    measures: ["HRV", "Resting heart rate", "Sleep"],
    note:
      "Apple Health has no server API — the data never leaves your iPhone unless you export it. A live sync would need a MIDO iOS app. File import is not built yet.",
  },
  {
    id: "samsung_import",
    name: "Samsung Health",
    kind: "import",
    available: false,
    measures: ["HRV", "Resting heart rate", "Sleep"],
    note:
      "Samsung Health is on-device Android only; the old partner REST API is closed to new developers. A live sync would need a MIDO Android app. File import is not built yet.",
  },
];

export function providerDef(id: ProviderId): ProviderDef {
  return PROVIDERS.find((p) => p.id === id) ?? PROVIDERS[0];
}

export interface Connection {
  provider: ProviderId;
  status: ConnectionStatus;
  connectedAt: string;
  lastSyncAt: string | null;
  lastError: string | null;
}

/** One day of measured physiology. Every field may be absent. */
export interface RecoverySample {
  day: string;
  source: ProviderId;
  recoveryScore: number | null;
  hrvMs: number | null;
  restingHr: number | null;
  spo2Percent: number | null;
  skinTempC: number | null;
  sleepPerformance: number | null;
  sleepDurationMin: number | null;
  sleepNeedMin: number | null;
  sleepEfficiency: number | null;
  strain: number | null;
}

/**
 * Has this sample got anything in it?
 *
 * A device can return a night scored as UNSCORED — strap off, not
 * enough data. The row still exists, and rendering it as a card full
 * of dashes is worse than not rendering it.
 */
export function hasAnyMetric(s: RecoverySample): boolean {
  return (
    s.recoveryScore !== null ||
    s.hrvMs !== null ||
    s.restingHr !== null ||
    s.sleepPerformance !== null ||
    s.sleepDurationMin !== null ||
    s.strain !== null
  );
}

/** "7h 42m", or null when nothing was measured. */
export function formatSleep(minutes: number | null): string | null {
  if (minutes === null || minutes < 0) return null;
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

/**
 * How WHOOP itself bands a recovery score, so the colour on the page
 * means the same thing it means in their app.
 *
 * Deliberately not re-derived or "improved": a player who sees green
 * in one place and amber in the other for the same number stops
 * trusting both.
 */
export function recoveryBand(score: number | null): "high" | "moderate" | "low" | null {
  if (score === null) return null;
  if (score >= 67) return "high";
  if (score >= 34) return "moderate";
  return "low";
}

export const BAND_LABEL: Record<"high" | "moderate" | "low", string> = {
  high: "Recovered",
  moderate: "Moderate",
  low: "Low",
};

/**
 * Sleep against what the device says was needed.
 *
 * Returned as a ratio rather than a verdict — the page says "6h 10m of
 * 8h 20m needed" and lets the player draw the conclusion, instead of
 * inventing a word like "insufficient" that no device reported.
 */
export function sleepDebtMin(s: RecoverySample): number | null {
  if (s.sleepDurationMin === null || s.sleepNeedMin === null) return null;
  return Math.max(0, s.sleepNeedMin - s.sleepDurationMin);
}
