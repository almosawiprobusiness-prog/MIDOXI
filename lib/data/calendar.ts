import "server-only";
import { createClient } from "@/lib/supabase/server";
import { isDemoMode } from "@/lib/env";
import { demoStore } from "./store";
import type { CalendarEvent, CalendarKind } from "./calendar-types";

function rowToEvent(e: Record<string, unknown>): CalendarEvent {
  return {
    id: e.id as string,
    kind: (e.kind as CalendarKind) ?? "team",
    title: (e.title as string) ?? "",
    startsAt: (e.starts_at as string) ?? "",
    endsAt: (e.ends_at as string) ?? null,
    mdTag: (e.md_tag as string) ?? undefined,
  };
}

export async function listEvents(): Promise<CalendarEvent[]> {
  if (isDemoMode) return demoStore.listEvents();

  const supabase = await createClient();
  if (!supabase) return [];
  const { data } = await supabase
    .from("calendar_events")
    .select("*")
    .order("starts_at", { ascending: true });
  return (data ?? []).map(rowToEvent);
}
