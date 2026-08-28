import { describe, expect, it } from "vitest";
import {
  LIBRARY_CAP,
  cryptoRandomId,
  dateLabel,
  filterCaptures,
  formatCaptureText,
  formatLibraryJson,
  formatLibraryMarkdown,
  migratePendingToLibrary,
  pendingImport,
  sortNewestFirst,
  toCaptureInput,
  type LocalCapture,
} from "@/extension/src/lib/library-core";

/*
  Free Mode's spine. The library is the free user's whole product —
  what they search, export and own — so its pure logic is pinned here
  the way the capture contract is pinned in captures.test.ts.
*/

function cap(over: Partial<LocalCapture> = {}): LocalCapture {
  return {
    id: over.id ?? cryptoRandomId(),
    videoId: "dQw4w9WgXcQ",
    sourceUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    videoTitle: "Barcelona vs Athletic Club",
    channelName: "ESPN Deportes",
    thumbnailUrl: "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
    timestampSeconds: 314,
    observation: "Raphinha delays his movement until the defender commits centrally.",
    category: "movement",
    createdAt: "2026-08-28T12:00:00.000Z",
    updatedAt: null,
    syncState: "local",
    origin: "chrome_extension",
    ...over,
  };
}

describe("filterCaptures", () => {
  const library = [
    cap({ id: "a", observation: "Raphinha delays the run", category: "movement" }),
    cap({ id: "b", videoTitle: "Rodri Tactical Analysis", observation: "Scans both shoulders", category: "scanning" }),
    cap({ id: "c", channelName: "Tifo", observation: "Back-post finish", category: "finishing" }),
  ];

  it("matches across title, observation, channel and category label", () => {
    expect(filterCaptures(library, { text: "rodri" }).map((c) => c.id)).toEqual(["b"]);
    expect(filterCaptures(library, { text: "delays" }).map((c) => c.id)).toEqual(["a"]);
    expect(filterCaptures(library, { text: "tifo" }).map((c) => c.id)).toEqual(["c"]);
    expect(filterCaptures(library, { text: "scanning" }).map((c) => c.id)).toEqual(["b"]);
  });

  it("requires every term to match somewhere (AND, case-insensitive)", () => {
    expect(filterCaptures(library, { text: "RODRI shoulders" }).map((c) => c.id)).toEqual(["b"]);
    expect(filterCaptures(library, { text: "rodri finish" })).toEqual([]);
  });

  it("filters by category, combinable with text", () => {
    expect(filterCaptures(library, { category: "finishing" }).map((c) => c.id)).toEqual(["c"]);
    expect(filterCaptures(library, { text: "post", category: "finishing" }).map((c) => c.id)).toEqual(["c"]);
    expect(filterCaptures(library, { text: "post", category: "movement" })).toEqual([]);
  });

  it("empty query returns everything", () => {
    expect(filterCaptures(library, {})).toHaveLength(3);
    expect(filterCaptures(library, { text: "  " })).toHaveLength(3);
  });
});

describe("sortNewestFirst / dateLabel", () => {
  it("sorts by createdAt descending without mutating", () => {
    const older = cap({ id: "o", createdAt: "2026-08-01T00:00:00Z" });
    const newer = cap({ id: "n", createdAt: "2026-08-28T00:00:00Z" });
    const input = [older, newer];
    expect(sortNewestFirst(input).map((c) => c.id)).toEqual(["n", "o"]);
    expect(input[0].id).toBe("o");
  });

  it("labels days the way a human scans a list", () => {
    const now = new Date("2026-08-28T15:00:00");
    expect(dateLabel("2026-08-28T09:00:00", now)).toBe("Today");
    expect(dateLabel("2026-08-27T23:00:00", now)).toBe("Yesterday");
    expect(dateLabel("2026-08-02T09:00:00", now)).toBe("2 Aug");
    expect(dateLabel("2025-12-25T09:00:00", now)).toBe("25 Dec 2025");
    expect(dateLabel("garbage", now)).toBe("");
  });
});

describe("formatCaptureText", () => {
  it("is the human clipboard shape from the spec", () => {
    const text = formatCaptureText(cap());
    expect(text).toContain("Barcelona vs Athletic Club\n5:14");
    expect(text).toContain("Observation:\nRaphinha delays");
    expect(text).toContain("Category:\nMovement");
    expect(text).toContain("Watch:\nhttps://www.youtube.com/watch?v=dQw4w9WgXcQ&t=314s");
  });

  it("omits the category block when uncategorised", () => {
    expect(formatCaptureText(cap({ category: null }))).not.toContain("Category:");
  });
});

describe("library export", () => {
  const two = [
    cap({ id: "1", createdAt: "2026-08-27T00:00:00Z" }),
    cap({ id: "2", videoTitle: "Rodri Tactical Analysis", createdAt: "2026-08-28T00:00:00Z" }),
  ];

  it("markdown is readable, newest first, sections separated", () => {
    const md = formatLibraryMarkdown(two, new Date("2026-08-28T12:00:00Z"));
    expect(md.startsWith("# MIDO XI Capture Export")).toBe(true);
    expect(md).toContain("2 moments");
    expect(md.indexOf("Rodri Tactical Analysis")).toBeLessThan(md.indexOf("Barcelona vs Athletic Club"));
    expect(md).toContain("Timestamp: 5:14");
    expect(md).toContain("Watch: https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=314s");
    expect(md.match(/^---$/gm)?.length).toBe(2);
  });

  it("json round-trips", () => {
    const parsed = JSON.parse(formatLibraryJson(two)) as { app: string; captures: LocalCapture[] };
    expect(parsed.app).toBe("MIDO XI Capture");
    expect(parsed.captures).toHaveLength(2);
    expect(parsed.captures[0].id).toBe("2");
  });
});

describe("import to MIDO", () => {
  it("uses the capture id as the client key, so re-imports dedupe", () => {
    const c = cap({ id: "stable-id-123" });
    const input = toCaptureInput(c);
    expect(input.clientKey).toBe("stable-id-123");
    expect(input.goalId).toBeNull();
    expect(input.observation).toBe(c.observation);
  });

  it("only local captures await import", () => {
    const mixed = [cap({ id: "l1" }), cap({ id: "s1", syncState: "synced" }), cap({ id: "l2" })];
    expect(pendingImport(mixed).map((c) => c.id)).toEqual(["l1", "l2"]);
  });
});

describe("migratePendingToLibrary (v0.1 → v0.2)", () => {
  const now = "2026-08-28T12:00:00.000Z";

  it("turns old pending saves into local captures, keeping the client key as id", () => {
    const pending = [
      {
        videoId: "dQw4w9WgXcQ",
        sourceUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        videoTitle: "Old failed save",
        timestampSeconds: 901,
        observation: "Scans both shoulders before receiving.",
        category: "scanning",
        clientKey: "old-key-1",
      },
    ];
    const out = migratePendingToLibrary(pending, [], now);
    expect(out).toHaveLength(1);
    expect(out[0].id).toBe("old-key-1");
    expect(out[0].syncState).toBe("local");
    expect(out[0].timestampSeconds).toBe(901);
  });

  it("skips junk, duplicates and empty observations — never invents notes", () => {
    const existing = [cap({ id: "old-key-1" })];
    const pending = [
      { videoId: "dQw4w9WgXcQ", observation: "kept", clientKey: "old-key-1" }, // dupe of existing
      { videoId: "dQw4w9WgXcQ", observation: "   " }, // empty
      null,
      "garbage",
      { observation: "no video id" },
      { videoId: "dQw4w9WgXcQ", observation: "survives", clientKey: "fresh" },
    ];
    const out = migratePendingToLibrary(pending, existing, now);
    expect(out).toHaveLength(1);
    expect(out[0].id).toBe("fresh");
  });

  it("tolerates non-array input", () => {
    expect(migratePendingToLibrary(undefined, [], now)).toEqual([]);
    expect(migratePendingToLibrary({ not: "array" }, [], now)).toEqual([]);
  });
});

describe("bounds", () => {
  it("the cap exists and is generous", () => {
    expect(LIBRARY_CAP).toBeGreaterThanOrEqual(1000);
  });
  it("ids are unique-ish and non-empty", () => {
    const a = cryptoRandomId();
    const b = cryptoRandomId();
    expect(a).not.toBe(b);
    expect(a.length).toBeGreaterThan(8);
  });
});
