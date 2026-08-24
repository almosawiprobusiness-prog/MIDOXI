"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Loader2 } from "lucide-react";
import {
  KIND_ICON,
  timeAgo,
  type Notification,
} from "@/lib/data/notification-types";
import { markAllNotificationsRead, markNotificationRead } from "@/app/app/notifications/actions";
import { cn } from "@/lib/utils";

/*
  One list, two homes: the bell's dropdown and the full /app/notifications
  page. Shared rather than duplicated, because the two were drifting apart
  in an earlier draft — the dropdown showing a subtly different unread
  treatment than the page it linked to.

  Clicking a notification marks it read AND navigates, in that order,
  optimistically — waiting for the mark-read round trip before letting
  somebody follow the link they came here for is the wrong priority.
*/

export function NotificationList({
  items,
  showMarkAll = false,
  onNavigate,
}: {
  items: Notification[];
  showMarkAll?: boolean;
  onNavigate?: () => void;
}) {
  const router = useRouter();
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const [pending, startTransition] = useTransition();

  const isRead = (n: Notification) => n.read || readIds.has(n.id);
  const anyUnread = items.some((n) => !isRead(n));

  const open = (n: Notification) => {
    if (!isRead(n)) {
      setReadIds((s) => new Set(s).add(n.id));
      startTransition(() => {
        void markNotificationRead(n.id);
      });
    }
    onNavigate?.();
  };

  const markAll = () =>
    startTransition(async () => {
      setReadIds(new Set(items.map((n) => n.id)));
      await markAllNotificationsRead();
      router.refresh();
    });

  return (
    <div>
      {showMarkAll && anyUnread && (
        <div className="mb-3 flex justify-end">
          <button
            onClick={markAll}
            disabled={pending}
            className="flex items-center gap-1.5 text-xs text-text-dim transition-colors hover:text-signal-bright disabled:opacity-50"
          >
            {pending ? <Loader2 className="size-3 animate-spin" /> : <Check className="size-3" />}
            Mark all read
          </button>
        </div>
      )}

      <ul className="space-y-1">
        {items.map((n) => {
          const Icon = KIND_ICON[n.kind];
          const unread = !isRead(n);
          const row = (
            <div
              className={cn(
                "flex items-start gap-3 rounded-lg px-3 py-2.5 transition-colors",
                unread ? "bg-signal/5" : "hover:bg-ink-850",
              )}
            >
              <span
                className={cn(
                  "mt-0.5 grid size-8 shrink-0 place-items-center rounded-full border",
                  unread ? "border-signal-line bg-signal/10 text-signal-bright" : "border-line text-text-faint",
                )}
              >
                <Icon className="size-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className={cn("text-sm leading-snug", unread ? "text-text-hi" : "text-text-dim")}>{n.title}</p>
                {n.body && <p className="mt-0.5 truncate text-xs text-text-faint">{n.body}</p>}
                <p className="mt-1 data-mono text-[10px] text-text-faint">{timeAgo(n.createdAt)} ago</p>
              </div>
              {unread && <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-signal" aria-hidden />}
            </div>
          );

          return (
            <li key={n.id}>
              {n.href ? (
                <Link href={n.href} onClick={() => open(n)}>
                  {row}
                </Link>
              ) : (
                <button onClick={() => open(n)} className="block w-full text-left">
                  {row}
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
