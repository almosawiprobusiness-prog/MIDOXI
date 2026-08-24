import "server-only";
import { createAdminClient } from "@/lib/supabase/server";
import type { NotificationKind } from "@/lib/data/notification-types";

/*
  Write a notification. The only place that does.

  The service role, because `authenticated` holds no INSERT privilege on
  `notifications` at all — see 0027. A notification is a claim that
  something happened to somebody who is not the caller, and the only
  thing entitled to make that claim is the server code that saw it
  happen, not the signed-in account triggering it.

  BLOCKING IS ENFORCED HERE, ONCE, rather than at every call site. This
  codebase's community feed already learned that lesson the hard way —
  see `blockedEitherWay` in `lib/data/feed.ts` — and a notification is
  exactly the kind of thing a call site forgets to guard: it is easy to
  wire up "notify the post author" and never think about the case where
  the commenter is somebody the author has blocked. Checked in both
  directions, because a block that only stops one side is not a block.

  NEVER THROWS. A failed notification must not fail the action it
  decorates — a meeting still needs to get created if the notify insert
  hiccups, and the caller has no useful way to react to that failure
  anyway.
*/
export async function notify(params: {
  /** Who this is for. */
  userId: string;
  /** Who did the thing, if anyone — used for the avatar and for the block check. */
  actorId?: string | null;
  kind: NotificationKind;
  title: string;
  body?: string | null;
  href?: string | null;
  meta?: Record<string, unknown>;
}): Promise<void> {
  try {
    // Nobody needs to be told about their own action.
    if (params.actorId && params.actorId === params.userId) return;

    const admin = createAdminClient();
    if (!admin) return;

    if (params.actorId) {
      const [blockedByRecipient, blockedByActor] = await Promise.all([
        admin
          .from("user_blocks")
          .select("blocker_id")
          .eq("blocker_id", params.userId)
          .eq("blocked_id", params.actorId)
          .maybeSingle(),
        admin
          .from("user_blocks")
          .select("blocker_id")
          .eq("blocker_id", params.actorId)
          .eq("blocked_id", params.userId)
          .maybeSingle(),
      ]);
      if (blockedByRecipient.data || blockedByActor.data) return;
    }

    await admin.from("notifications").insert({
      user_id: params.userId,
      actor_id: params.actorId ?? null,
      kind: params.kind,
      title: params.title,
      body: params.body ?? null,
      href: params.href ?? null,
      meta: params.meta ?? {},
    });
  } catch {
    // Deliberately swallowed; see above.
  }
}
