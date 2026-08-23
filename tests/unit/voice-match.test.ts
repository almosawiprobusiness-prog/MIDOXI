import { describe, it, expect } from "vitest";
import {
  MAX_RECORDING_SECONDS,
  MIN_RECORDING_SECONDS,
  PREFERRED_AUDIO_TYPES,
  clockLabel,
  draftIssue,
  draftSummary,
  pickAudioType,
  readDraft,
  type VoiceDraft,
} from "../../lib/ai/voice-match-types";

/*
  Talking a match into the record.

  The property this whole feature rests on: MIDO fills in ONLY what was said,
  and what it did not hear stays visibly empty. An empty number input and a
  zero look identical and mean the opposite, so "MIDO did not catch the
  minutes" and "they played nought minutes" must never render the same way.

  Everything here is the pure half — the shaping and the reading. The model
  call is exercised against real speech separately, because a unit test cannot
  tell you whether it mishears "sixty eight" as "seventy eight".
*/

const draft = (over: Partial<VoiceDraft> = {}): VoiceDraft => ({
  transcript: "Away to Halton, we won two one.",
  opponent: "Halton Town",
  competition: null,
  playedAt: "2026-08-22",
  home: false,
  goalsFor: 2,
  goalsAgainst: 1,
  position: null,
  started: null,
  minutes: null,
  goals: null,
  assists: null,
  rating: null,
  notes: null,
  ...over,
});

describe("what was heard, and what was not", () => {
  it("separates the two rather than showing blanks", () => {
    const { heard, missed } = readDraft(draft());
    expect(heard.map((f) => f.key)).toContain("opponent");
    expect(heard.map((f) => f.key)).toContain("goalsFor");
    expect(missed.map((f) => f.key)).toContain("minutes");
    expect(missed.map((f) => f.key)).toContain("position");
  });

  it("never loses a field between the two lists", () => {
    const { heard, missed } = readDraft(draft());
    const all = [...heard, ...missed].map((f) => f.key);
    expect(new Set(all).size).toBe(all.length);
    expect(all.length).toBeGreaterThan(10);
  });

  it("treats a real zero as heard, not as missing", () => {
    /*
      The distinction the whole screen exists for. "I didn't score" is a fact
      worth recording; "MIDO didn't catch whether you scored" is not, and they
      must not look the same.
    */
    const { heard, missed } = readDraft(draft({ goals: 0, assists: 0 }));
    expect(heard.map((f) => f.key)).toContain("goals");
    expect(missed.map((f) => f.key)).not.toContain("goals");
    expect(heard.find((f) => f.key === "goals")?.display).toBe("0");
  });

  it("says away rather than false", () => {
    expect(readDraft(draft({ home: false })).heard.find((f) => f.key === "home")?.display).toBe("Away");
    expect(readDraft(draft({ home: true })).heard.find((f) => f.key === "home")?.display).toBe("Home");
  });

  it("says off the bench rather than false", () => {
    expect(readDraft(draft({ started: false })).heard.find((f) => f.key === "started")?.display).toBe(
      "Off the bench",
    );
  });

  it("shows a date the way a person reads one", () => {
    const shown = readDraft(draft({ playedAt: "2026-08-22" })).heard.find((f) => f.key === "playedAt")!;
    expect(shown.display).toMatch(/Aug/);
    expect(shown.display).not.toBe("2026-08-22");
  });
});

describe("what may be saved", () => {
  it("needs only the opponent", () => {
    // Everything else can be added later. Refusing to save a match because the
    // competition is missing would lose the record to protect its tidiness.
    expect(draftIssue(draft())).toBeNull();
  });

  it("refuses without one, and says what to do", () => {
    const issue = draftIssue(draft({ opponent: null }));
    expect(issue).toMatch(/opponent/i);
    expect(issue).toMatch(/add/i);
  });

  it("does not accept whitespace as an opponent", () => {
    expect(draftIssue(draft({ opponent: "   " }))).toBeTruthy();
  });
});

describe("the summary on the confirm button", () => {
  it("counts rather than claiming success", () => {
    // "9 of 12 heard" is checkable. "Got it!" is not.
    const s = draftSummary(draft());
    expect(s).toMatch(/\d+ of \d+/);
  });

  it("says so plainly when everything was heard", () => {
    const full = draft({
      competition: "League",
      position: "8",
      started: true,
      minutes: 68,
      goals: 0,
      assists: 1,
      rating: 7,
    });
    expect(draftSummary(full)).toMatch(/^All \d+ fields heard\.$/);
  });
});

describe("recording", () => {
  it("prefers a container the speech model accepts", () => {
    // All four were tested against the model and accepted; the order is about
    // what the browser will give us and how small it is for speech.
    expect(pickAudioType((t) => t.startsWith("audio/ogg"))).toBe("audio/ogg;codecs=opus");
    expect(pickAudioType((t) => t === "audio/webm")).toBe("audio/webm");
    expect(pickAudioType((t) => t === "audio/mp4")).toBe("audio/mp4");
  });

  it("returns null rather than a format nothing supports", () => {
    expect(pickAudioType(() => false)).toBeNull();
  });

  it("only ever offers types that were verified against the model", () => {
    for (const t of PREFERRED_AUDIO_TYPES) {
      expect(t, t).toMatch(/^audio\/(ogg|webm|mp4)/);
    }
  });

  it("bounds the recording at both ends", () => {
    expect(MIN_RECORDING_SECONDS).toBeGreaterThan(0);
    expect(MAX_RECORDING_SECONDS).toBeGreaterThan(MIN_RECORDING_SECONDS);
    // Past a couple of minutes this is a monologue, not a match report.
    expect(MAX_RECORDING_SECONDS).toBeLessThanOrEqual(180);
  });

  it("clocks in minutes and seconds", () => {
    expect(clockLabel(0)).toBe("00:00");
    expect(clockLabel(9)).toBe("00:09");
    expect(clockLabel(75)).toBe("01:15");
    expect(clockLabel(-5)).toBe("00:00");
  });
});
