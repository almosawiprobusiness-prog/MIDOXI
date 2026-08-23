export interface StudyRecommendation {
  videoId: string;
  title: string;
  channel: string;
  thumbnailUrl: string;
  url: string;
  durationSeconds?: number;
  /** One line: why this film matters for THIS player right now. */
  reason: string;
  /** Which development goal it speaks to, if any. */
  matchedGoal?: string | null;
  /** Loose theme label for the chip. */
  theme: string;
}

export interface DiscoverContext {
  position: string;
  goals: string[];
  intents: string[];
}

export interface DiscoverResult {
  /** Heuristic picks, computed on every load — free, no quota. */
  recommendations: StudyRecommendation[];
  engine: "heuristic";
  context: DiscoverContext;
  youtubeEnabled: boolean;
  /** Whether the metered AI upgrade can be offered here, and why not. */
  ai: {
    isPro: boolean;
    /** Claude reachable (credits present, breaker closed). */
    reachable: boolean;
    /** Pro units left this period for study picks. */
    remaining: number;
    limit: number;
  };
}

export type AiPicksResult =
  | { ok: true; recommendations: StudyRecommendation[]; remaining: number }
  | { ok: false; reason: "not_pro" | "quota" | "no_credits" | "unavailable" | "empty" };
