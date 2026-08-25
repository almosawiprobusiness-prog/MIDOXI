"use server";

import { revalidatePath } from "next/cache";
import { frameReader } from "@/lib/video/frame-reader";
import { nativeVideo, NATIVE_LIMITS } from "@/lib/video/native-video";
import { providerOffers, TRACKING_GAP } from "@/lib/video/registry";
import {
  MAX_FRAMES,
  CLIP_MIN_SECONDS,
  CLIP_MAX_SECONDS,
  clipLengthIssue,
  type AnalysisFrame,
  type AnalysisObservation,
} from "@/lib/video/provider";
import { saveAnalysis, deleteAnalysis, priorObservations, type ClipAnalysis } from "@/lib/data/analyses";
import { getVideoWithClips } from "@/lib/data/film";
import { getProfileSettings } from "@/lib/data/profile";
import { checkFeature } from "@/lib/billing/membership";
import { allowanceLabel } from "@/lib/billing/gate-copy";
import { listGoals } from "@/lib/data/development";
import { currentViewer } from "@/lib/data/studies";
import { conceptsForPosition } from "@/lib/knowledge/graph";
import { conceptsForGoals } from "@/lib/knowledge/mapping";
import { createClip } from "@/app/app/film-room/actions";
import { emitMidoEvent } from "@/lib/events/emit";
import { idempotencyKey } from "@/lib/events/types";

/*
  Running an analysis.

  Two readers, two very different shapes.

  FRAMES  — the browser captures twelve stills from the video the user already
            has and posts them here. Nothing leaves the browser except images,
            no video processing happens on the server, and it works on any
            deployment with no extra key.

  VIDEO   — the passage itself goes to a video model. For a YouTube source that
            is a URL and nothing more. For an upload the server fetches it from
            storage once and caches the handle, so reading five passages from
            one match uploads it once.

  Both share everything that matters: the same gate, the same metering, the same
  honest refusals, and the same rule that a saved row records which reader
  produced it so a stills read is never mistaken for a motion read later.
*/

export type AnalysisResponse =
  | { ok: true; analysis: ClipAnalysis }
  | { ok: false; error: string };

/** Everything a read needs to know about the person watching. */
async function readerContext(videoId: string, forConcepts?: string[]) {
  const [viewer, profile, goals] = await Promise.all([
    currentViewer(),
    getProfileSettings(),
    listGoals(),
  ]);

  // What this player is working on, preferred over what their position
  // generally implies. A goal they wrote themselves beats a default.
  const fromGoals = conceptsForGoals(goals);
  const fromPosition = conceptsForPosition(viewer.positionGroup)
    .slice(0, 6)
    .map((c) => c.slug);
  const concepts = forConcepts?.length
    ? forConcepts
    : [...new Set([...fromGoals, ...fromPosition])].slice(0, 6);

  return {
    viewer: {
      role: viewer.role,
      position: viewer.position || viewer.positionLabel,
      concepts,
      identity: profile.pitchIdentity || undefined,
    },
    videoId,
  };
}

// ---------------------------------------------------------------------------
// Frames
// ---------------------------------------------------------------------------

export interface AnalyseInput {
  videoId: string;
  fromSeconds: number;
  toSeconds: number;
  fps: number;
  focus: string;
  frames: AnalysisFrame[];
}

export async function analyseFrames(input: AnalyseInput): Promise<AnalysisResponse> {
  if (!input.frames?.length) {
    return { ok: false, error: "No frames were captured. Play the clip once, then try again." };
  }
  const frames = input.frames.slice(0, MAX_FRAMES);
  const ctx = await readerContext(input.videoId);

  const outcome = await frameReader.analyse({
    videoId: input.videoId,
    fromSeconds: input.fromSeconds,
    toSeconds: input.toSeconds,
    frames,
    focus: input.focus,
    viewer: ctx.viewer,
  });

  if (!outcome.ok) return { ok: false, error: outcome.error };

  return save(input.videoId, {
    fromSeconds: input.fromSeconds,
    toSeconds: input.toSeconds,
    fpsSampled: input.fps,
    focus: input.focus,
    outcome: outcome.result,
  });
}

// ---------------------------------------------------------------------------
// Video
// ---------------------------------------------------------------------------

export interface AnalyseVideoInput {
  videoId: string;
  fromSeconds: number;
  toSeconds: number;
  focus: string;
  /**
   * Compare against what MIDO has said before about the same concepts. On by
   * default — it is the whole difference between a reading and a record.
   */
  recheck?: boolean;
}

export async function analyseVideo(input: AnalyseVideoInput): Promise<AnalysisResponse> {
  const lengthIssue = clipLengthIssue(input.fromSeconds, input.toSeconds);
  if (lengthIssue) return { ok: false, error: lengthIssue };

  const detail = await getVideoWithClips(input.videoId);
  if (!detail?.video) return { ok: false, error: "That video could not be found." };
  if (!detail.video.url) return { ok: false, error: "That video has no readable source." };

  const ctx = await readerContext(input.videoId);

  // What MIDO already said about these concepts, on other film. This is item
  // one of the loop: the model is told what it is looking for a second time.
  const prior =
    input.recheck === false
      ? []
      : await priorObservations({
          concepts: ctx.viewer.concepts,
          exceptVideoId: input.videoId,
          limit: 8,
        });

  const outcome = await nativeVideo.analyse({
    videoId: input.videoId,
    fromSeconds: input.fromSeconds,
    toSeconds: input.toSeconds,
    frames: [],
    focus: input.focus,
    viewer: ctx.viewer,
    sourceUrl: detail.video.url,
    source: { kind: detail.video.source, title: detail.video.title },
    priorObservations: prior.map((p) => ({ on: p.on, concept: p.concept, title: p.title })),
  });

  if (!outcome.ok) return { ok: false, error: outcome.error };

  return save(input.videoId, {
    fromSeconds: input.fromSeconds,
    toSeconds: input.toSeconds,
    // A native read samples the film itself; there is no frame budget to
    // report, and reporting one would imply a sampling that did not happen.
    fpsSampled: 0,
    focus: input.focus,
    outcome: outcome.result,
  });
}

async function save(
  videoId: string,
  input: {
    fromSeconds: number;
    toSeconds: number;
    fpsSampled: number;
    focus: string;
    outcome: {
      provider: string;
      model?: string;
      kind: "frames" | "video" | "tracking" | "events";
      summary: string;
      /*
        The real type, not a structural copy of part of it. This was
        written out inline as { atSeconds, title, body, concept? } and
        silently dropped `confidence` and `aboutViewer` — which are
        exactly the fields that decide whether a reading may be
        presented as fact. A hand-copied subset of a type is a place for
        that kind of thing to go missing.
      */
      observations: AnalysisObservation[];
      framesUsed: number;
    };
  },
): Promise<AnalysisResponse> {
  const saved = await saveAnalysis({
    videoId,
    provider: input.outcome.provider,
    model: input.outcome.model,
    kind: input.outcome.kind,
    fromSeconds: input.fromSeconds,
    toSeconds: input.toSeconds,
    framesSampled: input.outcome.framesUsed,
    fpsSampled: input.fpsSampled,
    focus: input.focus,
    summary: input.outcome.summary,
    observations: input.outcome.observations,
  });

  if (!saved) return { ok: false, error: "The analysis ran but could not be saved." };

  /*
    The film reader assembled goals, position, prior studies and the
    knowledge graph to produce this — and until now all of it evaporated
    when the action returned. These two events are what let the next
    recommendation know the footage said something.

    NOTHING THE MODEL WROTE IS COPIED HERE. Not the summary, not an
    observation's body. Those are in `clip_analyses`, reachable by
    `subjectId`, and they are the most sensitive text the film room
    produces — a machine's reading of somebody's own game. Duplicating
    it would double the places it must be protected and deleted.

    What travels is the CONCEPT: which named piece of football each
    observation was about, and how sure the reader was. That is all the
    scorer needs to connect footage to a goal, and it is a curated slug
    rather than free text.
  */
  await emitMidoEvent({
    type: "VIDEO_ANALYZED",
    subjectType: "video",
    subjectId: videoId,
    source: "ai",
    payload: {
      kind: input.outcome.kind,
      fromSeconds: input.fromSeconds,
      toSeconds: input.toSeconds,
      observationCount: input.outcome.observations.length,
    },
    idempotencyKey: idempotencyKey(["video", "analyzed", saved.id]),
  });

  /*
    One event per observation that names a concept.

    Observations without one are skipped rather than recorded as
    unlabelled: an event the scorer cannot match to anything is a row it
    has to read and discard on every query.
  */
  for (const [i, o] of input.outcome.observations.entries()) {
    if (!o.concept) continue;
    await emitMidoEvent({
      type: "FILM_OBSERVATION_CREATED",
      subjectType: "video",
      subjectId: videoId,
      source: "ai",
      payload: {
        concept: o.concept,
        atSeconds: o.atSeconds,
        // Never presented as fact later — see CONFIDENCE_META.
        confidence: o.confidence ?? "observed",
      },
      idempotencyKey: idempotencyKey(["observation", saved.id, String(i)]),
    });
  }

  revalidatePath(`/app/film-room/${videoId}`);
  revalidatePath("/app/timeline");
  return { ok: true, analysis: saved };
}

// ---------------------------------------------------------------------------
// What the film room can offer
// ---------------------------------------------------------------------------

export interface FilmRoomCapabilities {
  providers: Awaited<ReturnType<typeof providerOffers>>;
  tracking: typeof TRACKING_GAP;
  /** Whether the player has said how to find themselves on film. */
  hasIdentity: boolean;
  clip: { minSeconds: number; maxSeconds: number; maxUploadMb: number };
  /**
   * How many film reads are left, said before they run out.
   *
   * A limit somebody only meets by hitting it is not a limit they can plan
   * around — it just takes away whatever they were in the middle of. Null on
   * free, where the refusal already explains the position.
   */
  allowance: { label: string | null; used: number; limit: number; left: number };
}

export async function filmRoomCapabilities(): Promise<FilmRoomCapabilities> {
  const [providers, profile, gate] = await Promise.all([
    providerOffers(),
    getProfileSettings(),
    checkFeature("deep_analyses"),
  ]);
  return {
    providers,
    tracking: TRACKING_GAP,
    hasIdentity: Boolean(profile.pitchIdentity),
    clip: {
      minSeconds: CLIP_MIN_SECONDS,
      maxSeconds: CLIP_MAX_SECONDS,
      maxUploadMb: NATIVE_LIMITS.maxUploadMb,
    },
    allowance: {
      label: allowanceLabel("deep_analyses", gate.used, gate.limit),
      used: gate.used,
      limit: gate.limit,
      left: Math.max(0, gate.limit - gate.used),
    },
  };
}

/** Kept for the existing frame-analysis panel, which asks about one reader. */
export async function analysisStatus(): Promise<{
  available: boolean;
  reason: string | null;
  describes: string;
  cannot: string;
  tracking: typeof TRACKING_GAP;
}> {
  const status = await frameReader.status();
  return {
    available: status.available,
    reason: status.reason ?? null,
    describes: frameReader.describes,
    cannot: frameReader.cannot,
    tracking: TRACKING_GAP,
  };
}

// ---------------------------------------------------------------------------
// Turning a reading into something that keeps
// ---------------------------------------------------------------------------

/** Turn one observation into a real clip, so a reading becomes something you keep. */
export async function observationToClip(input: {
  videoId: string;
  atSeconds: number;
  title: string;
  body: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const res = await createClip({
    videoId: input.videoId,
    title: input.title.slice(0, 120),
    startSeconds: Math.max(0, Math.floor(input.atSeconds - 2)),
    endSeconds: Math.floor(input.atSeconds + 3),
    sentiment: null,
    note: `MIDO analysis: ${input.body}`,
    tags: [],
  });
  if (!res.ok) return { ok: false, error: res.error };
  revalidatePath(`/app/film-room/${input.videoId}`);
  return { ok: true };
}

export async function removeAnalysis(videoId: string, id: string): Promise<{ ok: boolean }> {
  const ok = await deleteAnalysis(id);
  revalidatePath(`/app/film-room/${videoId}`);
  revalidatePath("/app/timeline");
  return { ok };
}
