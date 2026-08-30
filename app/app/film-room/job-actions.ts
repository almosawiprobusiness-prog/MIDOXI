"use server";

import { revalidatePath } from "next/cache";
import {
  createAnalysisJob,
  getAnalysisJob,
  recordWindowOutcome,
  nextPendingIndex,
} from "@/lib/data/analysis-jobs";
import { spreadWindows, type AnalysisJob } from "@/lib/data/analysis-job-types";
import { getVideoWithClips } from "@/lib/data/film";
import { analyseVideo } from "./analysis-actions";
import { track } from "@/lib/analytics/track";

/*
  The Vision job pipeline's verbs.

  A job advances ONE window per invocation — each call stays well
  inside a serverless time budget, and the row is the only state, so a
  refresh, a dead tab or a crashed function loses nothing: the next
  advance picks up the first pending window, wherever it is.

  Metering is untouched here on purpose: each window IS one
  deep_analysis and runs through analyseVideo, which already gates,
  consumes and refunds correctly. A job is bookkeeping around reads,
  not a new kind of read.
*/

export type JobResponse = { ok: true; job: AnalysisJob } | { ok: false; error: string };

/** Plan a job that reads N passages spread across the video. */
export async function startSpreadJob(
  videoId: string,
  passages: number,
  focus: string,
): Promise<JobResponse> {
  const detail = await getVideoWithClips(videoId);
  if (!detail?.video) return { ok: false, error: "That video could not be found." };
  const duration = detail.video.durationSeconds ?? 0;
  if (!duration) {
    return {
      ok: false,
      error: "MIDO does not know this video's length yet — play it once, or analyse a passage by hand.",
    };
  }
  const ranges = spreadWindows(duration, passages);
  if (!ranges.length) return { ok: false, error: "This video is too short to read in passages." };

  const res = await createAnalysisJob(videoId, ranges, focus.slice(0, 200));
  if (res.ok) await track("vision_job_started", { windows: ranges.length });
  return res;
}

/**
 * Advance a job by one window. Returns the updated job either way —
 * a window failure is recorded on the row, not thrown at the player.
 */
export async function advanceJob(jobId: string): Promise<JobResponse> {
  const job = await getAnalysisJob(jobId);
  if (!job) return { ok: false, error: "That analysis run could not be found." };

  const index = nextPendingIndex(job.windows);
  if (index === -1) return { ok: true, job };

  const w = job.windows[index]!;
  const res = await analyseVideo({
    videoId: job.videoId,
    fromSeconds: w.from,
    toSeconds: w.to,
    focus: job.focus,
  });

  const updated = await recordWindowOutcome(
    job,
    index,
    res.ok ? { analysisId: res.analysis.id } : { error: res.error },
  );

  if (updated.state === "complete" || updated.state === "partial") {
    await track("vision_job_finished", {
      state: updated.state,
      done: updated.windows.filter((x) => x.status === "done").length,
    });
    revalidatePath(`/app/film-room/${job.videoId}`);
  }
  return { ok: true, job: updated };
}

export async function jobStatus(jobId: string): Promise<JobResponse> {
  const job = await getAnalysisJob(jobId);
  return job ? { ok: true, job } : { ok: false, error: "That analysis run could not be found." };
}
