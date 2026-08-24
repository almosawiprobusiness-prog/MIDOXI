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

/** "3", "9+" — small enough for a bell badge, which has no room for "12". */
export function badgeCount(n: number): string {
  return n > 9 ? "9+" : String(n);
}
