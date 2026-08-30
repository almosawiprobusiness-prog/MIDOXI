import "server-only";
import { createClient } from "@/lib/supabase/server";
import { isDemoMode } from "@/lib/env";
import { demoStore } from "./store";
import type { SessionKind } from "@/lib/types";
import type { PlanBlock, TrainingEntry } from "./training-types";

/*
  Plan blocks live in `training_blocks` (0001). The mapping is stated
  here because nothing about the column names would let a reader guess
  it: detail → notes, the whole work prescription ("4 x 4 reps · 45s
  rest") → rest, and the record-source label ("Film: late scanning")
  → distance, the free-text column nothing else uses.
*/
function toPlanBlock(b: Record<string, unknown>): PlanBlock {
  return {
    name: (b.name as string) ?? "",
    detail: (b.notes as string) ?? "",
    work: (b.rest as string) ?? "",
    source: (b.distance as string) ?? "",
  };
}

function merge(
  session: Record<string, unknown>,
  log: Record<string, unknown> | null,
  plan: PlanBlock[] = [],
): TrainingEntry {
  return {
    id: session.id as string,
    kind: (session.kind as SessionKind) ?? "team",
    title: (session.title as string) ?? "",
    scheduledAt: (session.scheduled_at as string) ?? "",
    durationMin: (session.duration_min as number) ?? null,
    objective: (session.objective as string) ?? "",
    rpe: (log?.rpe as number) ?? null,
    physicalFeel: (log?.physical_feel as number) ?? null,
    technicalFeel: (log?.technical_feel as number) ?? null,
    improved: (log?.improved as string) ?? "",
    feltOff: (log?.felt_off as string) ?? "",
    plan: plan.length ? plan : undefined,
  };
}

export async function listTraining(): Promise<TrainingEntry[]> {
  if (isDemoMode) return demoStore.listTraining();

  const supabase = await createClient();
  if (!supabase) return [];
  const [{ data: sessions }, { data: logs }, { data: blocks }] = await Promise.all([
    supabase.from("training_sessions").select("*").order("scheduled_at", { ascending: false }),
    supabase.from("training_logs").select("*"),
    supabase.from("training_blocks").select("*").order("position", { ascending: true }),
  ]);
  const logBySession = new Map((logs ?? []).map((l) => [l.session_id as string, l]));
  const planBySession = new Map<string, PlanBlock[]>();
  for (const b of blocks ?? []) {
    const sid = b.session_id as string;
    if (!planBySession.has(sid)) planBySession.set(sid, []);
    planBySession.get(sid)!.push(toPlanBlock(b));
  }
  return (sessions ?? []).map((s) =>
    merge(s, logBySession.get(s.id as string) ?? null, planBySession.get(s.id as string) ?? []),
  );
}

export async function getTraining(id: string): Promise<TrainingEntry | null> {
  if (isDemoMode) return demoStore.listTraining().find((t) => t.id === id) ?? null;

  const supabase = await createClient();
  if (!supabase) return null;
  const { data: session } = await supabase.from("training_sessions").select("*").eq("id", id).maybeSingle();
  if (!session) return null;
  const { data: log } = await supabase.from("training_logs").select("*").eq("session_id", id).maybeSingle();
  return merge(session, log ?? null);
}
