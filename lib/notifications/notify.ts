import "server-only";
import { createAdminClient } from "@/lib/supabase/server";
import { emailWorthy, type NotificationKind } from "@/lib/data/notification-types";
import { env, hasEmail } from "@/lib/env";
import { sendEmail } from "./mailer";
import { renderNotificationEmail } from "./email-template";

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

  EMAIL RIDES ALONG WITH THE SAME CALL, on the same decision about who
  this is for and whether a block applies — a caller that remembered to
  notify but forgot to email, or the reverse, is two chances to get the
  audience wrong instead of one. Whether an email actually goes out is
  decided here, every time, from three independent things: the `kind` is
  one `emailWorthy()` allows (see `notification-types.ts` for why follows
  and likes are excluded), the recipient has not turned email off in
  Settings, and email is configured on this deployment at all. Any one
  of the three being false is silent — a like never emailed anybody in
  the first place, so nothing is missing.
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

    const { data: row } = await admin
      .from("notifications")
      .insert({
        user_id: params.userId,
        actor_id: params.actorId ?? null,
        kind: params.kind,
        title: params.title,
        body: params.body ?? null,
        href: params.href ?? null,
        meta: params.meta ?? {},
      })
      .select("id")
      .maybeSingle();

    if (hasEmail && row?.id && emailWorthy(params.kind)) {
      await maybeEmail(admin, params.userId, row.id, params.title, params.body ?? null, params.href ?? null);
    }
  } catch {
    // Deliberately swallowed; see above.
  }
}

/**
 * Send the email half, if the recipient allows it.
 *
 * Split out from `notify()` so the two checks that gate a send — opt-in,
 * then a real address to send to — read as a short, ordered list rather
 * than nested inside the write path. Never throws; the caller already
 * wraps everything in one try/catch, this just keeps that promise local
 * too rather than relying on the caller to remember it applies here.
 */
async function maybeEmail(
  admin: NonNullable<ReturnType<typeof createAdminClient>>,
  userId: string,
  notificationId: string,
  title: string,
  body: string | null,
  href: string | null,
): Promise<void> {
  try {
    const { data: prefs } = await admin
      .from("user_preferences")
      .select("email_opt_in")
      .eq("user_id", userId)
      .maybeSingle();
    // No row is not the same as opted out — the signup trigger creates one
    // for every account, but a missing row must default to the column's
    // own default (true) rather than to silence.
    if (prefs && prefs.email_opt_in === false) return;

    const { data: authUser } = await admin.auth.admin.getUserById(userId);
    const to = authUser?.user?.email;
    if (!to) return;

    const { subject, html, text } = renderNotificationEmail({
      title,
      body,
      actionUrl: `${env.appUrl}${href ?? "/app/notifications"}`,
      appUrl: env.appUrl,
    });

    await sendEmail({ to, subject, html, text, idempotencyKey: notificationId });
  } catch {
    // Deliberately swallowed; see above.
  }
}
