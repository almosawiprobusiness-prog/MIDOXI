import "server-only";
import { createClient, createAdminClient, getAuthUser } from "@/lib/supabase/server";
import { isDemoMode } from "@/lib/env";
import type { AnalysisIdentity, AnalysisKind, AnalysisObservation } from "@/lib/video/provider";

/*
  Saved film analyses. Same adapter contract as every other data module.

  A saved analysis records which provider produced it, so a frame reading is
  never confused with tracking data later.
*/

export interface ClipAnalysis {
  id: string;
  videoId: string;
  provider: string;
  model: string | null;
  kind: AnalysisKind;
  fromSeconds: number;
  toSeconds: number;
  framesSampled: number;
  focus: string;
  summary: string;
  observations: AnalysisObservation[];
  /** The identification audit, when the read produced one. */
  identity?: AnalysisIdentity | null;
  depth?: "quick" | "deep" | null;
  promptVersion?: number | null;
  /** True when the player said this read followed the wrong player. */
  identityRejected: boolean;
  createdAt: string;
}

export interface SaveAnalysisInput {
  videoId: string;
  provider: string;
  model?: string;
  kind: AnalysisKind;
  fromSeconds: number;
  toSeconds: number;
  framesSampled: number;
  fpsSampled: number;
  focus: string;
  summary: string;
  observations: AnalysisObservation[];
  identity?: AnalysisIdentity | null;
  depth?: "quick" | "deep" | null;
  promptVersion?: number | null;
  sourceKind?: string | null;
}

interface DemoDB {
  analyses: ClipAnalysis[];
  seq: number;
}
const g = globalThis as unknown as { __midoAnalysisDB?: DemoDB };
const demoDB: DemoDB = (g.__midoAnalysisDB ??= { analyses: [], seq: 1 });

function rowTo(r: Record<string, unknown>): ClipAnalysis {
  return {
    id: r.id as string,
    videoId: r.video_id as string,
    provider: (r.provider as string) ?? "mido-frames",
    model: (r.model as string) ?? null,
    kind: (r.kind as AnalysisKind) ?? "frames",
    fromSeconds: Number(r.from_seconds ?? 0),
    toSeconds: Number(r.to_seconds ?? 0),
    framesSampled: Number(r.frames_sampled ?? 0),
    focus: (r.focus as string) ?? "",
    summary: (r.summary as string) ?? "",
    observations: ((r.observations as AnalysisObservation[]) ?? []) as AnalysisObservation[],
    identity: r.identity_level
      ? {
          level: r.identity_level as AnalysisIdentity["level"],
          basis: (r.identity_basis as AnalysisIdentity["basis"]) ?? "none",
          couldMatchOthers: Number(r.identity_could_match ?? 0),
          squadNumberLegible: Boolean(r.squad_number_legible),
        }
      : null,
    depth: (r.depth as "quick" | "deep") ?? null,
    promptVersion: r.prompt_version == null ? null : Number(r.prompt_version),
    identityRejected: Boolean(r.identity_rejected),
    createdAt: (r.created_at as string) ?? new Date().toISOString(),
  };
}

/** @param forUser see the note on `listGoals`. Share route only. */
export async function listAnalyses(videoId: string, forUser?: string): Promise<ClipAnalysis[]> {
  if (isDemoMode) {
    return demoDB.analyses.filter((a) => a.videoId === videoId).reverse();
  }
  const supabase = forUser ? createAdminClient() : await createClient();
  if (!supabase) return [];
  const query = supabase
    .from("clip_analyses")
    .select("*")
    .eq("video_id", videoId);
  const { data } = await (forUser ? query.eq("user_id", forUser) : query)
    .order("created_at", { ascending: false })
    .limit(20);
  return (data ?? []).map(rowTo);
}

export async function saveAnalysis(input: SaveAnalysisInput): Promise<ClipAnalysis | null> {
  if (isDemoMode) {
    const row: ClipAnalysis = {
      id: `an${demoDB.seq++}`,
      videoId: input.videoId,
      provider: input.provider,
      model: input.model ?? null,
      kind: input.kind,
      fromSeconds: input.fromSeconds,
      toSeconds: input.toSeconds,
      framesSampled: input.framesSampled,
      focus: input.focus,
      summary: input.summary,
      observations: input.observations,
      identity: input.identity ?? null,
      depth: input.depth ?? null,
      promptVersion: input.promptVersion ?? null,
      identityRejected: false,
      createdAt: new Date().toISOString(),
    };
    demoDB.analyses.push(row);
    return row;
  }

  const supabase = await createClient();
  if (!supabase) return null;
  const user = await getAuthUser();
  if (!user) return null;

  const { data } = await supabase
    .from("clip_analyses")
    .insert({
      user_id: user.id,
      video_id: input.videoId,
      provider: input.provider,
      model: input.model ?? null,
      kind: input.kind,
      from_seconds: input.fromSeconds,
      to_seconds: input.toSeconds,
      frames_sampled: input.framesSampled,
      fps_sampled: input.fpsSampled,
      focus: input.focus || null,
      summary: input.summary || null,
      observations: input.observations,
      depth: input.depth ?? null,
      prompt_version: input.promptVersion ?? null,
      source_kind: input.sourceKind ?? null,
      identity_level: input.identity?.level ?? null,
      identity_basis: input.identity?.basis ?? null,
      identity_could_match: input.identity?.couldMatchOthers ?? null,
      squad_number_legible: input.identity?.squadNumberLegible ?? null,
    })
    .select("*")
    .maybeSingle();
  return data ? rowTo(data) : null;
}

/**
 * "That's not me." The player's verdict on an identification, recorded on the
 * row — the read stays visible (deleting it would hide what happened) but is
 * marked corrected and never feeds prior-observation context again.
 */
export async function markWrongPlayer(id: string, rejected = true): Promise<boolean> {
  if (isDemoMode) {
    const a = demoDB.analyses.find((x) => x.id === id);
    if (!a) return false;
    a.identityRejected = rejected;
    return true;
  }
  const supabase = await createClient();
  if (!supabase) return false;
  const { error } = await supabase
    .from("clip_analyses")
    .update({ identity_rejected: rejected })
    .eq("id", id);
  return !error;
}

export async function deleteAnalysis(id: string): Promise<boolean> {
  if (isDemoMode) {
    const i = demoDB.analyses.findIndex((a) => a.id === id);
    if (i < 0) return false;
    demoDB.analyses.splice(i, 1);
    return true;
  }
  const supabase = await createClient();
  if (!supabase) return false;
  const { error } = await supabase.from("clip_analyses").delete().eq("id", id);
  return !error;
}

/*
  What MIDO has already said about this player.

  Passing these into the next read is what makes the film room a record rather
  than a series of unrelated readings: the model can say "this is the fourth
  clip where this happens" or, far better, "this is the first clip where it
  does not". Neither sentence is available to a tool with no memory.

  Observations live inside a jsonb array rather than in their own table, so the
  filtering happens here rather than in SQL. That is fine at this size — the
  query is bounded by recent analyses per user, not by total rows — and it
  keeps a single definition of what an observation is.
*/
export interface PriorObservationRow {
  on: string;
  concept?: string;
  title: string;
  atSeconds: number;
  videoId: string;
}

export async function priorObservations(input: {
  /** Only observations about these concepts. Empty means any. */
  concepts?: string[];
  /** Exclude a video, so a re-read is not compared against itself. */
  exceptVideoId?: string;
  limit?: number;
}): Promise<PriorObservationRow[]> {
  const limit = input.limit ?? 8;
  const wanted = input.concepts?.length ? new Set(input.concepts) : null;

  const rows: { videoId: string; createdAt: string; observations: AnalysisObservation[] }[] = [];

  if (isDemoMode) {
    rows.push(
      ...demoDB.analyses.filter((a) => !a.identityRejected).map((a) => ({
        videoId: a.videoId,
        createdAt: a.createdAt,
        observations: a.observations,
      })),
    );
  } else {
    const supabase = await createClient();
    if (!supabase) return [];
    const user = await getAuthUser();
    if (!user) return [];

    // Bounded by recency: what matters is what MIDO said lately, and reading a
    // whole season of analyses to find eight lines is not worth the query.
    const { data } = await supabase
      .from("clip_analyses")
      .select("video_id, created_at, observations")
      .eq("user_id", user.id)
      // A read the player marked as following the wrong player must never be
      // fed forward as their own history.
      .eq("identity_rejected", false)
      .order("created_at", { ascending: false })
      .limit(40);

    rows.push(
      ...(data ?? []).map((r) => ({
        videoId: String(r.video_id),
        createdAt: String(r.created_at),
        observations: (r.observations as AnalysisObservation[]) ?? [],
      })),
    );
  }

  const out: PriorObservationRow[] = [];
  for (const row of rows) {
    if (input.exceptVideoId && row.videoId === input.exceptVideoId) continue;
    for (const o of row.observations) {
      if (wanted && (!o.concept || !wanted.has(o.concept))) continue;
      out.push({
        on: row.createdAt.slice(0, 10),
        concept: o.concept,
        title: o.title,
        atSeconds: o.atSeconds,
        videoId: row.videoId,
      });
    }
  }

  return out.sort((a, b) => (a.on < b.on ? 1 : -1)).slice(0, limit);
}
