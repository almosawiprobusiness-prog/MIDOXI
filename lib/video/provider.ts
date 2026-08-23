/*
  ============================================================
  VIDEO ANALYSIS PROVIDERS
  ------------------------------------------------------------
  One interface, several very different kinds of answer.

  MIDO's own provider reads sampled still frames and describes
  what is visible in them. That is interpretation — the same
  category as everything else MIDO writes, and it is labelled
  the same way.

  A tracking provider (Veo, Hudl, Second Spectrum and the like)
  returns measurement: positions, distances, speeds, events.
  That is a different kind of claim entirely, and the product
  must never let one masquerade as the other. The `kind` on a
  provider, and on every result it returns, is what keeps them
  apart.

  Nothing here fakes a capability. A provider that is not
  configured reports itself unavailable and says what it would
  need — it does not return placeholder numbers.

  Client-safe: types and a registry, no server imports.
  ============================================================
*/

/*
  What kind of claim an analysis makes. These are not interchangeable and the
  product must never let one be presented as another.

    frames    what is visible in sampled stills. Interpretation, with gaps.
    video     what is visible in the clip itself, motion included. Still
              interpretation — but it can see a shoulder check happen, which
              stills between two moments cannot.
    tracking  positions and distances over time. Measurement.
    events    passes, shots, duels as structured data. Measurement.
*/
export type AnalysisKind = "frames" | "video" | "tracking" | "events";

export type ProviderCapability =
  /** Describes what is visible in still frames. Interpretation. */
  | "frame-reading"
  /** Reads the clip itself, so movement between moments is visible. */
  | "video-reading"
  /** Player and ball positions over time. Measurement. */
  | "tracking"
  /** Passes, shots, duels as structured events. Measurement. */
  | "events"
  /** Physical output: distances, sprints, top speeds. Measurement. */
  | "physical";

export interface AnalysisFrame {
  /** Where in the video this frame came from. */
  atSeconds: number;
  mediaType: "image/jpeg" | "image/png" | "image/webp";
  /** Base64, no data: prefix. */
  data: string;
}

export interface AnalysisRequest {
  videoId: string;
  fromSeconds: number;
  toSeconds: number;
  /** Frames sampled from the range — only frame-reading providers use these. */
  frames: AnalysisFrame[];
  /** What the analysis is looking for, in the user's words. */
  focus: string;
  /** Who is watching, so the reading is written for them. */
  viewer: {
    role: string;
    position: string;
    /** Concepts they are working on, from the knowledge graph. */
    concepts: string[];
    /**
     * How to find this person on the pitch — "number 9, blue shirts, left
     * footed". The single hardest problem in reading amateur football film is
     * knowing which player is the one watching, and no model solves it
     * reliably from the footage alone. The player answering it is worth more
     * than any amount of model capability, and when it is absent the reading
     * is written about the passage rather than about them.
     */
    identity?: string;
  };
  /** Set when a provider needs to fetch the source itself, rather than frames. */
  sourceUrl?: string;
  /** How the source is held, so a provider knows whether it must be uploaded. */
  source?: { kind: "upload" | "youtube" | "url"; title: string };
  /** Observations already recorded against these concepts, for a re-check. */
  priorObservations?: PriorObservation[];
}

/**
 * Something MIDO already said about this player, on an earlier clip.
 *
 * Passing these into the next read is what turns a series of one-off analyses
 * into a record: the model can say "this is the fourth time" or, better, "this
 * is the first clip where it does not happen".
 */
export interface PriorObservation {
  /** ISO date, so the model can say how long ago. */
  on: string;
  concept?: string;
  title: string;
}

export interface AnalysisObservation {
  atSeconds: number;
  title: string;
  body: string;
  /** Which curated concept this observation is about, when it maps to one. */
  concept?: string;
  /**
   * How sure the reading is.
   *
   *   observed  it is in the film and can be pointed at
   *   inferred  it follows from what is in the film, but is a judgement
   *   uncertain the film does not settle it — often because the player
   *             cannot be identified with confidence
   *
   * Absent means observed, for rows written before this existed.
   */
  confidence?: "observed" | "inferred" | "uncertain";
}

export const CONFIDENCE_META: Record<
  NonNullable<AnalysisObservation["confidence"]>,
  { label: string; hint: string; color: string }
> = {
  observed: {
    label: "Observed",
    hint: "Visible in the film at this moment. Used for the passage itself — MIDO does not claim this about you personally, because it cannot be certain which player you are.",
    color: "var(--positive)",
  },
  inferred: {
    label: "Inferred",
    hint: "A judgement that follows from what is visible — not the film itself. Everything MIDO says about you specifically lands here or below.",
    color: "var(--signal)",
  },
  uncertain: {
    label: "Uncertain",
    hint: "The film does not settle this — usually because MIDO could not pick you out at all.",
    color: "var(--review)",
  },
};

export interface AnalysisResult {
  kind: AnalysisKind;
  provider: string;
  model?: string;
  summary: string;
  observations: AnalysisObservation[];
  framesUsed: number;
}

export type AnalysisOutcome =
  | { ok: true; result: AnalysisResult }
  | { ok: false; error: string };

export interface ProviderStatus {
  available: boolean;
  /** Why it cannot run, and what it would take — shown in the UI verbatim. */
  reason?: string;
}

export interface VideoAnalysisProvider {
  id: string;
  label: string;
  kind: AnalysisKind;
  capabilities: ProviderCapability[];
  /** One line on what this provider can honestly tell you. */
  describes: string;
  /** One line on what it cannot. */
  cannot: string;
  /** Whether it can run right now, with the reason when it cannot. */
  status(): Promise<ProviderStatus>;
  analyse(request: AnalysisRequest): Promise<AnalysisOutcome>;
}

/**
 * What a tracking provider would add, stated plainly so the gap is visible in
 * the product rather than hidden. No implementation ships with MIDO XI: real
 * tracking comes from a vendor with cameras or licensed match data, and
 * pretending otherwise would be inventing measurements.
 */
export const TRACKING_GAP = {
  label: "Tracking provider",
  describes:
    "Positions, distances, sprint counts, top speeds and event data — measurement rather than interpretation.",
  needs:
    "A camera system or a licensed data feed (Veo, Hudl, Second Spectrum and similar). MIDO XI has the interface ready; the data has to come from a vendor.",
  capabilities: ["tracking", "events", "physical"] as ProviderCapability[],
};

/** Frame budget per analysis. Cost and quality both fall off past this. */
export const MAX_FRAMES = 12;

/*
  Clip length for a native video read.

  Not a technical ceiling — the model handles far longer. It is a product one.
  A read of ninety minutes returns a school report; a read of forty seconds
  returns something a player can act on this week. The lower bound exists
  because under ten seconds there is not enough movement to be worth the
  round trip, and the stills reader answers that case perfectly well.
*/
export const CLIP_MIN_SECONDS = 10;
export const CLIP_MAX_SECONDS = 90;

export function clipLengthIssue(fromSeconds: number, toSeconds: number): string | null {
  const span = Math.round(toSeconds - fromSeconds);
  if (span < CLIP_MIN_SECONDS) {
    return `That range is ${span}s. Reading the clip itself needs at least ${CLIP_MIN_SECONDS}s of movement — for a single moment, frame reading is the better tool.`;
  }
  if (span > CLIP_MAX_SECONDS) {
    return `That range is ${span}s. Keep it to ${CLIP_MAX_SECONDS}s or less: a read of one passage is worth more than a summary of a half.`;
  }
  return null;
}

/** Sensible sampling rates offered in the UI, in frames per second. */
export const SAMPLE_RATES = [
  { fps: 0.5, label: "1 frame / 2s", hint: "A longer passage — shape and movement" },
  { fps: 1, label: "1 frame / s", hint: "A sequence — the default" },
  { fps: 2, label: "2 frames / s", hint: "A single action — the moment of contact" },
];

/** How many frames a range would produce at a rate, capped at the budget. */
export function frameCount(fromSeconds: number, toSeconds: number, fps: number): number {
  const span = Math.max(0, toSeconds - fromSeconds);
  return Math.max(1, Math.min(MAX_FRAMES, Math.floor(span * fps) + 1));
}

/** The timestamps to grab, evenly spread across the range. */
export function frameTimestamps(fromSeconds: number, toSeconds: number, fps: number): number[] {
  const count = frameCount(fromSeconds, toSeconds, fps);
  const span = Math.max(0, toSeconds - fromSeconds);
  if (count === 1 || span === 0) return [fromSeconds];
  const step = span / (count - 1);
  return Array.from({ length: count }, (_, i) => Number((fromSeconds + i * step).toFixed(2)));
}

/** The longest range worth sampling at a given rate, given the frame budget. */
export function maxRangeSeconds(fps: number): number {
  return Math.round(MAX_FRAMES / fps);
}
