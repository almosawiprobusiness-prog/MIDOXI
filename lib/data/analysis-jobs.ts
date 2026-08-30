import "server-only";
import { createClient } from "@/lib/supabase/server";
import { isDemoMode } from "@/lib/env";
import {
  planWindows,
  windowsIssue,
  nextPendingIndex,
  jobStateFor,
  windowAfterOutcome,
  MAX_JOB_WINDOWS,
  type AnalysisWindow,
  type AnalysisJob,
  type JobState,
} from "./analysis-job-types";

/*
  Film analysis jobs — persistence for the Vision pipeline.

  The rules about windows, retries and state transitions are pure and
  live in analysis-job-types.ts where tests can reach them; this file
  is only the rows. Demo mode keeps jobs in module memory (the
  captures.ts pattern) so the whole pipeline is exercisable with no
  keys.
*/

interface DemoJobDB {
  jobs: AnalysisJob[];
  seq: number;
}
const g = globalThis as unknown as { __midoJobDB?: DemoJobDB };
const demoDB: DemoJobDB = (g.__midoJobDB ??= { jobs: [], seq: 1 });

function rowToJob(r: Record<string, unknown>): AnalysisJob {
  return {
    id: r.id as string,
    videoId: r.video_id as string,
    focus: (r.focus as string) ?? "",
    windows: (r.windows as AnalysisWindow[]) ?? [],
    state: (r.state as JobState) ?? "queued",
    createdAt: (r.created_at as string) ?? new Date().toISOString(),
  };
}

/** A stable key for "this plan on this video" — double-taps collapse. */
function planKey(videoId: string, windows: { from: number; to: number }[], focus: string): string {
  return [videoId, focus, ...windows.map((w) => `${w.from}-${w.to}`)].join("|").slice(0, 200);
}

export async function createAnalysisJob(
  videoId: string,
  ranges: { from: number; to: number }[],
  focus: string,
): Promise<{ ok: true; job: AnalysisJob } | { ok: false; error: string }> {
  const issue = windowsIssue(ranges);
  if (issue) return { ok: false, error: issue };
  const windows = planWindows(ranges);
  const key = planKey(videoId, ranges, focus);

  if (isDemoMode) {
    const existing = demoDB.jobs.find((j) => j.id.endsWith(`:${key}`) && j.state !== "failed");
    if (existing) return { ok: true, job: existing };
    const job: AnalysisJob = {
      id: `job${demoDB.seq++}:${key}`,
      videoId,
      focus,
      windows,
      state: "queued",
      createdAt: new Date().toISOString(),
    };
    demoDB.jobs.unshift(job);
    return { ok: true, job };
  }

  const supabase = await createClient();
  if (!supabase) return { ok: false, error: "Service unavailable." };

  const { data, error } = await supabase
    .from("film_analysis_jobs")
    .insert({ video_id: videoId, focus, windows, idempotency_key: key })
    .select("*")
    .single();

  if (error) {
    // 23505 on the idempotency key: this exact plan already exists.
    if (error.code === "23505") {
      const { data: existing } = await supabase
        .from("film_analysis_jobs")
        .select("*")
        .eq("idempotency_key", key)
        .maybeSingle();
      if (existing) return { ok: true, job: rowToJob(existing) };
    }
    return { ok: false, error: error.message };
  }
  return { ok: true, job: rowToJob(data) };
}

export async function getAnalysisJob(id: string): Promise<AnalysisJob | null> {
  if (isDemoMode) return demoDB.jobs.find((j) => j.id === id) ?? null;
  const supabase = await createClient();
  if (!supabase) return null;
  const { data } = await supabase.from("film_analysis_jobs").select("*").eq("id", id).maybeSingle();
  return data ? rowToJob(data) : null;
}

/** The most recent unfinished job on a video — what a reload resumes. */
export async function activeJobForVideo(videoId: string): Promise<AnalysisJob | null> {
  if (isDemoMode) {
    return (
      demoDB.jobs.find(
        (j) => j.videoId === videoId && (j.state === "queued" || j.state === "running"),
      ) ?? null
    );
  }
  const supabase = await createClient();
  if (!supabase) return null;
  const { data } = await supabase
    .from("film_analysis_jobs")
    .select("*")
    .eq("video_id", videoId)
    .in("state", ["queued", "running"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data ? rowToJob(data) : null;
}

/**
 * Persist one window's outcome and the recomputed job state.
 * The whole windows array is written back — at ≤6 windows the array IS
 * the unit of truth, and partial jsonb surgery would buy race windows,
 * not performance.
 */
export async function recordWindowOutcome(
  job: AnalysisJob,
  index: number,
  outcome: { analysisId: string } | { error: string },
): Promise<AnalysisJob> {
  const windows = job.windows.map((w, i) => (i === index ? windowAfterOutcome(w, outcome) : w));
  const state = jobStateFor(windows);
  const updated: AnalysisJob = { ...job, windows, state };

  if (isDemoMode) {
    const i = demoDB.jobs.findIndex((j) => j.id === job.id);
    if (i >= 0) demoDB.jobs[i] = updated;
    return updated;
  }

  const supabase = await createClient();
  if (!supabase) return updated;
  await supabase
    .from("film_analysis_jobs")
    .update({ windows, state, updated_at: new Date().toISOString() })
    .eq("id", job.id);
  return updated;
}

export { nextPendingIndex, MAX_JOB_WINDOWS };
