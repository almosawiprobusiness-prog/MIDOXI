import { describe, expect, it } from "vitest";
import {
  CAPTURE_CATEGORIES,
  OBSERVATION_MAX_CHARS,
  TIMESTAMP_MAX_SECONDS,
  captureCategoryLabel,
  captureIssue,
  formatTimestamp,
  isCaptureCategory,
  isYoutubeVideoId,
  timestampedYoutubeUrl,
  youtubeIdFromUrl,
  type CaptureInput,
} from "@/lib/data/capture-types";

/*
  The capture contract is shared verbatim by the extension bundle, the
  API route and the Player OS. These tests are what keeps that sharing
  honest: a change that breaks one surface breaks this file first.
*/

const VALID: CaptureInput = {
  videoId: "dQw4w9WgXcQ",
  sourceUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
  videoTitle: "Harry Kane Movement Analysis",
  channelName: "Football IQ",
  thumbnailUrl: "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
  timestampSeconds: 2057,
  observation: "Checks away first, waits for the CB to look at the ball, then attacks his blindside.",
  category: "movement",
  goalId: "6f9619ff-8b86-4d01-b42d-00cf4fc964ff",
  clientKey: "a2f1c9e4-77aa-4a41-9d0b-1f2e3d4c5b6a",
};

describe("youtubeIdFromUrl", () => {
  it("reads every URL shape YouTube serves", () => {
    const id = "dQw4w9WgXcQ";
    for (const url of [
      `https://www.youtube.com/watch?v=${id}`,
      `https://youtube.com/watch?v=${id}&t=120s`,
      `https://m.youtube.com/watch?list=PL123&v=${id}`,
      `https://www.youtube.com/shorts/${id}`,
      `https://www.youtube.com/embed/${id}`,
      `https://www.youtube.com/live/${id}`,
      `https://youtu.be/${id}`,
      `https://youtu.be/${id}?t=45`,
    ]) {
      expect(youtubeIdFromUrl(url), url).toBe(id);
    }
  });

  it("refuses what is not a video", () => {
    expect(youtubeIdFromUrl("https://www.youtube.com/")).toBeNull();
    expect(youtubeIdFromUrl("https://www.youtube.com/feed/subscriptions")).toBeNull();
    expect(youtubeIdFromUrl("https://example.com/watch?v=dQw4w9WgXcQ")).toBeNull();
    expect(youtubeIdFromUrl("not a url")).toBeNull();
    expect(youtubeIdFromUrl("")).toBeNull();
  });
});

describe("isYoutubeVideoId", () => {
  it("accepts exactly 11 URL-safe chars", () => {
    expect(isYoutubeVideoId("dQw4w9WgXcQ")).toBe(true);
    expect(isYoutubeVideoId("a_b-c_d-e_f")).toBe(true);
  });
  it("rejects everything else", () => {
    expect(isYoutubeVideoId("short")).toBe(false);
    expect(isYoutubeVideoId("dQw4w9WgXcQQ")).toBe(false);
    expect(isYoutubeVideoId("dQw4w9WgXc!")).toBe(false);
    expect(isYoutubeVideoId(null)).toBe(false);
    expect(isYoutubeVideoId(11)).toBe(false);
  });
});

describe("formatTimestamp", () => {
  it("formats minutes and hours", () => {
    expect(formatTimestamp(0)).toBe("0:00");
    expect(formatTimestamp(7)).toBe("0:07");
    expect(formatTimestamp(65)).toBe("1:05");
    expect(formatTimestamp(2057)).toBe("34:17");
    expect(formatTimestamp(3600)).toBe("1:00:00");
    expect(formatTimestamp(7317)).toBe("2:01:57");
  });
  it("never breaks on junk", () => {
    expect(formatTimestamp(-5)).toBe("0:00");
    expect(formatTimestamp(NaN)).toBe("0:00");
    expect(formatTimestamp(61.9)).toBe("1:01");
  });
});

describe("timestampedYoutubeUrl", () => {
  it("builds the canonical watch link", () => {
    expect(timestampedYoutubeUrl("dQw4w9WgXcQ", 2057)).toBe(
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=2057s",
    );
  });
  it("drops t= at zero and floors fractions", () => {
    expect(timestampedYoutubeUrl("dQw4w9WgXcQ", 0)).toBe(
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    );
    expect(timestampedYoutubeUrl("dQw4w9WgXcQ", 61.8)).toContain("&t=61s");
  });
});

describe("categories", () => {
  it("has the football vocabulary", () => {
    expect(CAPTURE_CATEGORIES.length).toBe(15);
    expect(isCaptureCategory("movement")).toBe(true);
    expect(isCaptureCategory("set_pieces")).toBe(true);
    expect(isCaptureCategory("vibes")).toBe(false);
    expect(captureCategoryLabel("set_pieces")).toBe("Set pieces");
  });
});

describe("captureIssue", () => {
  it("passes a well-formed capture", () => {
    expect(captureIssue(VALID)).toBeNull();
  });

  it("passes with every optional field absent", () => {
    expect(
      captureIssue({
        videoId: VALID.videoId,
        sourceUrl: VALID.sourceUrl,
        videoTitle: "T",
        timestampSeconds: 0,
        observation: "Noticed something.",
      }),
    ).toBeNull();
  });

  it("refuses a URL that names a different video", () => {
    const issue = captureIssue({
      ...VALID,
      sourceUrl: "https://www.youtube.com/watch?v=AAAAAAAAAAA",
    });
    expect(issue?.field).toBe("sourceUrl");
  });

  it("refuses a bad video id", () => {
    expect(captureIssue({ ...VALID, videoId: "nope" })?.field).toBe("videoId");
  });

  it("requires an observation and bounds it", () => {
    expect(captureIssue({ ...VALID, observation: "   " })?.field).toBe("observation");
    expect(
      captureIssue({ ...VALID, observation: "x".repeat(OBSERVATION_MAX_CHARS + 1) })?.field,
    ).toBe("observation");
    expect(captureIssue({ ...VALID, observation: "x".repeat(OBSERVATION_MAX_CHARS) })).toBeNull();
  });

  it("bounds the timestamp", () => {
    expect(captureIssue({ ...VALID, timestampSeconds: -1 })?.field).toBe("timestampSeconds");
    expect(captureIssue({ ...VALID, timestampSeconds: TIMESTAMP_MAX_SECONDS + 1 })?.field).toBe(
      "timestampSeconds",
    );
    expect(captureIssue({ ...VALID, timestampSeconds: NaN })?.field).toBe("timestampSeconds");
    expect(
      captureIssue({ ...VALID, timestampSeconds: "34:17" as unknown as number })?.field,
    ).toBe("timestampSeconds");
  });

  it("only accepts YouTube-hosted thumbnails", () => {
    expect(
      captureIssue({ ...VALID, thumbnailUrl: "https://evil.example/x.jpg" })?.field,
    ).toBe("thumbnailUrl");
    expect(
      captureIssue({ ...VALID, thumbnailUrl: "https://img.youtube.com/vi/dQw4w9WgXcQ/0.jpg" }),
    ).toBeNull();
    expect(captureIssue({ ...VALID, thumbnailUrl: null })).toBeNull();
  });

  it("refuses unknown categories and malformed goal ids", () => {
    expect(
      captureIssue({ ...VALID, category: "swagger" as CaptureInput["category"] })?.field,
    ).toBe("category");
    expect(captureIssue({ ...VALID, goalId: "has spaces!" })?.field).toBe("goalId");
    expect(captureIssue({ ...VALID, goalId: "x".repeat(65) })?.field).toBe("goalId");
    expect(captureIssue({ ...VALID, goalId: "g1" })).toBeNull(); // demo-mode ids are short
    expect(captureIssue({ ...VALID, goalId: null })).toBeNull();
  });

  it("bounds the title, channel and client key", () => {
    expect(captureIssue({ ...VALID, videoTitle: "" })?.field).toBe("videoTitle");
    expect(captureIssue({ ...VALID, videoTitle: "x".repeat(301) })?.field).toBe("videoTitle");
    expect(captureIssue({ ...VALID, channelName: "x".repeat(201) })?.field).toBe("channelName");
    expect(captureIssue({ ...VALID, clientKey: "x".repeat(65) })?.field).toBe("clientKey");
  });
});
