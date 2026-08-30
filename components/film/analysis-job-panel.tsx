"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Film, Loader2, Check, AlertTriangle } from "lucide-react";
import { startSpreadJob, advanceJob } from "@/app/app/film-room/job-actions";
import { jobProgressLabel, type AnalysisJob } from "@/lib/data/analysis-job-types";

/*
  Reading a video in passages — the job pipeline's face.

  The player picks how many passages; MIDO spreads the windows and
  reads them ONE AT A TIME, each advance its own request. The job row
  is the truth: leave, refresh, lose signal — on return this panel
  finds the unfinished job and picks up where it stopped. No infinite
  spinner is possible, because progress is windows done out of windows
  planned, and a window that failed twice fails alone while the rest
  of the job completes.

  Each passage is one film read from the player's allowance, and the
  panel says so before anything runs.
*/

export function AnalysisJobPanel({
  videoId,
  initialJob,
  allowanceLeft,
}: {
  videoId: string;
  initialJob: AnalysisJob | null;
  allowanceLeft: number | null;
}) {
  const router = useRouter();
  const [job, setJob] = useState<AnalysisJob | null>(initialJob);
  const [passages, setPassages] = useState(3);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const driving = useRef(false);

  /*
    Drive the job to its end, one window per call. The ref guards
    against a second loop (effect + click, or React strict re-runs) —
    two drivers would read the same window twice.
  */
  const drive = async (j: AnalysisJob) => {
    if (driving.current) return;
    driving.current = true;
    let current = j;
    try {
      while (current.state === "queued" || current.state === "running") {
        const res = await advanceJob(current.id);
        if (!res.ok) {
          setError(res.error);
          break;
        }
        current = res.job;
        setJob(current);
        if (current.state === "complete" || current.state === "partial") {
          router.refresh();
          break;
        }
      }
    } finally {
      driving.current = false;
    }
  };

  // An unfinished job found on mount was asked for before the reload —
  // finishing it is completing that request, so it resumes itself.
  useEffect(() => {
    if (initialJob && (initialJob.state === "queued" || initialJob.state === "running")) {
      void drive(initialJob);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only by design
  }, []);

  const start = async () => {
    setBusy(true);
    setError(null);
    const res = await startSpreadJob(videoId, passages, "");
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setJob(res.job);
    void drive(res.job);
  };

  const active = job && (job.state === "queued" || job.state === "running");

  return (
    <div className="panel p-4">
      <div className="mb-1 flex items-center gap-2">
        <Film className="size-4 text-signal-bright" />
        <span className="label-tech">MIDO Vision — read in passages</span>
      </div>
      <p className="text-xs leading-relaxed text-text-dim">
        MIDO watches spread-out passages of this video and logs grounded, timestamped
        observations. One passage = one film read
        {allowanceLeft !== null ? ` (${allowanceLeft} left this month)` : ""}.
      </p>

      {!job || job.state === "failed" ? (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {[2, 3, 4].map((n) => (
            <button
              key={n}
              onClick={() => setPassages(n)}
              aria-pressed={passages === n}
              className={`h-8 rounded-md border px-2.5 text-xs transition-colors ${passages === n ? "border-signal-line bg-signal/10 text-signal-bright" : "border-line text-text-dim hover:text-text"}`}
            >
              {n} passages
            </button>
          ))}
          <button
            onClick={start}
            disabled={busy}
            className="flex h-8 items-center gap-1.5 rounded-md bg-signal px-3 text-xs font-medium text-white transition-colors hover:bg-signal-deep disabled:opacity-50"
          >
            {busy ? <Loader2 className="size-3 animate-spin" /> : <Film className="size-3" />} Read the video
          </button>
        </div>
      ) : null}

      {job && (
        <div className="mt-3">
          <div className="flex items-center gap-2 text-sm text-text">
            {active ? (
              <Loader2 className="size-4 animate-spin text-signal-bright" />
            ) : job.state === "complete" ? (
              <Check className="size-4 text-positive" />
            ) : (
              <AlertTriangle className="size-4 text-review" />
            )}
            {jobProgressLabel(job)}
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {job.windows.map((w, i) => (
              <span
                key={i}
                className={`rounded-md border px-2 py-1 text-[11px] ${
                  w.status === "done"
                    ? "border-positive/40 bg-positive/10 text-positive"
                    : w.status === "failed"
                      ? "border-correction/40 bg-correction/10 text-correction"
                      : "border-line text-text-faint"
                }`}
                title={w.error ?? undefined}
              >
                {Math.floor(w.from / 60)}:{String(Math.floor(w.from % 60)).padStart(2, "0")}–
                {Math.floor(w.to / 60)}:{String(Math.floor(w.to % 60)).padStart(2, "0")}
              </span>
            ))}
          </div>
          {job.state === "failed" && (
            <p className="mt-2 text-xs text-text-dim">
              Your video is safe and nothing was lost — try again, or analyse one passage by hand
              below.
            </p>
          )}
        </div>
      )}

      {error && (
        <p className="mt-2 rounded-lg border border-correction/30 bg-correction/10 px-3 py-2 text-xs text-correction">
          {error}
        </p>
      )}
    </div>
  );
}
