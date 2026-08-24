import "server-only";
import { createClient, getAuthUser } from "@/lib/supabase/server";
import { isDemoMode } from "@/lib/env";
import type { Notification, NotificationKind } from "./notification-types";

/*
  Reading notifications.

  Demo mode returns a small realistic set rather than nothing — an empty
  bell in the showcase reads as "this feature does not exist", and this
  is the feature the product least wants to look unfinished.
*/

interface Row {
  id: string;
  kind: string;
  title: string;
  body: string | null;
  href: string | null;
  read: boolean;
  created_at: string;
  actor_id: string | null;
}

function toNotification(r: Row, actor: { id: string; name: string; avatar: string | null } | null): Notification {
  return {
    id: r.id,
    kind: r.kind as NotificationKind,
    title: r.title,
    body: r.body,
    href: r.href,
    read: r.read,
    createdAt: r.created_at,
    actor,
  };
}

export async function listNotifications(limit = 30): Promise<Notification[]> {
  if (isDemoMode) return demoNotifications();

  const supabase = await createClient();
  if (!supabase) return [];
  const user = await getAuthUser();
  if (!user) return [];

  const { data } = await supabase
    .from("notifications")
    .select("id, kind, title, body, href, read, created_at, actor_id")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(Math.min(limit, 100));

  const rows = (data ?? []) as unknown as Row[];
  if (rows.length === 0) return [];

  const actorIds = [...new Set(rows.map((r) => r.actor_id).filter((v): v is string => Boolean(v)))];
  const actors = new Map<string, { id: string; name: string; avatar: string | null }>();
  if (actorIds.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name, known_as, avatar_url")
      .in("id", actorIds);
    for (const p of profiles ?? []) {
      actors.set(String(p.id), {
        id: String(p.id),
        name: String(p.known_as || p.full_name || "Someone").trim(),
        avatar: (p.avatar_url as string) ?? null,
      });
    }
  }

  return rows.map((r) => toNotification(r, r.actor_id ? (actors.get(r.actor_id) ?? null) : null));
}

/** Whether email is currently on for this account. Defaults true — the column's own default — when no preference row exists yet. */
export async function getEmailOptIn(): Promise<boolean> {
  if (isDemoMode) return true;

  const supabase = await createClient();
  if (!supabase) return true;
  const user = await getAuthUser();
  if (!user) return true;

  const { data } = await supabase
    .from("user_preferences")
    .select("email_opt_in")
    .eq("user_id", user.id)
    .maybeSingle();

  return data?.email_opt_in ?? true;
}

export async function unreadCount(): Promise<number> {
  if (isDemoMode) return demoNotifications().filter((n) => !n.read).length;

  const supabase = await createClient();
  if (!supabase) return 0;
  const user = await getAuthUser();
  if (!user) return 0;

  const { count } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("read", false);

  return count ?? 0;
}

const at = (hours: number) => new Date(Date.now() + hours * 3600_000).toISOString();

function demoNotifications(): Notification[] {
  return [
    {
      id: "n1",
      kind: "meeting_time_proposed",
      title: "Dan Whitmore suggested a new time",
      body: "Scanning block — where it got to",
      href: "/app/meetings/m3",
      read: false,
      createdAt: at(-1),
      actor: { id: "demo-coach", name: "Dan Whitmore", avatar: null },
    },
    {
      id: "n2",
      kind: "follow",
      title: "Sam Oyelaran started following you",
      body: null,
      href: "/app/community/sam_o",
      read: false,
      createdAt: at(-5),
      actor: { id: "demo-player-2", name: "Sam Oyelaran", avatar: null },
    },
    {
      id: "n3",
      kind: "like",
      title: "Dan Whitmore liked your post",
      body: null,
      href: "/app/community/posts/p1",
      read: true,
      createdAt: at(-30),
      actor: { id: "demo-coach", name: "Dan Whitmore", avatar: null },
    },
    {
      id: "n4",
      kind: "meeting_accepted",
      title: "Dan Whitmore accepted your session",
      body: "Northgate away — first half",
      href: "/app/meetings/m1",
      read: true,
      createdAt: at(-96),
      actor: { id: "demo-coach", name: "Dan Whitmore", avatar: null },
    },
  ];
}
