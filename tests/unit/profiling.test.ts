import { describe, it, expect } from "vitest";
import { completeness, missingFields, nextPrompt } from "../../lib/data/profiling";
import type { ProfileSettings } from "../../lib/data/profile";

/*
  Progressive profiling is one step away from being a nag. These tests hold it
  to the rule that makes it not one: every ask names a real behaviour that is
  degraded right now, and only one is ever made at a time.
*/

const profile = (over: Partial<ProfileSettings> = {}): ProfileSettings =>
  ({
    email: "a@b.c",
    fullName: "Sam Reed",
    knownAs: "Sam",
    dateOfBirth: "",
    nationality: "",
    foot: "",
    primaryPosition: "",
    secondaryPosition: "",
    heightCm: null,
    weightKg: null,
    club: "",
    league: "",
    squadNumber: null,
    season: "",
    level: "",
    isPublic: false,
    handle: "",
    playStyle: "",
    favoritePlayers: [],
    strengths: [],
    achievements: "",
    socials: {},
    ...over,
  }) as ProfileSettings;

const full = (): ProfileSettings =>
  profile({
    dateOfBirth: "2004-03-19",
    foot: "Right",
    primaryPosition: "CF",
    club: "Northgate FC",
    level: "Academy",
    playStyle: "Runs in behind, finishes early.",
  });

describe("what gets asked", () => {
  it("asks for position first, because it changes the most", () => {
    expect(nextPrompt(profile())?.field).toBe("primaryPosition");
  });

  it("moves to the next thing once one is answered", () => {
    expect(nextPrompt(profile({ primaryPosition: "CF" }))?.field).toBe("foot");
  });

  it("asks nothing at all of a complete profile", () => {
    expect(nextPrompt(full())).toBeNull();
    expect(missingFields(full())).toEqual([]);
  });

  it("skips what the user has waved away, rather than repeating it", () => {
    expect(nextPrompt(profile(), ["primaryPosition"])?.field).toBe("foot");
    expect(nextPrompt(profile(), ["primaryPosition", "foot"])?.field).toBe("level");
  });

  it("returns null once everything has been dismissed", () => {
    const all = missingFields(profile()).map((p) => p.field);
    expect(nextPrompt(profile(), all)).toBeNull();
  });
});

describe("why it gets asked", () => {
  it("names a real consequence for every prompt, never a generic one", () => {
    for (const p of missingFields(profile())) {
      expect(p.unlocks.length, p.field).toBeGreaterThan(40);
      // "Complete your profile" is exactly the ask this design exists to avoid.
      expect(p.unlocks.toLowerCase(), p.field).not.toMatch(
        /complete your profile|for a better experience|help us/,
      );
    }
  });

  it("sends every prompt somewhere the field can actually be edited", () => {
    for (const p of missingFields(profile())) {
      expect(p.href, p.field).toMatch(/^\/app\//);
    }
  });

  it("offers options only where the answer is a short closed set", () => {
    const byField = Object.fromEntries(missingFields(profile()).map((p) => [p.field, p]));
    expect(byField.primaryPosition.options?.length).toBeGreaterThan(3);
    expect(byField.foot.options).toEqual(["Right", "Left", "Both"]);
    // A club name or a description of how you play is not a picker.
    expect(byField.club.options).toBeUndefined();
    expect(byField.playStyle.options).toBeUndefined();
  });

  it("orders prompts strictly, so 'next' is never ambiguous", () => {
    const priorities = missingFields(profile()).map((p) => p.priority);
    expect(new Set(priorities).size).toBe(priorities.length);
    expect([...priorities].sort((a, b) => a - b)).toEqual(priorities);
  });
});

describe("completeness", () => {
  it("counts only fields that change what the product does", () => {
    expect(completeness(profile())).toEqual({ filled: 0, of: 6 });
    expect(completeness(full())).toEqual({ filled: 6, of: 6 });
  });

  it("ignores fields nobody is prompted for", () => {
    // Filling in height and weight is fine, but it unlocks nothing, so it does
    // not move the number.
    expect(completeness(profile({ heightCm: 183, weightKg: 78 })).filled).toBe(0);
  });
});
