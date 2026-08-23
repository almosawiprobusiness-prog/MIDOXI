import { describe, it, expect } from "vitest";
import {
  CAPTION_MAX,
  PHOTO_MAX_BYTES,
  REPORT_REASONS,
  VIDEO_MAX_BYTES,
  aspectOf,
  captionIssue,
  compactCount,
  displayHandle,
  mediaIssue,
  postIssue,
  youtubeId,
  type PostMedia,
} from "../../lib/data/feed-types";

/*
  The community became a feed, and a feed on a product with fourteen-year-olds
  on it needs its rules written down rather than implied.

  Most of what is here is small — a handle that is never blank, a count that
  reads at a glance, a size limit that explains itself. Small is the point: a
  feed is a hundred tiny renderings a second, and each of these is one that
  would otherwise look broken.
*/

describe("a post has to be something", () => {
  it("refuses an empty one", () => {
    // An empty row in a feed is a gap nobody can explain.
    expect(postIssue({ caption: "", hasMedia: false })).toBeTruthy();
    expect(postIssue({ caption: "   ", hasMedia: false })).toBeTruthy();
  });

  it("accepts media with no words", () => {
    expect(postIssue({ caption: "", hasMedia: true })).toBeNull();
  });

  it("accepts words with no media", () => {
    expect(postIssue({ caption: "Body shape before receiving.", hasMedia: false })).toBeNull();
  });

  it("holds the caption to a length", () => {
    expect(captionIssue("x".repeat(CAPTION_MAX))).toBeNull();
    expect(captionIssue("x".repeat(CAPTION_MAX + 1))).toMatch(/limit/);
  });
});

describe("what may be posted", () => {
  it("takes the formats a phone produces", () => {
    for (const type of ["image/jpeg", "image/png", "image/webp", "video/mp4", "video/webm"]) {
      expect(mediaIssue({ type, size: 1_000_000 }), type).toBeNull();
    }
  });

  it("refuses anything that is not a photo or a video", () => {
    expect(mediaIssue({ type: "application/pdf", size: 1000 })).toBeTruthy();
    expect(mediaIssue({ type: "image/heic", size: 1000 })).toMatch(/JPEG, PNG or WebP/);
  });

  it("tells somebody with a match file where it actually belongs", () => {
    /*
      The important refusal. A player will try to post their match video, it
      will be hundreds of megabytes, and "too large" on its own leaves them
      with nowhere to go.
    */
    const issue = mediaIssue({ type: "video/mp4", size: 400 * 1024 * 1024 });
    expect(issue).toMatch(/film room/i);
    expect(issue).toMatch(/short clip/i);
    expect(issue).toMatch(/400MB/);
  });

  it("allows exactly the limits", () => {
    expect(mediaIssue({ type: "image/jpeg", size: PHOTO_MAX_BYTES })).toBeNull();
    expect(mediaIssue({ type: "video/mp4", size: VIDEO_MAX_BYTES })).toBeNull();
  });
});

describe("YouTube links", () => {
  it("reads every shape a player might paste", () => {
    const id = "dQw4w9WgXcQ";
    for (const url of [
      `https://www.youtube.com/watch?v=${id}`,
      `https://youtu.be/${id}`,
      `https://www.youtube.com/embed/${id}`,
      `https://www.youtube.com/shorts/${id}`,
      `https://m.youtube.com/watch?v=${id}&t=42s`,
    ]) {
      expect(youtubeId(url), url).toBe(id);
    }
  });

  it("returns null for something that is not one", () => {
    expect(youtubeId("https://vimeo.com/12345")).toBeNull();
    expect(youtubeId("just some text")).toBeNull();
    expect(youtubeId("")).toBeNull();
  });
});

describe("the handle under a name", () => {
  it("uses the real one when there is one", () => {
    expect(displayHandle({ handle: "mido9", name: "MIDO" })).toBe("@mido9");
  });

  it("is never blank, because a feed of unnamed authors looks broken", () => {
    // A player who has not set a handle is the common case on a new account.
    expect(displayHandle({ handle: null, name: "Sam Oyelaran" })).toBe("@sam");
    expect(displayHandle({ handle: null, name: "  " })).toBe("@player");
    expect(displayHandle({ handle: null, name: "!!!" })).toBe("@player");
  });
});

describe("counts at a glance", () => {
  it("reads as a person would say it", () => {
    expect(compactCount(0)).toBe("0");
    expect(compactCount(999)).toBe("999");
    expect(compactCount(1000)).toBe("1k");
    expect(compactCount(1200)).toBe("1.2k");
    expect(compactCount(12_400)).toBe("12k");
    expect(compactCount(1_500_000)).toBe("1.5m");
  });
});

describe("reserving space before the media loads", () => {
  const media = (over: Partial<PostMedia>): PostMedia => ({
    kind: "photo",
    url: "x",
    width: 1000,
    height: 1000,
    ...over,
  });

  it("uses the real ratio when the dimensions are known", () => {
    expect(aspectOf(media({ width: 1200, height: 800 }))).toBe("1200 / 800");
  });

  it("always gives YouTube its own shape", () => {
    expect(aspectOf(media({ kind: "youtube", width: 100, height: 900 }))).toBe("16 / 9");
  });

  it("falls back to portrait when nothing is known", () => {
    // Most phone photos of football arrive this way, and a wrong guess here
    // shoves the rest of the feed down the page as each image lands.
    expect(aspectOf(media({ width: null, height: null }))).toBe("4 / 5");
    expect(aspectOf(null)).toBe("1 / 1");
  });

  it("crops something absurdly tall rather than giving it a whole screen", () => {
    expect(aspectOf(media({ width: 400, height: 3000 }))).toBe("4 / 5");
  });

  it("crops something absurdly wide too", () => {
    expect(aspectOf(media({ width: 4000, height: 500 }))).toBe("16 / 9");
  });
});

describe("reporting", () => {
  it("offers a reason for a concern about a young player", () => {
    // The one that matters most on a product with minors on it, and the one
    // most report menus do not have.
    const values = REPORT_REASONS.map((r) => r.value);
    expect(values).toContain("safeguarding");
    expect(REPORT_REASONS.find((r) => r.value === "safeguarding")?.label).toMatch(/young player/i);
  });

  it("gives every reason a readable label", () => {
    for (const r of REPORT_REASONS) {
      expect(r.label.length, r.value).toBeGreaterThan(3);
      expect(r.label, r.value).not.toBe(r.value);
    }
  });

  it("has no duplicate values", () => {
    const v = REPORT_REASONS.map((r) => r.value);
    expect(new Set(v).size).toBe(v.length);
  });
});
