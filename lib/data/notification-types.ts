import { UserPlus, Heart, MessageCircle, CalendarClock, Check, X, Clock } from "lucide-react";
import { timeAgo } from "./feed-types";

/*
  Notifications — shared shapes. Client-safe.

  Every kind the product actually emits, matching the check constraint
  in 0027. Adding a new producer means adding one here first — the
  database will refuse anything else, which is the point.
*/

export type NotificationKind =
  | "meeting_proposed"
  | "meeting_accepted"
  | "meeting_declined"
  | "meeting_cancelled"
  | "meeting_time_proposed"
  | "meeting_time_accepted"
  | "meeting_time_declined"
  | "follow"
  | "like"
  | "comment";

export interface Notification {
  id: string;
  kind: NotificationKind;
  title: string;
  body: string | null;
  href: string | null;
  read: boolean;
  createdAt: string;
  actor: { id: string; name: string; avatar: string | null } | null;
}

export const KIND_ICON: Record<NotificationKind, typeof UserPlus> = {
  meeting_proposed: CalendarClock,
  meeting_accepted: Check,
  meeting_declined: X,
  meeting_cancelled: X,
  meeting_time_proposed: Clock,
  meeting_time_accepted: Check,
  meeting_time_declined: Clock,
  follow: UserPlus,
  like: Heart,
  comment: MessageCircle,
};

export { timeAgo };

/*
  Which kinds are worth an email.

  Not all of them. A like or a follow is a passive social signal — high
  frequency, low stakes — and emailing one every time is exactly how a
  product trains its own users to ignore its emails. The meeting kinds
  are different: they are two people actively coordinating a time, each
  message expects an answer, and missing one because nobody was looking
  at the app is a real cost. Comments sit in between and are kept
  in-app-only for now rather than guessed at.

  Pure and exported so the decision is unit-testable without touching
  Resend, `notify()`, or anything server-only.
*/
const EMAIL_KINDS: ReadonlySet<NotificationKind> = new Set([
  "meeting_proposed",
  "meeting_accepted",
  "meeting_declined",
  "meeting_cancelled",
  "meeting_time_proposed",
  "meeting_time_accepted",
  "meeting_time_declined",
]);

export function emailWorthy(kind: NotificationKind): boolean {
  return EMAIL_KINDS.has(kind);
}

/** "3", "9+" — small enough for a bell badge, which has no room for "12". */
export function badgeCount(n: number): string {
  return n > 9 ? "9+" : String(n);
}
