import "server-only";
import { createClient } from "@/lib/supabase/server";
import { isDemoMode } from "@/lib/env";
import { demoStore } from "./store";
import type { SessionKind } from "@/lib/types";
import type { TrainingEntry } from "./training-types";

function merge(session: Record<string, unknown>, log: Record<string, unknown> | null): TrainingEntry {
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
  };
}

export async function listTraining(): Promise<TrainingEntry[]> {
  if (isDemoMode) return demoStore.listTraining();

  const supabase = await createClient();
  if (!supabase) return [];
  const [{ data: sessions }, { data: logs }] = await Promise.all([
    supabase.from("training_sessions").select("*").order("scheduled_at", { ascending: false }),
    supabase.from("training_logs").select("*"),
  ]);
  const logBySession = new Map((logs ?? []).map((l) => [l.session_id as string, l]));
  return (sessions ?? []).map((s) => merge(s, logBySession.get(s.id as string) ?? null));
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
