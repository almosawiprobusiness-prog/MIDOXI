"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isDemoMode } from "@/lib/env";
import { demoStore } from "@/lib/data/store";
import type { CalendarInput } from "@/lib/data/calendar-types";

export type Result = { ok: true; id?: string; demo?: boolean } | { ok: false; error: string };

async function requireUser() {
  const supabase = await createClient();
  if (!supabase) return { supabase: null, userId: null };
  const { data: { user } } = await supabase.auth.getUser();
  return { supabase, userId: user?.id ?? null };
}

function revalidate() {
  revalidatePath("/app/calendar");
  revalidatePath("/app");
}

export async function createEvent(input: CalendarInput): Promise<Result> {
  if (!input.title?.trim()) return { ok: false, error: "Give the event a title." };
  if (!input.startsAt) return { ok: false, error: "Start time is required." };

  if (isDemoMode) {
    const id = demoStore.createEvent(input);
    revalidate();
    return { ok: true, id, demo: true };
  }

  const { supabase, userId } = await requireUser();
  if (!supabase || !userId) return { ok: false, error: "You must be signed in." };

  const { data, error } = await supabase
    .from("calendar_events")
    .insert({
      kind: input.kind,
      title: input.title.trim(),
      starts_at: input.startsAt,
      ends_at: input.endsAt || null,
      md_tag: input.mdTag || null,
    })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };
  revalidate();
  return { ok: true, id: data.id };
}

export async function updateEvent(id: string, input: CalendarInput): Promise<Result> {
  if (!input.title?.trim()) return { ok: false, error: "Give the event a title." };

  if (isDemoMode) {
    demoStore.updateEvent(id, input);
    revalidate();
    return { ok: true, id, demo: true };
  }

  const { supabase, userId } = await requireUser();
  if (!supabase || !userId) return { ok: false, error: "You must be signed in." };

  const { error } = await supabase
    .from("calendar_events")
    .update({
      kind: input.kind,
      title: input.title.trim(),
      starts_at: input.startsAt,
      ends_at: input.endsAt || null,
      md_tag: input.mdTag || null,
    })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidate();
  return { ok: true, id };
}

export async function deleteEvent(id: string): Promise<Result> {
  if (isDemoMode) {
    demoStore.deleteEvent(id);
    revalidate();
    return { ok: true, demo: true };
  }

  const { supabase, userId } = await requireUser();
  if (!supabase || !userId) return { ok: false, error: "You must be signed in." };

  const { error } = await supabase.from("calendar_events").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidate();
  return { ok: true };
}
