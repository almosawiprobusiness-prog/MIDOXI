import "server-only";
import { createClient } from "@/lib/supabase/server";
import { isDemoMode } from "@/lib/env";
import { concept } from "@/lib/knowledge/concepts";
import { listGoals } from "./development";
import { getTimeline } from "./timeline";
import type { Memory, MemoryInput, MemoryKind } from "./memory-types";

/*
  What MIDO remembers about one player.

  Two halves. Reading and writing rows is unremarkable. The interesting half is
  where a proposal comes from — and the answer is: the record, arithmetically.

  It would be easy to ask a model "what should you remember about this player?"
  and store what came back. It would also be the single worst thing this
  codebase could do. A memory is the most durable claim in the product: it is
  injected into every future prompt, so a fabricated one does not merely appear
  once, it quietly shapes every answer the player gets from then on.

  So proposals are counted, not generated. "You have filed four pieces of
  evidence about blindside movement since April" is a fact about their data,
  and MIDO can show the arithmetic. The player still confirms.
*/

function rowTo(r: Record<string, unknown>): Memory {
  return {
    id: String(r.id),
    kind: r.kind as MemoryKind,
    body: String(r.body ?? ""),
    concept: (r.concept as string) ?? null,
    source: (r.source as "self" | "mido") ?? "self",
    because: (r.because as string) ?? null,
    updatedAt: String(r.updated_at ?? new Date().toISOString()),
  };
}

interface DemoDB {
  rows: Memory[];
  seq: number;
}
const g = globalThis as unknown as { __midoMemoryDB?: DemoDB };
const demoDB: DemoDB = (g.__midoMemoryDB ??= {
  rows: [
    {
      id: "m1",
      kind: "constraint",
      body: "Two team sessions a week plus one gym slot. No pitch access at weekends.",
      concept: null,
      source: "self",
      because: null,
      updatedAt: new Date().toISOString(),
    },
    {
      id: "m2",
      kind: "tried",
      body: "Six weeks of near-post finishing reps — the timing improved, the finish did not.",
      concept: "near-post-finishing",
      source: "self",
      because: null,
      updatedAt: new Date().toISOString(),
    },
  ],
  seq: 3,
});

export async function listMemory(): Promise<Memory[]> {
  if (isDemoMode) return [...demoDB.rows];

  const supabase = await createClient();
  if (!supabase) return [];
  const { data } = await supabase
    .from("player_memory")
    .select("id, kind, body, concept, source, because, updated_at")
    .order("updated_at", { ascending: false })
    .limit(100);
  return (data ?? []).map(rowTo);
}

export async function addMemory(input: MemoryInput): Promise<Memory | null> {
  const body = input.body.trim();
  if (!body) return null;

  if (isDemoMode) {
    const row: Memory = {
      id: `m${demoDB.seq++}`,
      kind: input.kind,
      body,
      concept: input.concept ?? null,
      source: input.source ?? "self",
      because: input.because ?? null,
      updatedAt: new Date().toISOString(),
    };
    demoDB.rows.unshift(row);
    return row;
  }

  const supabase = await createClient();
  if (!supabase) return null;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  /*
    Upsert on the unique index rather than insert. Confirming the same
    proposal twice — which happens, because the proposal keeps being true —
    should refresh one row, not stack two identical facts into the prompt.
  */
  const { data } = await supabase
    .from("player_memory")
    .upsert(
      {
        user_id: user.id,
        kind: input.kind,
        body,
        concept: input.concept ?? null,
        source: input.source ?? "self",
        because: input.because ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,kind,body", ignoreDuplicates: false },
    )
    .select("id, kind, body, concept, source, because, updated_at")
    .maybeSingle();

  return data ? rowTo(data) : null;
}

export async function updateMemory(id: string, body: string): Promise<boolean> {
  const trimmed = body.trim();
  if (!trimmed) return false;

  if (isDemoMode) {
    const row = demoDB.rows.find((r) => r.id === id);
    if (!row) return false;
    row.body = trimmed;
    // A memory the player edits becomes theirs, whoever first proposed it.
    row.source = "self";
    row.updatedAt = new Date().toISOString();
    return true;
  }

  const supabase = await createClient();
  if (!supabase) return false;
  const { error } = await supabase
    .from("player_memory")
    .update({ body: trimmed, source: "self", updated_at: new Date().toISOString() })
    .eq("id", id);
  return !error;
}

export async function deleteMemory(id: string): Promise<boolean> {
  if (isDemoMode) {
    const i = demoDB.rows.findIndex((r) => r.id === id);
    if (i < 0) return false;
    demoDB.rows.splice(i, 1);
    return true;
  }
  const supabase = await createClient();
  if (!supabase) return false;
  const { error } = await supabase.from("player_memory").delete().eq("id", id);
  return !error;
}

// ---------------------------------------------------------------------------
// Proposals, counted rather than generated
// ---------------------------------------------------------------------------

export interface MemoryProposal {
  kind: MemoryKind;
  body: string;
  /** The arithmetic. Shown to the player verbatim. */
  because: string;
  concept: string | null;
}

const MIN_EVIDENCE = 3;

/**
 * Things worth remembering, derived from what is already recorded.
 *
 * Every proposal can be traced to rows the player can go and look at, and the
 * `because` line says which. Nothing here asks a model anything.
 */
export async function proposeMemories(): Promise<MemoryProposal[]> {
  const [goals, view, existing] = await Promise.all([
    listGoals(),
    getTimeline({ days: 365, kinds: ["evidence", "goal_reached", "match"], limit: 1000 }),
    listMemory(),
  ]);

  const already = new Set(existing.map((m) => `${m.kind}:${m.body.trim().toLowerCase()}`));
  const out: MemoryProposal[] = [];

  // ── a concept that keeps coming back ─────────────────────────
  const byConcept = new Map<string, { n: number; first: string }>();
  for (const e of view.entries) {
    if (e.kind !== "evidence") continue;
    const slug = String(e.meta.concept ?? "");
    if (!slug) continue;
    const row = byConcept.get(slug) ?? { n: 0, first: e.occurredAt };
    row.n++;
    if (e.occurredAt < row.first) row.first = e.occurredAt;
    byConcept.set(slug, row);
  }
  for (const [slug, row] of byConcept) {
    if (row.n < MIN_EVIDENCE) continue;
    const c = concept(slug);
    if (!c) continue;
    const since = new Date(row.first).toLocaleDateString("en-GB", { month: "long" });
    out.push({
      kind: "weakness",
      concept: slug,
      body: `${c.name} keeps coming up — it is the thing to keep working on.`,
      because: `${row.n} pieces of evidence filed against ${c.name.toLowerCase()} since ${since}.`,
    });
  }

  // ── something reached ────────────────────────────────────────
  for (const e of view.entries) {
    if (e.kind !== "goal_reached") continue;
    out.push({
      kind: "strength",
      concept: null,
      body: `${e.title} — worked on and reached.`,
      because: `Marked achieved on your development board.`,
    });
  }

  // ── a position that is not the one on the profile ────────────
  const played = new Map<string, number>();
  for (const e of view.entries) {
    if (e.kind !== "match") continue;
    const pos = String(e.meta.position ?? "");
    if (pos) played.set(pos, (played.get(pos) ?? 0) + 1);
  }
  if (played.size > 1) {
    const ranked = [...played.entries()].sort((a, b) => b[1] - a[1]);
    const [top, second] = ranked;
    if (second && second[1] >= 2) {
      out.push({
        kind: "context",
        concept: null,
        body: `Playing across two positions — mostly ${top[0]}, but ${second[1]} matches at ${second[0]}.`,
        because: `Your match log: ${ranked.map(([p, n]) => `${n} at ${p}`).join(", ")}.`,
      });
    }
  }

  // ── a goal nobody has touched ────────────────────────────────
  const withEvidence = new Set(
    view.entries.filter((e) => e.kind === "evidence").map((e) => String(e.meta.goalId ?? "")),
  );
  const untouched = goals.filter((g) => g.status === "active" && !withEvidence.has(g.id));
  if (untouched.length > 0 && goals.length > untouched.length) {
    out.push({
      kind: "context",
      concept: null,
      body: `${untouched.map((g) => g.title).join(" and ")} — set, but nothing attached yet.`,
      because: `Open on your development board with no evidence against ${untouched.length === 1 ? "it" : "them"}.`,
    });
  }

  return out.filter((p) => !already.has(`${p.kind}:${p.body.trim().toLowerCase()}`)).slice(0, 6);
}
