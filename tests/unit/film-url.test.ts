import { describe, it, expect } from "vitest";
import { videoUrlKind, youtubeId, isHlsUrl, UPLOAD_MAX_MB } from "../../lib/data/film-types";

/*
  The film room used to call every non-YouTube link a "Direct video",
  save it with status "ready", and render a black player with a 0:00
  timeline when it turned out to be a web page.

  The case that actually happened is pinned first, verbatim: a link to a
  match on a streaming site — the single most likely thing a footballer
  pastes into a film room, and the one the old check answered with
  complete confidence.
*/

describe("the link that broke it", () => {
  const REAL = "https://watch.sport.video/3liga/iii-liga-stred/tj-banik-kalinovo-vs-ftc-filakovo-201775?game=5094";

  it("is refused, not called a direct video", () => {
    const got = videoUrlKind(REAL);
    expect(got.kind).toBe("unsupported");
  });

  it("names the host, so the person knows their link is a page and not broken", () => {
    const got = videoUrlKind(REAL);
    if (got.kind !== "unsupported") throw new Error("expected unsupported");
    expect(got.reason).toContain("watch.sport.video");
  });
});

describe("what actually plays", () => {
  it("takes YouTube in every shape a person pastes", () => {
    const id = "dQw4w9WgXcQ";
    for (const url of [
      `https://www.youtube.com/watch?v=${id}`,
      `https://youtu.be/${id}`,
      `https://www.youtube.com/embed/${id}`,
      `https://www.youtube.com/shorts/${id}`,
    ]) {
      const got = videoUrlKind(url);
      expect(got.kind, url).toBe("youtube");
      if (got.kind === "youtube") expect(got.id).toBe(id);
    }
  });

  it("takes a real video file, including one with a query string", () => {
    for (const url of [
      "https://cdn.example.com/match.mp4",
      "https://cdn.example.com/match.webm",
      "https://cdn.example.com/match.MOV",
      "https://cdn.example.com/full-game.mp4?token=abc123",
    ]) {
      expect(videoUrlKind(url).kind, url).toBe("direct");
    }
  });

  it("does not mistake a Supabase storage URL for a page", () => {
    // Uploaded footage has to keep working — this is the path the upload
    // flow produces, and treating it as unsupported would break the one
    // case that was never broken.
    const url = "https://abc.supabase.co/storage/v1/object/public/videos/user/clip.mp4";
    expect(videoUrlKind(url).kind).toBe("direct");
  });
});

describe("HLS streams", () => {
  it("recognises a playlist, which most sports platforms actually serve", () => {
    expect(videoUrlKind("https://cdn.example.com/match/index.m3u8").kind).toBe("hls");
    expect(videoUrlKind("https://cdn.example.com/live/stream.m3u8?token=abc").kind).toBe("hls");
  });

  it("tells the player which path to take", () => {
    // A playlist needs hls.js; a file must NOT go through it.
    expect(isHlsUrl("https://cdn.example.com/match/index.m3u8")).toBe(true);
    expect(isHlsUrl("https://cdn.example.com/match.mp4")).toBe(false);
    expect(isHlsUrl(null)).toBe(false);
    expect(isHlsUrl("not a url")).toBe(false);
  });

  it("does not confuse a playlist with a plain file", () => {
    // These take different playback paths, so the distinction has to hold.
    expect(videoUrlKind("https://cdn.example.com/match.mp4").kind).toBe("direct");
  });
});

describe("the upload limit", () => {
  it("is whatever storage actually enforces, not a rounder number", () => {
    /*
      Pinned because the app once claimed 50 MB while the bucket enforced
      48, so a 49 MB file passed the visible check and failed the hidden
      one. `npm run verify:storage` checks this against the live bucket;
      this just stops the constant being edited to a number that sounds
      better without the bucket moving too.
    */
    expect(UPLOAD_MAX_MB).toBe(50);
  });
});

describe("what is refused", () => {
  it("refuses a page on a video platform", () => {
    for (const url of [
      "https://vimeo.com/123456789",
      "https://app.veo.co/matches/some-match/",
      "https://www.hudl.com/video/3/123/456",
    ]) {
      expect(videoUrlKind(url).kind, url).toBe("unsupported");
    }
  });

  it("refuses something that is not a web address at all", () => {
    expect(videoUrlKind("not a url").kind).toBe("unsupported");
    expect(videoUrlKind("").kind).toBe("unsupported");
  });

  it("refuses a non-http scheme", () => {
    // `file:///` would look plausible to somebody pointing at their own
    // disk, and could never load for anybody else.
    expect(videoUrlKind("file:///C:/match.mp4").kind).toBe("unsupported");
  });

  it("always explains why, never just says no", () => {
    for (const url of ["https://vimeo.com/1", "not a url", "file:///x.mp4"]) {
      const got = videoUrlKind(url);
      if (got.kind !== "unsupported") throw new Error(`expected unsupported for ${url}`);
      expect(got.reason.length, url).toBeGreaterThan(10);
    }
  });
});

describe("youtubeId still behaves", () => {
  it("returns null for anything that is not YouTube", () => {
    expect(youtubeId("https://cdn.example.com/match.mp4")).toBeNull();
  });
});
