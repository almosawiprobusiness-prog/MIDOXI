import { CLIP_MIN_SECONDS, CLIP_MAX_SECONDS, clipLengthIssue } from "@/lib/video/provider";

/*
  Analysis-job rules — pure, client-safe, tested.

  A job is a plan of windows over one video, each window one grounded
  model read. The rules here are what make the pipeline resilient
  rather than optimistic:

  - windows are validated with the SAME clip bounds a single read uses
    (10-90s, the measured observation-density sweet spot) — a job is
    not a way to smuggle a 20-minute read past the product rule;
  - a failed window retries up to WINDOW_MAX_ATTEMPTS, then fails
    ALONE — a job with five good reads and one dead window lands
    `partial`, with the honest count, never `failed`;
  - state is a pure function of the windows, so it cannot drift from
    them.
*/

export const MAX_JOB_WINDOWS = 6;
export const WINDOW_MAX_ATTEMPTS = 2;

export type WindowStatus = "pending" | "done" | "failed";
export type JobState = "queued" | "running" | "partial" | "complete" | "failed";

export interface AnalysisWindow {
  from: number;
  to: number;
  status: WindowStatus;
  attempts?: number;
  analysisId?: string;
  error?: string;
}

export interface AnalysisJob {
  id: string;
  videoId: string;
  focus: string;
  windows: AnalysisWindow[];
  state: JobState;
  createdAt: string;
}

/** Why a set of ranges cannot become a job, or null when it can. */
export function windowsIssue(ranges: { from: number; to: number }[]): string | null {
  if (!ranges.length) return "Pick at least one passage to read.";
  if (ranges.length > MAX_JOB_WINDOWS) {
    return `A job reads at most ${MAX_JOB_WINDOWS} passages — fewer, chosen well, beats a sweep.`;
  }
  for (const r of ranges) {
    const issue = clipLengthIssue(r.from, r.to);
    if (issue) return issue;
  }
  return null;
}

export function planWindows(ranges: { from: number; to: number }[]): AnalysisWindow[] {
  return ranges.map((r) => ({
    from: Math.max(0, Math.floor(r.from)),
    to: Math.floor(r.to),
    status: "pending" as const,
    attempts: 0,
  }));
}

/**
 * Spread N windows across a video's duration — the "read the match in
 * passages" default. Windows sit inside the playable span, avoid the
 * dead first seconds, and are capped to the single-read maximum.
 */
export function spreadWindows(durationSeconds: number, count: number): { from: number; to: number }[] {
  const n = Math.max(1, Math.min(MAX_JOB_WINDOWS, Math.floor(count)));
  const windowLen = Math.min(CLIP_MAX_SECONDS - 30, Math.max(CLIP_MIN_SECONDS + 20, 60));
  const usable = Math.max(0, durationSeconds - windowLen);
  if (durationSeconds < CLIP_MIN_SECONDS) return [];
  if (usable <= 0) return [{ from: 0, to: Math.floor(Math.min(durationSeconds, CLIP_MAX_SECONDS)) }];

  const out: { from: number; to: number }[] = [];
  for (let i = 0; i < n; i++) {
    // Even spread with a small lead-in skip; single window starts early.
    const from = Math.floor(n === 1 ? usable / 2 : (usable * i) / (n - 1));
    out.push({ from, to: from + windowLen });
  }
  return out;
}

export function nextPendingIndex(windows: AnalysisWindow[]): number {
  return windows.findIndex((w) => w.status === "pending");
}

/**
 * One window after one outcome. A failure counts an attempt and stays
 * `pending` until the attempt cap, then fails ALONE — the job around
 * it keeps going.
 */
export function windowAfterOutcome(
  w: AnalysisWindow,
  outcome: { analysisId: string } | { error: string },
): AnalysisWindow {
  if ("analysisId" in outcome) {
    return { ...w, status: "done", analysisId: outcome.analysisId, error: undefined };
  }
  const attempts = (w.attempts ?? 0) + 1;
  return {
    ...w,
    attempts,
    status: attempts >= WINDOW_MAX_ATTEMPTS ? "failed" : "pending",
    error: outcome.error,
  };
}

/** State derived from the windows — never stored independently of them. */
export function jobStateFor(windows: AnalysisWindow[]): JobState {
  const done = windows.filter((w) => w.status === "done").length;
  const failed = windows.filter((w) => w.status === "failed").length;
  const pending = windows.length - done - failed;
  if (pending > 0) return done + failed > 0 ? "running" : "queued";
  if (failed === 0) return "complete";
  if (done === 0) return "failed";
  return "partial";
}

/** Honest progress copy for a job in any state. */
export function jobProgressLabel(job: AnalysisJob): string {
  const done = job.windows.filter((w) => w.status === "done").length;
  const failed = job.windows.filter((w) => w.status === "failed").length;
  const total = job.windows.length;
  switch (job.state) {
    case "complete":
      return `All ${total} passage${total === 1 ? "" : "s"} read.`;
    case "partial":
      return `${done} of ${total} passages read — ${failed} could not be completed.`;
    case "failed":
      return "No passage could be read. Your video is safe; nothing was lost.";
    case "running":
      return `Reading passage ${Math.min(done + failed + 1, total)} of ${total}…`;
    default:
      return `${total} passage${total === 1 ? "" : "s"} queued.`;
  }
}
