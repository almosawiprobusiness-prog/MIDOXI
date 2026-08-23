"use server";

import { draftMatchFromVoice, voiceStatus } from "@/lib/ai/voice-match";
import { draftIssue, type VoiceDraft } from "@/lib/ai/voice-match-types";
import { createMatch } from "./actions";
import { listMatches } from "@/lib/data/matches";
import { getProfileSettings } from "@/lib/data/profile";
import { searchClubs } from "@/lib/data/clubs";

/*
  Talking a match into the record.

  Two steps, and the gap between them is the point: MIDO listens and fills in a
  form, the player reads it and confirms. Nothing is written from a recording
  alone. Speech recognition mishears numbers more than anything else — "sixty
  eight" and "seventy eight" are one consonant apart — and a wrong minutes
  figure would sit in a report six months later looking like a fact.

  The audio itself is never stored. It is read once, turned into fields, and
  dropped.
*/

export type VoiceResponse =
  | { ok: true; draft: VoiceDraft }
  | { ok: false; error: string };

export async function listenForMatch(audio: string): Promise<VoiceResponse> {
  if (!audio) return { ok: false, error: "Nothing was recorded." };

  /*
    Today comes from the SERVER, not the browser.

    The model needs it to resolve "yesterday" and "Saturday", and a date the
    client supplied would be a date the client could get wrong — a phone with a
    skewed clock would file a match on a day it was not played, and the
    timeline would be quietly out of order forever.
  */
  const today = new Date().toISOString();

  /*
    Names this player has already used, so a misheard club can be corrected
    rather than filed as a second team. Their own opponents first — those are
    the ones they are most likely to play again — then their club, then a few
    from the shared directory.
  */
  const [matches, profile] = await Promise.all([listMatches(), getProfileSettings()]);
  const mine = matches.map((m) => m.opponent).filter(Boolean);
  const nearby = profile.club ? (await searchClubs(profile.club.slice(0, 4))).map((c) => c.name) : [];

  const known = [...new Set([...mine, profile.club, ...nearby].filter(Boolean))] as string[];
  return draftMatchFromVoice(audio, today, known);
}

/** Whether the button should be offered at all, and what to say if not. */
export async function voiceAvailability() {
  return voiceStatus();
}

/**
 * Save what the player confirmed.
 *
 * Takes the draft as edited on screen, not as MIDO produced it — every field is
 * editable and the one that ends up in the record is the one they saw.
 */
export async function saveVoiceMatch(draft: VoiceDraft): Promise<{ ok: true } | { ok: false; error: string }> {
  const issue = draftIssue(draft);
  if (issue) return { ok: false, error: issue };

  const res = await createMatch({
    opponent: draft.opponent!.trim(),
    competition: draft.competition ?? undefined,
    // The form's `playedAt` is a datetime; a spoken date has no time in it, so
    // it lands at midday rather than at midnight — far enough from either
    // boundary that no timezone puts it on the wrong day.
    playedAt: `${draft.playedAt}T12:00`,
    home: draft.home ?? true,
    goalsFor: draft.goalsFor,
    goalsAgainst: draft.goalsAgainst,
    position: draft.position ?? undefined,
    started: draft.started ?? true,
    minutes: draft.minutes,
    rating: draft.rating,
    // The form requires numbers here. A null means MIDO did not hear one, and
    // zero is the truthful reading of "they did not say they scored".
    goals: draft.goals ?? 0,
    assists: draft.assists ?? 0,
  });

  if (!res.ok) return { ok: false, error: res.error };
  return { ok: true };
}
