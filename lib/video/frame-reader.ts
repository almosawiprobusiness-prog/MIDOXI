import "server-only";
import { generateJson, aiAvailable, aiStatus } from "@/lib/ai/anthropic";
import { checkFeature } from "@/lib/billing/membership";
import { refusalReason } from "@/lib/billing/gate-copy";
import { consumeFeature, logAiUsage, releaseFeature } from "@/lib/billing/meter";
import { withinAiBudget } from "@/lib/billing/budget";
import { CONCEPTS } from "@/lib/knowledge/concepts";
import { MAX_FRAMES, type AnalysisOutcome, type AnalysisRequest, type ProviderStatus, type VideoAnalysisProvider } from "./provider";

/*
  MIDO's frame reader.

  Samples of the film are sent to Claude as images, with the timestamp each one
  came from. What comes back is a reading of what is visible: body shape before
  receiving, whether a defender's head had turned, where a run started.

  What it is not: tracking. It cannot measure distance, speed or position, and
  the prompt forbids it from implying otherwise. Every observation it produces
  is labelled MIDO analysis in the interface, exactly like a study module.
*/

const SYSTEM = `You are MIDO, analysing football film for one person.

You are given still frames sampled from a short passage of video, each labelled with the second it came from. You describe what is visible in them.

HARD RULES — these are not style preferences:
- NEVER state distances, speeds, or measurements of any kind. You are looking at stills; you cannot measure. Saying "he covers 8 metres" would be fabrication.
- NEVER name players, teams or competitions. You do not know who these people are.
- NEVER claim to see something that is not in the frames. If the frames do not show whether a defender turned, say the frames do not show it.
- Sampled frames have gaps between them. Talk about what changed BETWEEN frames, and be explicit that the moments in between were not seen.
- Anchor every observation to one of the given timestamps.
- Write like a coach at a screen: concrete, specific, useful in the next session. No hype.
- Where an observation matches one of the curated football concepts provided, name it.

Each observation: a short title, then 2-3 sentences.`;

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    summary: { type: "string" },
    observations: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          atSeconds: { type: "number" },
          title: { type: "string" },
          body: { type: "string" },
          concept: { type: "string" },
        },
        required: ["atSeconds", "title", "body"],
      },
    },
  },
  required: ["summary", "observations"],
} as const;

export const frameReader: VideoAnalysisProvider = {
  id: "mido-frames",
  label: "MIDO frame reading",
  kind: "frames",
  capabilities: ["frame-reading"],
  describes:
    "What is visible in the film — body shape, positioning, movement between frames, and what it means for your game.",
  cannot:
    "Measure anything. No distances, speeds or positions, and no view of what happened between sampled frames.",

  async status(): Promise<ProviderStatus> {
    const gate = await checkFeature("deep_analyses");
    if (!gate.allowed) {
      // One source of copy, so the refusal names a plan that exists and says
      // what it costs. See lib/billing/gate-copy.ts.
      return { available: false, reason: refusalReason(gate, "deep_analyses", "player") };
    }
    if (!aiAvailable()) {
      return {
        available: false,
        reason:
          aiStatus().reason === "no_credits"
            ? "MIDO's vision model is unreachable right now. Your clips and notes are unaffected."
            : "MIDO's vision model is disabled.",
      };
    }
    if (!(await withinAiBudget())) {
      return { available: false, reason: "AI analysis is paused this month." };
    }
    return { available: true };
  },

  async analyse(request: AnalysisRequest): Promise<AnalysisOutcome> {
    if (!request.frames.length) {
      return { ok: false, error: "No frames were captured from that range." };
    }

    const status = await this.status();
    if (!status.available) return { ok: false, error: status.reason ?? "Analysis is unavailable." };
    if (!(await consumeFeature("deep_analyses"))) {
      return { ok: false, error: "Film analysis is unavailable on this plan." };
    }

    const frames = request.frames.slice(0, MAX_FRAMES);
    const started = Date.now();

    // Only the concepts the viewer is actually working on, so the reading is
    // pointed rather than a tour of the whole graph.
    const concepts = CONCEPTS.filter((c) => request.viewer.concepts.includes(c.slug)).slice(0, 6);

    const res = await generateJson<{
      summary: string;
      observations: { atSeconds: number; title: string; body: string; concept?: string }[];
    }>({
      tier: "standard",
      system: SYSTEM,
      images: frames.map((f) => ({ mediaType: f.mediaType, data: f.data })),
      prompt: JSON.stringify({
        instruction:
          "The frames above are in order. Each corresponds to the timestamp at the same index in frameTimestamps.",
        frameTimestamps: frames.map((f) => f.atSeconds),
        range: { from: request.fromSeconds, to: request.toSeconds },
        lookingFor: request.focus || "Anything useful about movement, body shape and decision-making.",
        viewer: {
          role: request.viewer.role,
          position: request.viewer.position,
        },
        curatedConcepts: concepts.map((c) => ({
          slug: c.slug,
          name: c.name,
          looksLike: c.looksLike,
          cues: c.cues,
        })),
      }),
      schema: SCHEMA as unknown as Record<string, unknown>,
      maxTokens: 2000,
    });

    await logAiUsage({
      feature: "deep_analyses",
      tier: "standard",
      inputTokens: res.ok ? res.usage.input : 0,
      outputTokens: res.ok ? res.usage.output : 0,
      cacheReadTokens: res.ok ? res.usage.cacheRead : 0,
      cacheWriteTokens: res.ok ? res.usage.cacheWrite : 0,
      latencyMs: Date.now() - started,
      status: res.ok ? "ok" : "error",
    });

    if (!res.ok) {
      // Charged before the call, and the call never produced anything. Same
      // rule as the video reader: refund a failure that is ours.
      await releaseFeature("deep_analyses");
      return {
        ok: false,
        error:
          res.reason === "no_credits"
            ? "MIDO's vision model is unreachable right now. Nothing was charged against your allowance."
            : "The analysis did not come back. Try a shorter range.",
      };
    }

    const valid = new Set(CONCEPTS.map((c) => c.slug));
    const observations = (res.data.observations ?? [])
      .slice(0, 10)
      .map((o) => ({
        atSeconds: Math.max(request.fromSeconds, Math.min(request.toSeconds, Number(o.atSeconds) || request.fromSeconds)),
        title: (o.title ?? "").slice(0, 120),
        body: (o.body ?? "").slice(0, 600),
        // Only keep a concept the graph actually knows.
        concept: o.concept && valid.has(o.concept) ? o.concept : undefined,
      }))
      .filter((o) => o.title && o.body)
      .sort((a, b) => a.atSeconds - b.atSeconds);

    if (!observations.length) {
      return { ok: false, error: "The analysis came back empty. Try a shorter range or a clearer angle." };
    }

    return {
      ok: true,
      result: {
        kind: "frames",
        provider: frameReader.id,
        model: "claude-sonnet-5",
        summary: res.data.summary ?? "",
        observations,
        framesUsed: frames.length,
      },
    };
  },
};
