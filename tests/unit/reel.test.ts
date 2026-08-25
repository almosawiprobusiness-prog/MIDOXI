import { describe, it, expect } from "vitest";
import {
  clipEnd,
  reelOrder,
  collectionReelOrder,
  REEL_TAIL_SECONDS,
  type FilmClip,
} from "../../lib/data/film-types";

/*
  The reel plays clips end to end. Two decisions define what that means,
  and both have a wrong answer that only shows up in front of a squad:
  where a clip stops, and what order they run in.
*/

const clip = (over: Partial<FilmClip>): FilmClip => ({
  id: "c",
  videoId: "v",
  title: "clip",
  startSeconds: 0,
  endSeconds: null,
  sentiment: null,
  note: "",
  favorite: false,
  tags: [],
  createdAt: "2026-01-01T00:00:00Z",
  ...over,
});

describe("where a clip stops", () => {
  it("uses the marked end when there is one", () => {
    expect(clipEnd(clip({ startSeconds: 10, endSeconds: 22 }))).toBe(22);
  });

  it("gives an unmarked clip a tail instead of running to the final whistle", () => {
    // "Mark out" is optional and most clips are cut without it. Played
    // back literally, one would run to the end of the match.
    expect(clipEnd(clip({ startSeconds: 10, endSeconds: null }))).toBe(10 + REEL_TAIL_SECONDS);
  });

  it("treats an end before the start as no end at all", () => {
    // Happens for real: mark out, then scrub back and mark in later.
    // Taken literally this is a zero-length clip the reel skips past.
    expect(clipEnd(clip({ startSeconds: 30, endSeconds: 12 }))).toBe(30 + REEL_TAIL_SECONDS);
  });

  it("treats an end equal to the start the same way", () => {
    expect(clipEnd(clip({ startSeconds: 30, endSeconds: 30 }))).toBe(30 + REEL_TAIL_SECONDS);
  });

  it("survives a corrupt end without returning NaN", () => {
    // A NaN end propagates into `t >= end`, which is false forever —
    // the reel would stick on that clip and never advance.
    expect(clipEnd(clip({ startSeconds: 5, endSeconds: NaN }))).toBe(5 + REEL_TAIL_SECONDS);
    expect(clipEnd(clip({ startSeconds: 5, endSeconds: Infinity }))).toBe(5 + REEL_TAIL_SECONDS);
  });

  it("always ends after it starts, whatever it is given", () => {
    for (const end of [null, undefined, NaN, -50, 0, 1]) {
      const c = clip({ startSeconds: 20, endSeconds: end as number | null });
      expect(clipEnd(c)).toBeGreaterThan(c.startSeconds);
    }
  });
});

describe("what order a reel runs in", () => {
  const a = clip({ id: "a", startSeconds: 90, createdAt: "2026-03-01T00:00:00Z" });
  const b = clip({ id: "b", startSeconds: 12, createdAt: "2026-03-02T00:00:00Z" });
  const c = clip({ id: "c", startSeconds: 45, createdAt: "2026-03-03T00:00:00Z" });

  it("runs up the tape, not newest-first like the library", () => {
    // The library lists newest first, which is right for a library and
    // backwards for presenting a match.
    expect(reelOrder([a, b, c]).map((x) => x.id)).toEqual(["b", "c", "a"]);
  });

  it("does not mutate the list it was given", () => {
    const input = [a, b, c];
    reelOrder(input);
    expect(input.map((x) => x.id)).toEqual(["a", "b", "c"]);
  });

  it("handles nothing and one thing without complaint", () => {
    expect(reelOrder([])).toEqual([]);
    expect(reelOrder([a]).map((x) => x.id)).toEqual(["a"]);
  });

  it("keeps both clips when two start at the same second", () => {
    const twin = clip({ id: "twin", startSeconds: 12 });
    expect(reelOrder([b, twin])).toHaveLength(2);
  });
});

describe("what order a COLLECTION plays in", () => {
  const item = (id: string, videoId: string, startSeconds: number) => ({
    clip: clip({ id, videoId, startSeconds }),
  });

  /*
    A collection is a theme — every pressing correction this month — so
    its clips come from different matches. Sorting purely by timestamp,
    which is right within one video, is meaningless across several:
    12:30 in one match has nothing to do with 12:30 in another.
  */
  it("groups by video in the given order, then runs up each tape", () => {
    const got = collectionReelOrder(
      [item("c", "vB", 5), item("a", "vA", 90), item("d", "vB", 1), item("b", "vA", 12)],
      ["vA", "vB"],
    );
    expect(got.map((i) => i.clip.id)).toEqual(["b", "a", "d", "c"]);
  });

  it("does not interleave two matches by the clock", () => {
    // The failure this ordering exists to prevent: 0:10 of match two
    // landing between 0:05 and 0:20 of match one.
    const got = collectionReelOrder(
      [item("one-early", "vA", 5), item("two", "vB", 10), item("one-late", "vA", 20)],
      ["vA", "vB"],
    );
    expect(got.map((i) => i.clip.videoId)).toEqual(["vA", "vA", "vB"]);
  });

  it("keeps every clip from one video together, so sources swap once", () => {
    // Each swap is a fresh load and a visible gap. Three swaps instead
    // of twelve is the difference between a session and a slideshow.
    const got = collectionReelOrder(
      [item("a", "vA", 1), item("b", "vB", 1), item("c", "vA", 2), item("d", "vB", 2)],
      ["vA", "vB"],
    );
    const swaps = got.filter((x, i) => i > 0 && got[i - 1].clip.videoId !== x.clip.videoId).length;
    expect(swaps).toBe(1);
  });

  it("shows a clip whose video is unknown rather than dropping it", () => {
    // Sorting it last is a judgement; losing it is a bug.
    const got = collectionReelOrder([item("orphan", "gone", 3), item("a", "vA", 9)], ["vA"]);
    expect(got.map((i) => i.clip.id)).toEqual(["a", "orphan"]);
  });

  it("does not mutate the list it was given", () => {
    const input = [item("b", "vB", 1), item("a", "vA", 1)];
    collectionReelOrder(input, ["vA", "vB"]);
    expect(input.map((i) => i.clip.id)).toEqual(["b", "a"]);
  });

  it("handles an empty collection and an empty video order", () => {
    expect(collectionReelOrder([], ["vA"])).toEqual([]);
    expect(collectionReelOrder([item("a", "vA", 1)], [])).toHaveLength(1);
  });
});
