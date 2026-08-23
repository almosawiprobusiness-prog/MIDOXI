import "server-only";
import { checkFeature } from "@/lib/billing/membership";
import { refusalReason } from "@/lib/billing/gate-copy";
import { consumeFeature, logAiUsage, releaseFeature } from "@/lib/billing/meter";
import { withinAiBudget } from "@/lib/billing/budget";
import { CONCEPTS } from "@/lib/knowledge/concepts";
import { features } from "@/lib/env";
import {
  CLIP_MAX_SECONDS,
  clipLengthIssue,
  type AnalysisObservation,
  type AnalysisOutcome,
  type AnalysisRequest,
  type ProviderStatus,
  type VideoAnalysisProvider,
} from "./provider";
import {
  MAX_SOURCE_BYTES,
  VIDEO_MODEL,
  geminiConfigured,
  generateFromVideo,
  isYouTube,
  uploadFromUrl,
  waitReady,
} from "./gemini";
import { cachedFileFor, rememberFile } from "@/lib/data/video-files";
import { listMemory } from "@/lib/data/memory";
import { memoryPromptBlock } from "@/lib/data/memory-types";

/*
  Reading the clip, not stills of it.

  The difference is the whole point. A frame reader is handed twelve moments
  and has to guess what joined them. This is handed the passage: it can see the
  shoulder check happen before the pass, the defender's head turn, the moment a
  run started. Those are the things worth telling a player about, and they live
  between frames.

  What has NOT changed:

  · This is still interpretation, not measurement. No distances, no speeds, no
    positions. The prompt forbids it and the saved row records `kind: 'video'`
    so it can never be mistaken for tracking data later.

  · The hardest problem is unchanged too, and no model solves it: on amateur
    footage, working out which player is the one watching.

    This was tested against real Sunday-league footage and the first design
    FAILED. Asked "did you identify them?" as a yes/no alongside the real work,
    the model answered `true` for "number 9 in red" AND for "number 9 in
    yellow" on the same forty-five seconds, and wrote confident second-person
    coaching about both. It was agreeing with whoever asked.

    Asked instead to AUDIT its own identification — as the task rather than a
    side-field — the same model on the same clip said: squad numbers are not
    legible, the basis is kit colour alone, and ten other players match the
    description equally well.

    So MIDO no longer asks the model how sure it is. It asks what EVIDENCE the
    model has, and derives the ceiling in code from that. A model's confidence
    is an opinion; "can you read the number on the shirt" is a fact about the
    footage. Only the second one is safe to build on.
*/

const SYSTEM = `You are MIDO, reading football film for one person.

You are watching an actual passage of video, not stills. You can see movement, sequence and timing.

HARD RULES — these are not style preferences:
- NEVER state distances, speeds, or any measurement. You are watching video, not tracking data. "He covers 8 metres" would be fabrication.
- NEVER name real players, teams or competitions. You do not know who these people are.
- Anchor every observation to a timestamp in MM:SS as it appears in the video.
- FIRST, before anything else, audit whether you can actually pick the viewer out, and report it in "identification". Be literal and do not be agreeable:
    · "squadNumberLegible" — can you genuinely READ numbers on shirts in this footage? In amateur video shot from the touchline, you usually cannot. If you cannot, say false.
    · "basis" — "squad-number" only if you actually read their number. "kit-and-role" if all you have is their kit colour and position. "none" if you have neither.
    · "couldMatchOthers" — how many OTHER players on the pitch fit the description just as well. If eleven players wear red and you cannot read numbers, that is 10.
  Getting this wrong is the worst thing you can do here. Agreeing that you found someone you did not find produces confident coaching aimed at a stranger.
- Set "aboutViewer" true on any observation that describes the viewer specifically, and false on observations about the passage, a team, or play in general.
- Mark every observation:
    "observed"  — it happens in the film and you could point at it
    "inferred"  — it follows from what is visible, but it is your judgement
    "uncertain" — the film does not settle it, or you are unsure which player is the viewer
  Be strict. Most useful observations are "observed" or "inferred"; reach for "uncertain" whenever identity or occlusion is in doubt.
- Where an observation matches one of the curated football concepts provided, name it by its slug.
- If you are given observations from this player's earlier clips, say explicitly whether the same thing is happening again, or whether it is not — "this is the third clip where..." or "this does not happen here". That comparison is the most valuable thing you can produce.
- Write like a coach at a screen: concrete, specific, usable in the next session. No hype, no encouragement padding.

Each observation: a short title, then 2-3 sentences.`;

/** Gemini's schema dialect is the OpenAPI subset — no additionalProperties. */
const SCHEMA = {
  type: "object",
  properties: {
    summary: { type: "string" },
    /*
      Evidence, not opinion. "Did you identify them?" is a question the model
      answers agreeably; "can you read the number on the shirt" is a question
      about the footage, and it answers that one straight.
    */
    identification: {
      type: "object",
      properties: {
        squadNumberLegible: {
          type: "boolean",
          description: "Can you actually READ squad numbers on shirts in this footage?",
        },
        basis: {
          type: "string",
          enum: ["squad-number", "kit-and-role", "none"],
          description: "What you actually used to pick the viewer out.",
        },
        couldMatchOthers: {
          type: "integer",
          description: "How many OTHER players on the pitch fit the description equally well.",
        },
      },
      required: ["squadNumberLegible", "basis", "couldMatchOthers"],
    },
    observations: {
      type: "array",
      items: {
        type: "object",
        properties: {
          atSeconds: { type: "number" },
          title: { type: "string" },
          body: { type: "string" },
          concept: { type: "string" },
          confidence: { type: "string", enum: ["observed", "inferred", "uncertain"] },
          aboutViewer: {
            type: "boolean",
            description: "True if this describes the viewer specifically rather than the passage.",
          },
        },
        required: ["atSeconds", "title", "body", "confidence", "aboutViewer"],
      },
    },
  },
  required: ["summary", "observations", "identification"],
} as const;

interface VideoAnswer {
  summary: string;
  identification?: {
    squadNumberLegible?: boolean;
    basis?: "squad-number" | "kit-and-role" | "none";
    couldMatchOthers?: number;
  };
  observations: {
    atSeconds: number;
    title: string;
    body: string;
    concept?: string;
    confidence?: AnalysisObservation["confidence"];
    aboutViewer?: boolean;
  }[];
}

function mmss(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

export const nativeVideo: VideoAnalysisProvider = {
  id: "gemini-video",
  label: "MIDO video reading",
  kind: "video",
  capabilities: ["video-reading"],
  describes:
    "The passage itself — movement, sequence and timing. It can see a shoulder check before a pass, a run starting, a defender's head turning.",
  cannot:
    "Measure anything, and identify you reliably on its own. Tell it your kit and number, and anything it still cannot settle comes back marked uncertain rather than guessed.",

  async status(): Promise<ProviderStatus> {
    const gate = await checkFeature("deep_analyses");
    if (!gate.allowed) {
      // One source of copy, so the refusal names a plan that exists and says
      // what it costs. See lib/billing/gate-copy.ts.
      return { available: false, reason: refusalReason(gate, "deep_analyses", "player") };
    }
    if (!geminiConfigured()) {
      return {
        available: false,
        reason:
          "Reading the clip itself needs a video model, which is not configured on this deployment. Frame reading still works and is unaffected.",
      };
    }
    if (!(await withinAiBudget())) {
      return { available: false, reason: "AI analysis is paused this month." };
    }
    return { available: true };
  },

  async analyse(request: AnalysisRequest): Promise<AnalysisOutcome> {
    const status = await this.status();
    if (!status.available) return { ok: false, error: status.reason ?? "Analysis is unavailable." };

    const lengthIssue = clipLengthIssue(request.fromSeconds, request.toSeconds);
    if (lengthIssue) return { ok: false, error: lengthIssue };

    if (!request.sourceUrl) {
      return { ok: false, error: "That video has no readable source." };
    }

    // ── get the film in front of the model ──────────────────
    const resolved = await resolveSource(request);
    if (!resolved.ok) return { ok: false, error: resolved.error };

    if (!(await consumeFeature("deep_analyses"))) {
      return { ok: false, error: "Film analysis is unavailable on this plan." };
    }

    const started = Date.now();
    const concepts = CONCEPTS.filter((c) => request.viewer.concepts.includes(c.slug)).slice(0, 6);
    const prior = (request.priorObservations ?? []).slice(0, 8);

    /*
      What MIDO already knows about this player, appended to the system prompt.

      It goes in the SYSTEM block rather than the user turn because that block
      is cached for an hour — so a player reading five clips in an evening pays
      for their memory once. It is also the right place semantically: these are
      standing facts, not part of this particular question.
    */
    const memory = memoryPromptBlock(await listMemory());

    const res = await generateFromVideo<VideoAnswer>({
      system: memory ? `${SYSTEM}

${memory}` : SYSTEM,
      video: {
        fileUri: resolved.fileUri,
        mimeType: resolved.mimeType,
        startSeconds: request.fromSeconds,
        endSeconds: request.toSeconds,
      },
      schema: SCHEMA as unknown as Record<string, unknown>,
      // Thinking is charged against this. See the note in gemini.ts.
      maxTokens: 6000,
      prompt: JSON.stringify({
        // Stated in the prompt as well as in the request metadata: if the
        // range had to be dropped, this is what keeps the read on the right
        // passage.
        watch: `From ${mmss(request.fromSeconds)} to ${mmss(request.toSeconds)}.`,
        lookingFor:
          request.focus || "Anything useful about movement, body shape and decision-making.",
        viewer: {
          role: request.viewer.role,
          position: request.viewer.position,
          onThePitch:
            request.viewer.identity ||
            "NOT STATED — you do not know which player this is. Write about the passage and mark identity-dependent observations uncertain.",
        },
        curatedConcepts: concepts.map((c) => ({
          slug: c.slug,
          name: c.name,
          looksLike: c.looksLike,
          cues: c.cues,
        })),
        earlierObservations: prior.length
          ? prior.map((p) => ({ on: p.on, concept: p.concept, said: p.title }))
          : undefined,
      }),
    });

    const usage = res.ok ? res.value.usage : { input: 0, output: 0, thoughts: 0 };
    await logAiUsage({
      feature: "deep_analyses",
      tier: "video",
      model: VIDEO_MODEL,
      inputTokens: usage.input,
      outputTokens: usage.output,
      latencyMs: Date.now() - started,
      status: res.ok ? "ok" : "error",
    });

    if (!res.ok) {
      // The player has already been charged a film read at this point. If the
      // model never ran — rate limited, unreachable, refused the request — that
      // charge is for nothing, so give it back. A read that RAN and came back
      // useless is a different thing and is not refunded below.
      await releaseFeature("deep_analyses");
      return { ok: false, error: res.error };
    }

    const valid = new Set(CONCEPTS.map((c) => c.slug));
    const answer = res.value.data;
    const identity = identityCeiling(answer, Boolean(request.viewer.identity));

    const observations: AnalysisObservation[] = (answer.observations ?? [])
      .slice(0, 10)
      .map((o) => ({
        atSeconds: normaliseTimestamp(Number(o.atSeconds), request.fromSeconds, request.toSeconds),
        title: (o.title ?? "").slice(0, 120),
        body: (o.body ?? "").slice(0, 700),
        concept: o.concept && valid.has(o.concept) ? o.concept : undefined,
        // Only claims ABOUT the viewer are capped. An observation about the
        // shape of a passage does not depend on knowing who anyone is, and
        // demoting it would understate something the film genuinely shows.
        confidence:
          o.aboutViewer === false
            ? (o.confidence ?? "observed")
            : atMost(o.confidence ?? "observed", identity.ceiling),
      }))
      .filter((o) => o.title && o.body)
      .sort((a, b) => a.atSeconds - b.atSeconds);

    if (!observations.length) {
      return { ok: false, error: "The read came back empty. Try a different passage or a clearer angle." };
    }

    const notes: string[] = [];
    if (identity.note) notes.push(identity.note);
    if (res.value.rangeInPromptOnly) {
      notes.push("The whole video was read and the passage located from the timestamps.");
    }

    return {
      ok: true,
      result: {
        kind: "video",
        provider: nativeVideo.id,
        model: res.value.model,
        summary: [answer.summary ?? "", ...notes].filter(Boolean).join("\n\n"),
        observations,
        framesUsed: 0,
      },
    };
  },
};

const RANK: Record<NonNullable<AnalysisObservation["confidence"]>, number> = {
  observed: 3,
  inferred: 2,
  uncertain: 1,
};

/** Never raise a confidence, only lower it to the ceiling. */
function atMost(
  claimed: NonNullable<AnalysisObservation["confidence"]>,
  ceiling: NonNullable<AnalysisObservation["confidence"]>,
): NonNullable<AnalysisObservation["confidence"]> {
  return RANK[claimed] > RANK[ceiling] ? ceiling : claimed;
}

/*
  How confident a claim ABOUT THE VIEWER is allowed to be.

  The short answer is: never "observed". That is a deliberate ceiling and it is
  worth explaining, because it looks like under-selling a working feature.

  Tested on real Sunday-league footage, twice:

    · Asked "did you identify them?", the model said yes for "number 9 in red"
      AND "number 9 in yellow" on the same forty-five seconds, and wrote
      confident second-person coaching about both.

    · Asked instead what evidence it had, it was mostly honest — "squad numbers
      are not legible, kit colour only, nine other players fit". But on a
      re-run it claimed the opposite for the other team: numbers legible, nobody
      else fits. On footage where the audit had already established that
      numbers cannot be read at all.

  So asking for evidence is better than asking for confidence, and still not
  something to hang a factual claim on. Which leaves the accurate label: if
  MIDO cannot be sure the player is you, then "you curved your run at 30:28" is
  a judgement, not a pointable fact. `inferred` is not a downgrade — it is what
  the sentence actually is.

  `observed` stays reachable for observations about the passage itself, which
  do not depend on knowing who anyone is. That is where it belongs.

  What would move this: footage where numbers are genuinely legible, or the
  player marking themselves in a frame. Both are real routes and neither is
  built yet.
*/
function identityCeiling(
  answer: VideoAnswer,
  askedFor: boolean,
): { ceiling: NonNullable<AnalysisObservation["confidence"]>; note: string | null } {
  if (!askedFor) {
    return {
      ceiling: "uncertain",
      note: "You have not said which player you are, so this is a read of the passage rather than of you. Add it in your profile and MIDO reads your game instead.",
    };
  }

  const id = answer.identification;
  const others = Math.max(0, Number(id?.couldMatchOthers ?? 0) || 0);

  if (id?.basis === "none") {
    return {
      ceiling: "uncertain",
      note: "MIDO could not pick you out of this footage at all, so nothing here is claimed to be about you. A closer angle would change that.",
    };
  }

  return {
    ceiling: "inferred",
    note:
      "MIDO went on the kit and position you gave it" +
      (others > 0 ? `, and ${others} other players on the pitch fit that description too` : "") +
      ". Anything about you is read on that basis rather than confirmed as yours — squad numbers are not reliably legible in footage like this.",
  };
}

/*
  Put a timestamp back into the video's own frame of reference.

  Measured on real footage: with `videoMetadata` clipping in play, the model
  sometimes returns absolute video time (1822 for a clip starting at 1800) and
  sometimes time relative to the clip (22). The old code clamped into
  [from, to], which silently collapsed every relative timestamp onto the first
  second of the clip — so every observation pointed at the same moment and the
  seek button went nowhere.

  A value that is not in the window but IS within its length is relative. Fix
  it rather than crushing it.
*/
function normaliseTimestamp(value: number, from: number, to: number): number {
  if (!Number.isFinite(value)) return from;
  if (value >= from && value <= to) return value;
  const span = to - from;
  if (value >= 0 && value <= span) return from + value;
  return Math.max(from, Math.min(to, value));
}

// ---------------------------------------------------------------------------
// Getting the film to the model
// ---------------------------------------------------------------------------

type Resolved = { ok: true; fileUri: string; mimeType: string } | { ok: false; error: string };

/*
  Three source shapes, and only one of them costs anything.

  YouTube passes straight through — the model fetches it, nothing is uploaded,
  and there is no size ceiling. That matters more than it sounds: amateur clubs
  put full matches on YouTube constantly, and it is the cheapest path in the
  product.

  An upload has to be forwarded once. The resulting handle is cached against
  the video row, so a player reading five passages from one match uploads once
  rather than five times — which is the difference between this being usable
  and being a novelty.
*/
async function resolveSource(request: AnalysisRequest): Promise<Resolved> {
  const url = request.sourceUrl!;

  if (isYouTube(url)) {
    return { ok: true, fileUri: url, mimeType: "video/mp4" };
  }

  const cached = await cachedFileFor(request.videoId);
  if (cached) return { ok: true, fileUri: cached.uri, mimeType: cached.mimeType };

  const uploaded = await uploadFromUrl(url, request.source?.title ?? "MIDO clip");
  if (!uploaded.ok) return { ok: false, error: uploaded.error };

  const ready =
    uploaded.value.state === "ACTIVE"
      ? { ok: true as const, value: uploaded.value }
      : await waitReady(uploaded.value.name);
  if (!ready.ok) return { ok: false, error: ready.error };

  await rememberFile(request.videoId, ready.value.uri, ready.value.mimeType);
  return { ok: true, fileUri: ready.value.uri, mimeType: ready.value.mimeType };
}

// ---------------------------------------------------------------------------
// What the film room shows about this provider
// ---------------------------------------------------------------------------

/** Whether native reading could run at all on this deployment. */
export function nativeVideoConfigured(): boolean {
  return features.nativeVideo;
}

export const NATIVE_LIMITS = {
  maxSeconds: CLIP_MAX_SECONDS,
  maxUploadMb: MAX_SOURCE_BYTES / 1024 / 1024,
};
