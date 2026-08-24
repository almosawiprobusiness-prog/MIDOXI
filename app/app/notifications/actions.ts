"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isDemoMode } from "@/lib/env";
import { listNotifications, unreadCount } from "@/lib/data/notifications";

export type NotifyResult = { ok: true } | { ok: false; error: string };

async function me() {
  const supabase = await createClient();
  if (!supabase) return { supabase: null, userId: null };
  const { data: { user } } = await supabase.auth.getUser();
  return { supabase, userId: user?.id ?? null };
}

/** Called by the bell on open — a fresher list than whatever was server-rendered at page load. */
export async function refreshNotifications() {
  const [items, count] = await Promise.all([listNotifications(), unreadCount()]);
  return { items, count };
}

export async function markNotificationRead(id: string): Promise<NotifyResult> {
  if (isDemoMode) return { ok: true };
  const { supabase, userId } = await me();
  if (!supabase || !userId) return { ok: false, error: "Sign in first." };

  const { error } = await supabase.from("notifications").update({ read: true }).eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/app/notifications");
  return { ok: true };
}

export async function markAllNotificationsRead(): Promise<NotifyResult> {
  if (isDemoMode) return { ok: true };
  const { supabase, userId } = await me();
  if (!supabase || !userId) return { ok: false, error: "Sign in first." };

  const { error } = await supabase.from("notifications").update({ read: true }).eq("user_id", userId).eq("read", false);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/app/notifications");
  return { ok: true };
}

export async function deleteNotification(id: string): Promise<NotifyResult> {
  if (isDemoMode) return { ok: true };
  const { supabase, userId } = await me();
  if (!supabase || !userId) return { ok: false, error: "Sign in first." };

  const { error } = await supabase.from("notifications").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/app/notifications");
  return { ok: true };
}
