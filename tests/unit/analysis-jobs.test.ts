import { describe, it, expect } from "vitest";
import {
  windowsIssue,
  planWindows,
  spreadWindows,
  jobStateFor,
  nextPendingIndex,
  windowAfterOutcome,
  jobProgressLabel,
  MAX_JOB_WINDOWS,
  WINDOW_MAX_ATTEMPTS,
  type AnalysisWindow,
  type AnalysisJob,
} from "../../lib/data/analysis-job-types";
import { CLIP_MIN_SECONDS, CLIP_MAX_SECONDS } from "../../lib/video/provider";

/*
  The Vision job pipeline's rules. What these pin: a job cannot smuggle
  an over-long read past the clip bounds, a window that dies retries
  then fails ALONE, and the job's state is arithmetic over its windows
  — the resilience the player experiences is these functions.
*/

const win = (status: AnalysisWindow["status"], attempts = 0): AnalysisWindow => ({
  from: 0,
  to: 60,
  status,
  attempts,
});

describe("window validation", () => {
  it("uses the same clip bounds as a single read — no smuggling", () => {
    expect(windowsIssue([{ from: 0, to: CLIP_MAX_SECONDS + 60 }])).toBeTruthy();
    expect(windowsIssue([{ from: 0, to: CLIP_MIN_SECONDS - 5 }])).toBeTruthy();
    expect(windowsIssue([{ from: 0, to: 60 }])).toBeNull();
  });

  it("caps the job at MAX_JOB_WINDOWS with the reason", () => {
    const many = Array.from({ length: MAX_JOB_WINDOWS + 1 }, (_, i) => ({ from: i * 100, to: i * 100 + 60 }));
    expect(windowsIssue(many)).toMatch(/at most/);
  });

  it("an empty plan is refused", () => {
    expect(windowsIssue([])).toBeTruthy();
  });
});

describe("spreadWindows", () => {
  it("spreads N windows inside the playable span", () => {
    const spread = spreadWindows(45 * 60, 3);
    expect(spread.length).toBe(3);
    for (const w of spread) {
      expect(w.to - w.from).toBeGreaterThanOrEqual(CLIP_MIN_SECONDS);
      expect(w.to - w.from).toBeLessThanOrEqual(CLIP_MAX_SECONDS);
      expect(w.to).toBeLessThanOrEqual(45 * 60);
    }
    // Actually spread — first and last are far apart.
    expect(spread.at(-1)!.from - spread[0]!.from).toBeGreaterThan(20 * 60);
  });

  it("a short video becomes one honest window, not zero", () => {
    const spread = spreadWindows(40, 3);
    expect(spread.length).toBe(1);
    expect(spread[0]!.to).toBeLessThanOrEqual(40);
  });

  it("a video below the minimum readable length yields nothing", () => {
    expect(spreadWindows(5, 3)).toEqual([]);
  });
});

describe("window outcomes and retries", () => {
  it("success closes the window and clears any earlier error", () => {
    const after = windowAfterOutcome({ ...win("pending"), error: "old" }, { analysisId: "a1" });
    expect(after.status).toBe("done");
    expect(after.analysisId).toBe("a1");
    expect(after.error).toBeUndefined();
  });

  it("a first failure stays pending — it will be retried", () => {
    const after = windowAfterOutcome(win("pending", 0), { error: "boom" });
    expect(after.status).toBe("pending");
    expect(after.attempts).toBe(1);
  });

  it("the attempt cap fails the window alone", () => {
    const after = windowAfterOutcome(win("pending", WINDOW_MAX_ATTEMPTS - 1), { error: "boom" });
    expect(after.status).toBe("failed");
  });
});

describe("job state is arithmetic over the windows", () => {
  it("all pending = queued; mixed progress = running", () => {
    expect(jobStateFor([win("pending"), win("pending")])).toBe("queued");
    expect(jobStateFor([win("done"), win("pending")])).toBe("running");
  });

  it("all done = complete; all failed = failed; a mix = partial with honesty", () => {
    expect(jobStateFor([win("done"), win("done")])).toBe("complete");
    expect(jobStateFor([win("failed"), win("failed")])).toBe("failed");
    expect(jobStateFor([win("done"), win("failed")])).toBe("partial");
  });

  it("nextPendingIndex resumes wherever the job stopped", () => {
    expect(nextPendingIndex([win("done"), win("failed"), win("pending")])).toBe(2);
    expect(nextPendingIndex([win("done"), win("done")])).toBe(-1);
  });

  it("partial says the honest count, failed says the video is safe", () => {
    const job = (windows: AnalysisWindow[], state: AnalysisJob["state"]): AnalysisJob => ({
      id: "j1", videoId: "v1", focus: "", windows, state, createdAt: "",
    });
    expect(jobProgressLabel(job([win("done"), win("failed")], "partial"))).toContain("1 of 2");
    expect(jobProgressLabel(job([win("failed")], "failed"))).toMatch(/video is safe/i);
  });
});
