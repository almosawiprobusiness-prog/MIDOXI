"use server";

import { revalidatePath } from "next/cache";
import { track } from "@/lib/analytics/track";
import { createClient } from "@/lib/supabase/server";
import { isDemoMode } from "@/lib/env";
import { demoStore } from "@/lib/data/store";
import { listGoals } from "@/lib/data/development";
import { suggestGoal, newGoalFor, categoryForConcept } from "@/lib/knowledge/mapping";
import { concept } from "@/lib/knowledge/concepts";
import { relatedConcepts } from "@/lib/knowledge/graph";

/*
  Closing the loop.

  An observation on a clip becomes evidence against a development goal, which
  is what turns a reading into progress. The chain is short and every link in it
  is the player's:

      MIDO observes  →  MIDO proposes a goal  →  THE PLAYER CONFIRMS  →  evidence

  The third step is not a formality and it is not going away. Attaching film to
  the wrong goal is worse than attaching nothing: the evidence trail is the part
  of MIDO a player will read in three months and believe, and a wrong entry in
  it is a lie with a timestamp on it. So MIDO says what it thinks and why, the
  player agrees or picks something else, and the whole thing is reversible.

  Row provenance is recorded too — `source = 'mido'` means MIDO proposed it and
  the player accepted, never that MIDO decided alone.
*/

export type LoopResult =
  | { ok: true; goalId: string; evidenceId?: string; demo?: boolean }
  | { ok: false; error: string };

export interface ObservationRef {
  videoId: string;
  analysisId: string;
  atSeconds: number;
  title: string;
  body: string;
  concept?: string;
}

export interface LoopProposal {
  concept: { slug: string; name: string; why: string } | null;
  /** The goal MIDO would file this under, if any. */
  goal: { id: string; title: string; category: string } | null;
  because: string;
  strength: "strong" | "likely" | "weak";
  /** The goal it would create instead, when nothing fits. */
  newGoal: { title: string; category: string; why: string } | null;
  /** Everything open, so the player can overrule the suggestion in one click. */
  goals: { id: string; title: string; category: string }[];
  /** Concepts near this one — a better answer is sometimes one edge away. */
  nearby: { slug: string; name: string }[];
}

/**
 * Where MIDO thinks this observation belongs.
 *
 * Read-only. Nothing is written until `confirmObservation` — a proposal a
 * player never sees is not a suggestion, it is a decision made for them.
 */
export async function proposeForObservation(input: {
  concept?: string;
}): Promise<LoopProposal> {
  const goals = await listGoals();
  const open = goals.filter((g) => g.status !== "achieved");
  const list = open.map((g) => ({ id: g.id, title: g.title, category: g.category }));

  if (!input.concept) {
    return {
      concept: null,
      goal: null,
      because: "MIDO did not tie this observation to a curated concept, so it has no view on where it belongs. Pick a goal yourself.",
      strength: "weak",
      newGoal: null,
      goals: list,
      nearby: [],
    };
  }

  const c = concept(input.concept);
  const established = await establishedConcepts();
  const suggestion = suggestGoal({ conceptSlug: input.concept, goals, established });

  return {
    concept: c ? { slug: c.slug, name: c.name, why: c.why } : null,
    goal: suggestion.goal
      ? { id: suggestion.goal.id, title: suggestion.goal.title, category: suggestion.goal.category }
      : null,
    because: suggestion.because,
    strength: suggestion.strength,
    newGoal: suggestion.newGoal ?? null,
    goals: list,
    nearby: relatedConcepts(input.concept, 4).map((n) => ({ slug: n.slug, name: n.name })),
  };
}

/**
 * concept → the goal this player has filed it under before.
 *
 * Their own past decision beats anything MIDO computes, so this is checked
 * first and it is why the suggestion gets better the more the loop is used.
 */
async function establishedConcepts(): Promise<Record<string, string>> {
  if (isDemoMode) return {};

  const supabase = await createClient();
  if (!supabase) return {};
  const { data } = await supabase
    .from("development_evidence")
    .select("goal_id, concept, created_at")
    .not("concept", "is", null)
    .order("created_at", { ascending: false })
    .limit(100);

  const out: Record<string, string> = {};
  for (const row of data ?? []) {
    const key = String(row.concept);
    // Newest first, so the first sighting of a concept is the current answer.
    if (!(key in out)) out[key] = String(row.goal_id);
  }
  return out;
}

/**
 * Attach an observation to a goal, creating the goal first when the player
 * accepted MIDO's proposal to make one.
 */
export async function confirmObservation(input: {
  observation: ObservationRef;
  /** An existing goal, or "new" to create the proposed one. */
  goalId: string | "new";
  /** Required when goalId is "new". */
  newGoalTitle?: string;
}): Promise<LoopResult> {
  const obs = input.observation;
  const note = noteFor(obs);

  if (isDemoMode) {
    const goalId =
      input.goalId === "new"
        ? demoStore.createGoal({
            category: categoryForConcept(obs.concept ?? ""),
            title: (input.newGoalTitle || obs.title).slice(0, 120),
            why: obs.concept ? (newGoalFor(obs.concept)?.why ?? "") : "",
            status: "active",
            progress: 0,
          })
        : input.goalId;
    const evidenceId = demoStore.addEvidence(goalId, {
      kind: "film",
      note,
      concept: obs.concept ?? null,
      atSeconds: obs.atSeconds,
      refId: obs.analysisId,
      source: "mido",
    });
    revalidate(obs.videoId, goalId);
    return { ok: true, goalId, evidenceId, demo: true };
  }

  const supabase = await createClient();
  if (!supabase) return { ok: false, error: "You must be signed in." };
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "You must be signed in." };

  let goalId = input.goalId;

  if (goalId === "new") {
    const proposed = obs.concept ? newGoalFor(obs.concept) : undefined;
    const title = (input.newGoalTitle || proposed?.title || obs.title).trim().slice(0, 120);
    if (!title) return { ok: false, error: "Give the goal a title." };

    const { data, error } = await supabase
      .from("development_goals")
      .insert({
        category: proposed?.category ?? "tactical",
        title,
        why: proposed?.why ?? null,
        status: "active",
        progress: 0,
      })
      .select("id")
      .single();
    if (error) return { ok: false, error: `The goal could not be created: ${error.message}` };
    goalId = data.id as string;
  }

  const { data: ev, error } = await supabase
    .from("development_evidence")
    .insert({
      goal_id: goalId,
      kind: "film",
      note,
      ref_id: obs.analysisId,
      concept: obs.concept ?? null,
      at_seconds: obs.atSeconds,
      // MIDO proposed it. The player is the one who just agreed.
      source: "mido",
    })
    .select("id")
    .single();

  if (error) return { ok: false, error: `The evidence could not be saved: ${error.message}` };

  // The loop closing — a Vision/film finding becoming development evidence —
  // is the single most important downstream action the beta can measure.
  await track("film_observation_filed", { hasConcept: Boolean(obs.concept) });
  revalidate(obs.videoId, goalId);
  return { ok: true, goalId, evidenceId: ev.id as string };
}

/** Undo. Every link the loop makes has to come apart as easily as it went on. */
export async function unconfirmObservation(input: {
  evidenceId: string;
  goalId: string;
  videoId: string;
}): Promise<{ ok: boolean; error?: string }> {
  if (isDemoMode) {
    demoStore.deleteEvidence(input.evidenceId);
    revalidate(input.videoId, input.goalId);
    return { ok: true };
  }
  const supabase = await createClient();
  if (!supabase) return { ok: false, error: "You must be signed in." };
  const { error } = await supabase.from("development_evidence").delete().eq("id", input.evidenceId);
  if (error) return { ok: false, error: error.message };
  revalidate(input.videoId, input.goalId);
  return { ok: true };
}

/** Which observations on this analysis are already filed, so the UI can say so. */
export async function confirmedFor(analysisId: string): Promise<
  { atSeconds: number; goalId: string; evidenceId: string }[]
> {
  if (isDemoMode) return [];
  const supabase = await createClient();
  if (!supabase) return [];
  const { data } = await supabase
    .from("development_evidence")
    .select("id, goal_id, at_seconds")
    .eq("ref_id", analysisId);
  return (data ?? [])
    .filter((r) => r.at_seconds !== null)
    .map((r) => ({
      atSeconds: Number(r.at_seconds),
      goalId: String(r.goal_id),
      evidenceId: String(r.id),
    }));
}

function noteFor(obs: ObservationRef): string {
  const stamp = `${String(Math.floor(obs.atSeconds / 60)).padStart(2, "0")}:${String(
    Math.round(obs.atSeconds % 60),
  ).padStart(2, "0")}`;
  return `${stamp} — ${obs.title}`.slice(0, 300);
}

function revalidate(videoId: string, goalId: string) {
  revalidatePath(`/app/film-room/${videoId}`);
  revalidatePath(`/app/development/${goalId}`);
  revalidatePath("/app/development");
  revalidatePath("/app/timeline");
  revalidatePath("/app");
}
