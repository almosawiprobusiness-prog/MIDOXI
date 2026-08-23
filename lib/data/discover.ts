import "server-only";
import { features } from "@/lib/env";
import { searchYoutube, type YoutubeResult } from "@/lib/ai/youtube";
import { aiAvailable, aiStatus, generateJson } from "@/lib/ai/anthropic";
import { addUsage, type AiUsage } from "@/lib/ai/pricing";
import { getMembership, checkFeature } from "@/lib/billing/membership";
import { withinAiBudget } from "@/lib/billing/budget";
import { getProfileSettings } from "./profile";
import { listGoals } from "./development";
import type { DiscoverContext, DiscoverResult, StudyRecommendation } from "./discover-types";

/*
  The Study Engine.

  Two tiers, matching the membership model:

    getDiscover()      — heuristic picks, computed on every load. Free, no quota:
                         position→theme map + keyword/duration ranking over cached
                         YouTube results.
    generateAiPicks()  — the Pro upgrade. Claude drafts sharper search intents and
                         writes a personal "why this matters" per pick. Gated on an
                         active Pro plan AND remaining monthly quota AND Claude being
                         reachable — it consumes exactly one unit per generation.

  Keeping AI off the render path is deliberate: a page load must never burn a
  paid allowance.
*/

const POSITION_THEMES: Record<string, string[]> = {
  gk: ["goalkeeper distribution", "goalkeeper positioning analysis", "sweeper keeper"],
  cb: ["centre back positioning analysis", "defending 1v1 masterclass", "centre back build up play"],
  fb: ["fullback overlapping runs", "modern fullback tactical analysis", "defending wide 1v1"],
  rb: ["fullback overlapping runs", "modern fullback tactical analysis", "defending wide 1v1"],
  lb: ["fullback overlapping runs", "modern fullback tactical analysis", "defending wide 1v1"],
  wb: ["wingback attacking runs analysis", "wingback defensive positioning"],
  dm: ["defensive midfielder positioning analysis", "pivot receiving under pressure", "screening the defence"],
  cm: ["central midfielder movement analysis", "midfield scanning receiving on the half turn", "box to box midfielder"],
  am: ["attacking midfielder between the lines", "number 10 movement analysis", "playmaker final third"],
  rw: ["winger 1v1 dribbling analysis", "inverted winger movement", "winger cutting inside finishing"],
  lw: ["winger 1v1 dribbling analysis", "inverted winger movement", "winger cutting inside finishing"],
  wing: ["winger 1v1 dribbling analysis", "inverted winger movement"],
  cf: ["striker movement off the ball analysis", "centre forward finishing masterclass", "striker pressing from the front"],
  st: ["striker movement off the ball analysis", "centre forward finishing masterclass", "striker hold up play"],
  fw: ["striker movement off the ball analysis", "forward finishing masterclass"],
};

const CATEGORY_FLAVOUR: Record<string, string> = {
  technical: "technique tutorial",
  tactical: "tactical analysis",
  physical: "football speed agility training",
  mental: "football game intelligence",
  positional: "positioning analysis",
};

const QUALITY_WORDS = ["analysis", "breakdown", "masterclass", "tutorial", "movement", "explained", "how to", "coaching", "tactical"];
const NOISE_WORDS = ["#shorts", "shorts", "funny", "reaction", "fifa", "efootball", "compilation goals"];

type GoalObj = { title: string; category: string };

function themesFor(position: string): string[] {
  const p = position.toLowerCase().replace(/[^a-z]/g, "");
  for (const key of Object.keys(POSITION_THEMES)) {
    if (p.startsWith(key)) return POSITION_THEMES[key];
  }
  return ["football tactical analysis", "football movement off the ball"];
}

function heuristicIntents(position: string, goals: GoalObj[]): string[] {
  const themes = themesFor(position);
  const intents = [themes[0]];
  const g = goals[0];
  if (g) intents.push(`${g.title} football ${CATEGORY_FLAVOUR[g.category] ?? "analysis"}`);
  if (themes[1]) intents.push(themes[1]);
  if (goals[1]) intents.push(`${goals[1].title} football drill`);
  return [...new Set(intents.map((s) => s.trim()).filter(Boolean))].slice(0, 4);
}

function heuristicScore(r: YoutubeResult, intents: string[], goalWords: string[]): number {
  const hay = `${r.title} ${r.description} ${r.channel}`.toLowerCase();
  let score = 0;
  for (const w of QUALITY_WORDS) if (hay.includes(w)) score += 2;
  for (const w of NOISE_WORDS) if (hay.includes(w)) score -= 4;
  for (const w of goalWords) if (w.length > 3 && hay.includes(w)) score += 3;
  for (const intent of intents) {
    for (const tok of intent.toLowerCase().split(/\s+/)) {
      if (tok.length > 3 && hay.includes(tok)) score += 1;
    }
  }
  const d = r.durationSeconds;
  if (d != null) {
    if (d >= 240 && d <= 1500) score += 3;
    else if (d < 90) score -= 3;
    else if (d > 3000) score -= 1;
  }
  return score;
}

function heuristicReason(r: YoutubeResult, position: string, matchedGoal: string | null): string {
  if (matchedGoal) return `Speaks to your goal “${matchedGoal}”.`;
  const mins = r.durationSeconds ? Math.round(r.durationSeconds / 60) : null;
  return `A ${mins ? `${mins}-min ` : ""}study pick for a ${position || "player"} — analysis over highlights.`;
}

async function buildContextInputs() {
  const [profile, goals] = await Promise.all([getProfileSettings(), listGoals()]);
  const position = profile.primaryPosition || "";
  const active = goals.filter((g) => g.status !== "achieved");
  const goalObjs: GoalObj[] = active.map((g) => ({ title: g.title, category: String(g.category) }));
  return { position, goalObjs, goalTitles: goalObjs.map((g) => g.title), strengths: profile.strengths ?? [] };
}

async function poolFor(intents: string[]): Promise<YoutubeResult[]> {
  const batches = await Promise.all(intents.map((q) => searchYoutube(q, 6)));
  const seen = new Set<string>();
  const pool: YoutubeResult[] = [];
  for (const batch of batches) {
    for (const r of batch) {
      if (seen.has(r.videoId)) continue;
      seen.add(r.videoId);
      pool.push(r);
    }
  }
  return pool;
}

// ---------------- heuristic (load path) ----------------

export async function getDiscover(): Promise<DiscoverResult> {
  const { position, goalObjs, goalTitles } = await buildContextInputs();
  const intents = heuristicIntents(position, goalObjs);
  const context: DiscoverContext = { position, goals: goalTitles, intents };

  const [membership, gate, underBudget] = await Promise.all([
    getMembership(),
    checkFeature("study_discoveries"),
    withinAiBudget(),
  ]);
  const ai = {
    isPro: membership.isPro,
    reachable: aiAvailable() && underBudget,
    remaining: Math.max(0, (gate.limit ?? 0) - (gate.used ?? 0)),
    limit: gate.limit ?? 0,
  };

  if (!features.youtube) {
    return { recommendations: [], engine: "heuristic", context, youtubeEnabled: false, ai };
  }

  const pool = await poolFor(intents);
  const goalWords = goalTitles.join(" ").toLowerCase().split(/\s+/);
  const ranked = [...pool].sort(
    (a, b) => heuristicScore(b, intents, goalWords) - heuristicScore(a, intents, goalWords),
  );

  const recommendations: StudyRecommendation[] = ranked.slice(0, 6).map((r) => {
    const matchedGoal =
      goalTitles.find((t) => {
        const words = t.toLowerCase().split(/\s+/).filter((w) => w.length > 3);
        return words.some((w) => r.title.toLowerCase().includes(w));
      }) ?? null;
    return {
      videoId: r.videoId,
      title: r.title,
      channel: r.channel,
      thumbnailUrl: r.thumbnailUrl,
      url: r.url,
      durationSeconds: r.durationSeconds,
      reason: heuristicReason(r, position, matchedGoal),
      matchedGoal,
      theme: matchedGoal ? "Goal" : "Position",
    };
  });

  return { recommendations, engine: "heuristic", context, youtubeEnabled: true, ai };
}

// ---------------- AI (metered Pro path) ----------------

/*
  The cheap first call: turn a player into search intents. It runs on Haiku and
  its tokens used to vanish — the caller only ever reported the ranking call, so
  the global budget ceiling was reading a number that was too small. It now
  hands its usage back to be summed.
*/
async function aiIntents(
  position: string,
  goals: GoalObj[],
  strengths: string[],
): Promise<{ queries: string[] | null; usage: AiUsage | null }> {
  const res = await generateJson<{ queries: string[] }>({
    tier: "fast",
    system:
      "You are a football performance analyst. Given a player's position, active development goals and strengths, produce 3-4 concise YouTube search queries that surface the most useful FILM ANALYSIS and coaching content for them to study. Favour tactical breakdowns, movement analysis and technique masterclasses over highlight reels. Return JSON only.",
    prompt: JSON.stringify({ position, goals: goals.map((g) => `${g.title} (${g.category})`), strengths }),
    schema: {
      type: "object",
      additionalProperties: false,
      properties: { queries: { type: "array", items: { type: "string" } } },
      required: ["queries"],
    },
    maxTokens: 400,
  });
  if (!res.ok) return { queries: null, usage: null };
  const q = (res.data.queries ?? []).filter((s) => typeof s === "string" && s.trim()).slice(0, 4);
  return { queries: q.length ? q : null, usage: res.usage };
}


/**
 * The metered AI generation. Consume must already have succeeded (caller gates
 * via `consumeFeature`). Returns AI-reranked, personally-reasoned picks, or a
 * typed failure so the caller can refund/skip.
 */
export type RunAiPicksResult =
  | { ok: true; recommendations: StudyRecommendation[]; usage: AiUsage }
  /** `usage` is present even on failure — tokens spent before giving up still cost money. */
  | { ok: false; reason: "no_credits" | "unavailable" | "empty"; usage?: AiUsage };

export async function runAiPicks(): Promise<RunAiPicksResult> {
  if (!aiAvailable()) {
    const r = aiStatus().reason;
    return { ok: false, reason: r === "no_credits" ? "no_credits" : "unavailable" };
  }
  // Hard monthly spend ceiling — off switch for everyone once crossed.
  if (!(await withinAiBudget())) return { ok: false, reason: "unavailable" };
  const { position, goalObjs, goalTitles, strengths } = await buildContextInputs();
  const intentRes = await aiIntents(position, goalObjs, strengths);
  const intents = intentRes.queries ?? heuristicIntents(position, goalObjs);
  const spent = intentRes.usage;
  if (!features.youtube) return { ok: false, reason: "empty", usage: addUsage(spent) };

  const pool = await poolFor(intents);
  if (pool.length === 0) return { ok: false, reason: "empty", usage: addUsage(spent) };

  const goalWords = goalTitles.join(" ").toLowerCase().split(/\s+/);
  const slice = [...pool]
    .sort((a, b) => heuristicScore(b, intents, goalWords) - heuristicScore(a, intents, goalWords))
    .slice(0, 10);

  const ai = await generateJson<{
    picks: { videoId: string; reason: string; goal?: string | null; theme?: string }[];
  }>({
    tier: "standard",
    system:
      "You are a football performance coach curating a study reel. From the candidate videos choose the 4-6 most useful for THIS player and, for each, write ONE short sentence (max 18 words) on why it matters for their position and goals. Map to a goal when relevant. Prefer tactical/technical analysis over highlights. Return JSON only, referencing videos by videoId.",
    prompt: JSON.stringify({
      player: { position, goals: goalTitles, strengths },
      candidates: slice.map((r) => ({
        videoId: r.videoId,
        title: r.title,
        channel: r.channel,
        durationSeconds: r.durationSeconds,
        description: r.description.slice(0, 200),
      })),
    }),
    schema: {
      type: "object",
      additionalProperties: false,
      properties: {
        picks: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              videoId: { type: "string" },
              reason: { type: "string" },
              goal: { type: ["string", "null"] },
              theme: { type: "string" },
            },
            required: ["videoId", "reason"],
          },
        },
      },
      required: ["picks"],
    },
    maxTokens: 900,
  });

  if (!ai.ok) {
    return {
      ok: false,
      reason: ai.reason === "no_credits" ? "no_credits" : "unavailable",
      usage: addUsage(spent),
    };
  }

  const byId = new Map(slice.map((r) => [r.videoId, r]));
  const recommendations: StudyRecommendation[] = [];
  for (const pick of ai.data.picks ?? []) {
    const r = byId.get(pick.videoId);
    if (!r) continue;
    recommendations.push({
      videoId: r.videoId,
      title: r.title,
      channel: r.channel,
      thumbnailUrl: r.thumbnailUrl,
      url: r.url,
      durationSeconds: r.durationSeconds,
      reason: pick.reason?.trim() || heuristicReason(r, position, null),
      matchedGoal: pick.goal ?? null,
      theme: pick.theme || "Study",
    });
  }
  const usage = addUsage(spent, ai.usage);
  if (!recommendations.length) return { ok: false, reason: "empty", usage };
  return { ok: true, recommendations, usage };
}
