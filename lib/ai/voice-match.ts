import "server-only";
import { checkFeature } from "@/lib/billing/membership";
import { consumeFeature, logAiUsage, releaseFeature } from "@/lib/billing/meter";
import { withinAiBudget } from "@/lib/billing/budget";
import { refusalReason } from "@/lib/billing/gate-copy";
import { geminiConfigured, VIDEO_MODEL } from "@/lib/video/gemini";
import { env } from "@/lib/env";
import type { VoiceDraft } from "./voice-match-types";

/*
  Ninety seconds on the bus home, instead of a form.

  Logging a match is the single biggest data-loss point in this product.
  Everything built on top of the record — the timeline, the reports, the
  per-90s, half of what MIDO remembers — reads from `matches`, and a form at
  the end of a Sunday is where the record stops getting written.

  So: hold a button, say what happened, and MIDO fills the form in for you to
  check.

  THE RULE THAT MATTERS. It fills in only what was actually said. If minutes
  were not mentioned, minutes come back null — not 90, not "probably a full
  game". A form that quietly guesses is worse than a form that stays empty,
  because the guess ends up in a report six months later looking like a fact.
  The transcript is returned alongside so the player can see exactly what MIDO
  heard, and nothing is written until they confirm.
*/

const SYSTEM = `You are MIDO, turning a footballer's spoken account of a match into form fields.

They are talking casually, often straight after playing. Expect half-sentences, corrections mid-flow, and things left out.

HARD RULES:
- Fill in ONLY what they actually said. Anything not mentioned must be null. Never infer, never default, never "reasonably assume". If they did not say how long they played, minutes is null — not 90.
- If they correct themselves ("we won 2-1, no sorry 3-1"), take the correction.
- "We" is their team. A score is theirs first: "we won 2-1" means goalsFor 2, goalsAgainst 1.
- Goals and assists are THEIRS personally, not the team's. "We scored three" is not three goals for them. Only count goals they say they scored.
- Positions come back as one of: GK, RB, RCB, LCB, LB, RWB, LWB, 6, 8, 10, RW, LW, CF, ST. Map what they say — "right eight" is 8, "up top" is ST, "right back" is RB. If it is not clearly one of these, null.
- Dates: today's date is given to you. "Yesterday", "Saturday", "last week" are relative to it. If no date is mentioned at all, use today. Never invent a date in the future.
- rating is only set if they gave themselves a number out of ten. Their mood is not a rating.
- Put anything you heard that does not fit a field — how it felt, what went wrong, what to work on — into "notes", in their own words. Do not tidy it into coaching language.
- transcript is what you heard, verbatim. It is shown to them so they can check you.
- Club names are the hardest thing to hear correctly. You are given the opponents this player has faced before and the clubs other players have named. If what you heard is plainly one of those with a different spelling — "Houghton" for "Halton" — use the name from the list. If it is genuinely a new club, keep what you heard; do not force it onto the nearest entry.

If the audio contains nothing about a football match, set heardAMatch false and leave every field null.`;

/** Gemini's schema dialect: the OpenAPI subset, no additionalProperties. */
const SCHEMA = {
  type: "object",
  properties: {
    heardAMatch: { type: "boolean" },
    transcript: { type: "string", description: "Verbatim, so they can check you." },
    opponent: { type: "string", nullable: true },
    competition: { type: "string", nullable: true },
    playedAt: { type: "string", nullable: true, description: "YYYY-MM-DD" },
    home: { type: "boolean", nullable: true },
    goalsFor: { type: "integer", nullable: true },
    goalsAgainst: { type: "integer", nullable: true },
    position: { type: "string", nullable: true },
    started: { type: "boolean", nullable: true },
    minutes: { type: "integer", nullable: true },
    goals: { type: "integer", nullable: true },
    assists: { type: "integer", nullable: true },
    rating: { type: "number", nullable: true },
    notes: { type: "string", nullable: true },
  },
  required: ["heardAMatch", "transcript"],
} as const;

export type VoiceOutcome =
  | { ok: true; draft: VoiceDraft }
  | { ok: false; error: string };

/** Whether voice logging can run right now, and what it would take if not. */
export async function voiceStatus(): Promise<{ available: boolean; reason: string | null }> {
  if (!geminiConfigured()) {
    return {
      available: false,
      reason:
        "Voice logging needs a speech model, which is not configured on this deployment. The match form is unaffected.",
    };
  }
  const gate = await checkFeature("ai_interactions");
  if (!gate.allowed) {
    return { available: false, reason: refusalReason(gate, "ai_interactions", "player") };
  }
  if (!(await withinAiBudget())) {
    return { available: false, reason: "AI is paused this month. The match form still works." };
  }
  return { available: true, reason: null };
}

/**
 * Listen to a recording and fill in the form.
 *
 * `audio` is a base64 data URL from the browser's MediaRecorder. It is never
 * stored — it is read once, turned into fields, and dropped.
 */
export async function draftMatchFromVoice(
  audio: string,
  todayIso: string,
  /**
   * Club names this player has used before, plus ones other players have.
   *
   * Speech recognition is at its worst on proper nouns — tested against real
   * speech it heard "Halton" as "Houghton", which is the sort of thing nobody
   * notices until the timeline has two clubs in it that are the same club.
   * These are names from the record, so matching against them is correcting a
   * mishearing rather than guessing at one.
   */
  knownNames: string[] = [],
): Promise<VoiceOutcome> {
  const status = await voiceStatus();
  if (!status.available) return { ok: false, error: status.reason ?? "Voice logging is unavailable." };

  const match = /^data:(audio\/[a-z0-9.+-]+)(;codecs=[^;,]+)?;base64,(.+)$/i.exec(audio ?? "");
  if (!match) return { ok: false, error: "That recording could not be read." };

  const [, mimeBase, , b64] = match;
  const bytes = Math.ceil((b64.length * 3) / 4);
  // Two minutes of Opus is well under this. A larger body is a bug somewhere,
  // and worth refusing before it becomes a slow request.
  if (bytes > 8 * 1024 * 1024) {
    return { ok: false, error: "That recording is too long. Keep it under a couple of minutes." };
  }

  if (!(await consumeFeature("ai_interactions"))) {
    return { ok: false, error: "Voice logging is unavailable on this plan." };
  }

  const started = Date.now();
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${VIDEO_MODEL}:generateContent`,
    {
      method: "POST",
      headers: { "x-goog-api-key": env.geminiKey, "content-type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM }] },
        contents: [
          {
            role: "user",
            parts: [
              { inlineData: { mimeType: mimeBase, data: b64 } },
              {
                text: JSON.stringify({
                  todayIs: todayIso,
                  clubNamesThisPlayerHasUsed: knownNames.slice(0, 40),
                }),
              },
            ],
          },
        ],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: SCHEMA,
          // Thinking is charged against this and is most of it. See gemini.ts.
          maxOutputTokens: 4000,
          temperature: 0,
        },
      }),
    },
  );

  const json = (await res.json().catch(() => ({}))) as {
    candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[];
    usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number; thoughtsTokenCount?: number };
    error?: { message?: string };
  };

  const usage = json.usageMetadata ?? {};
  await logAiUsage({
    feature: "ai_interactions",
    tier: "video",
    model: VIDEO_MODEL,
    inputTokens: usage.promptTokenCount ?? 0,
    // Thinking is billed as output and is not in candidatesTokenCount.
    outputTokens: (usage.candidatesTokenCount ?? 0) + (usage.thoughtsTokenCount ?? 0),
    latencyMs: Date.now() - started,
    status: res.ok ? "ok" : "error",
  });

  if (!res.ok) {
    // Charged before the call, and the call produced nothing. Give it back.
    await releaseFeature("ai_interactions");
    if (res.status === 429) {
      return { ok: false, error: "The speech model is rate limited right now. Nothing was charged." };
    }
    if (res.status === 503) {
      return { ok: false, error: "The speech model is busy right now. Nothing was charged — try again in a minute." };
    }
    return { ok: false, error: `That recording could not be read (${res.status}). Nothing was charged.` };
  }

  const text = json.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
  if (!text) {
    await releaseFeature("ai_interactions");
    return { ok: false, error: "Nothing came back from that recording. Nothing was charged." };
  }

  let data: Record<string, unknown>;
  try {
    data = JSON.parse(text) as Record<string, unknown>;
  } catch {
    await releaseFeature("ai_interactions");
    return { ok: false, error: "That recording came back in a shape MIDO could not use." };
  }

  if (data.heardAMatch === false) {
    return {
      ok: false,
      error: `MIDO did not hear a match in that. It heard: "${String(data.transcript ?? "").slice(0, 160)}"`,
    };
  }

  return { ok: true, draft: shape(data, todayIso) };
}

const POSITIONS = new Set([
  "GK", "RB", "RCB", "LCB", "LB", "RWB", "LWB", "6", "8", "10", "RW", "LW", "CF", "ST",
]);

function num(v: unknown, min: number, max: number): number | null {
  const n = Number(v);
  if (v === null || v === undefined || !Number.isFinite(n)) return null;
  if (n < min || n > max) return null;
  return n;
}

/*
  Everything the model returned, clamped to what the form can hold.

  Out-of-range values become null rather than being squashed to the nearest
  legal number: 140 minutes is a mishearing, and 120 would look like a fact.
  Null shows up as an empty field the player fills in, which is the honest
  outcome of not having understood.
*/
function shape(d: Record<string, unknown>, todayIso: string): VoiceDraft {
  const played = typeof d.playedAt === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d.playedAt)
    ? d.playedAt
    : todayIso.slice(0, 10);

  const position = typeof d.position === "string" && POSITIONS.has(d.position.toUpperCase())
    ? d.position.toUpperCase()
    : null;

  return {
    transcript: String(d.transcript ?? ""),
    opponent: typeof d.opponent === "string" ? d.opponent.trim().slice(0, 80) : null,
    competition: typeof d.competition === "string" ? d.competition.trim().slice(0, 80) : null,
    // Never later than today. A match in the future is a mishearing.
    playedAt: played > todayIso.slice(0, 10) ? todayIso.slice(0, 10) : played,
    home: typeof d.home === "boolean" ? d.home : null,
    goalsFor: num(d.goalsFor, 0, 30),
    goalsAgainst: num(d.goalsAgainst, 0, 30),
    position,
    started: typeof d.started === "boolean" ? d.started : null,
    minutes: num(d.minutes, 0, 130),
    goals: num(d.goals, 0, 15),
    assists: num(d.assists, 0, 15),
    rating: num(d.rating, 0, 10),
    notes: typeof d.notes === "string" ? d.notes.trim().slice(0, 600) : null,
  };
}
