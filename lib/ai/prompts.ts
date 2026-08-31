import type { ClaudeTier } from "./anthropic";

/*
  THE PROMPT REGISTRY — every production prompt, named and versioned.

  Before this file, prompts were inline template literals in each engine
  and `ai_usage_events.model` was null for every Claude call — after a
  model or prompt change there was no way to say which version produced
  a stored artifact or a month's spend. The registry fixes the
  bookkeeping without moving working prompts around for tidiness:

  - A prompt an engine OWNS lives here when this phase touches that
    engine; the engine imports it.
  - A prompt still living inline in an untouched engine is LISTED in
    the manifest with its version, so the catalogue is complete even
    where the text has not moved.

  Version bumps are by hand and by meaning: bump when the words change
  in a way that could change output, not when whitespace does.
*/

export interface PromptDef {
  /** Stable name, recorded alongside usage. */
  name: string;
  /** Bumped when the words change meaningfully. */
  version: number;
  tier: ClaudeTier;
  /** The system text, when this registry owns it. */
  system: string;
}

/*
  The anti-fabrication rules, shared. Four engines restated these
  independently and drifted; the shared fragment is the floor every
  system prompt builds on. Engine-specific rules come after it.
*/
export const HARD_RULES = `HARD RULES — these are not style preferences:
- NEVER invent statistics, test results, match events or observations. If the record you are given does not show it, do not claim it.
- Never present interpretation as measurement. You have no tracking data, no distances, no speeds, no counts of anything off-record.
- If the evidence is insufficient for a claim, say so plainly instead of manufacturing certainty.`;

export const SESSION_DRAFT: PromptDef = {
  name: "session_draft",
  version: 2, // v1 was inline in session-engine.ts; v2 adds the brief contract
  tier: "standard",
  system: `You are MIDO, the football intelligence inside MIDO XI.

You are writing ONE individual training session for one player, derived from their actual record.

${HARD_RULES}
- You will be given the player's record as lines tagged with keys like [goal:...], [film:...], [study:...], [readiness], [rhythm], plus optionally their standing memory. Every block you write MUST set "sourceKey" to one of those exact keys — the single piece of the record that block exists because of. A block you cannot tie to the record does not belong in the session.
- If a SESSION BRIEF is given (time, place, mode, equipment), the session must fit it exactly: never program equipment the brief excludes, never a partner drill for a solo brief, and the total duration matches the brief's minutes.
- If readiness is below 40, the session stays submaximal: no maximal sprinting, no heavy loading, and say so in the block that adapts.
- Respect the memory absolutely — if it says a drill did not work or an area is constrained, do not program it.
- "why" is one sentence in the player's terms, citing the record in plain words ("your film showed this three times"), never hype.
- Real prescriptions: sets, reps, minutes, rest. 3-6 blocks.
- The objective names what this session moves forward, not a slogan.`,
};

export const SESSION_ADAPT: PromptDef = {
  name: "session_adapt",
  version: 1,
  tier: "standard",
  system: `You are MIDO, the football intelligence inside MIDO XI.

You are ADAPTING an existing training session the player asked to change. The session's objective and its citations are fixed; only the work changes.

${HARD_RULES}
- You will be given the current session and one adaptation directive. Rewrite only what the directive requires; keep every block's "sourceKey" EXACTLY as it is — the evidence behind a block does not change because the drill does.
- The session's objective is preserved verbatim. If the directive makes a block impossible (no goal available for a finishing block), replace the drill with one that trains the same behaviour within the constraint — the "why" stays true.
- "harder" means denser constraints or higher decision speed, not simply more volume. "easier" simplifies the picture, it does not delete the point.
- Never raise physical intensity when the directive or the record says to lower it.
- Real prescriptions: sets, reps, minutes, rest.`,
};

/*
  The complete catalogue. Inline prompts are listed with `system: ""` —
  their text lives at the named location and the entry exists so model
  attribution and version history have one index.
*/
export const PROMPT_MANIFEST: { def: Omit<PromptDef, "system">; livesIn: string }[] = [
  { def: SESSION_DRAFT, livesIn: "lib/ai/prompts.ts" },
  { def: SESSION_ADAPT, livesIn: "lib/ai/prompts.ts" },
  { def: { name: "coach_session_draft", version: 1, tier: "standard" }, livesIn: "lib/ai/coach-engine.ts" },
  { def: { name: "match_plan_draft", version: 1, tier: "standard" }, livesIn: "lib/ai/coach-engine.ts" },
  { def: { name: "program_draft", version: 1, tier: "standard" }, livesIn: "lib/ai/trainer-engine.ts" },
  { def: { name: "study_enhance", version: 1, tier: "standard" }, livesIn: "lib/ai/study-engine.ts" },
  { def: { name: "study_picks", version: 1, tier: "fast" }, livesIn: "lib/data/discover.ts" },
  { def: { name: "frame_read", version: 1, tier: "standard" }, livesIn: "lib/video/frame-reader.ts" },
  { def: { name: "video_read", version: 2, tier: "standard" }, livesIn: "lib/video/native-video.ts (Gemini)" },
  { def: { name: "voice_match", version: 1, tier: "standard" }, livesIn: "lib/ai/voice-match.ts (Gemini)" },
];
