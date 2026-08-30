"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";
import { refreshNotifications } from "@/app/app/notifications/actions";
import { badgeCount, type Notification } from "@/lib/data/notification-types";
import { NotificationList } from "@/components/notifications/notification-list";

/*
  The bell.

  Server-rendered on first paint — `initial` comes from the layout the
  same way `dateLabel` and `searchIndex` do — so there is no flash of an
  empty bell while a client fetch resolves.

  Freshness after that is POLLING, not push. Nothing else in this
  codebase uses Supabase Realtime; every other surface is a Server
  Component re-rendered by `revalidatePath` after an action. Wiring one
  feature onto a channel-based architecture the rest of the app does not
  use would be a second way of doing everything downstream depends on,
  for a feature where thirty seconds of latency costs nothing — a
  session proposal sitting unread for half a minute is not the same
  problem as a chat message. If notifications ever need to feel
  instant, that is a deliberate architectural decision to make once, not
  something to smuggle in here.
*/

const POLL_MS = 30_000;

export function NotificationBell({ initial, initialUnread }: { initial: Notification[]; initialUnread: number }) {
  const [items, setItems] = useState(initial);
  const [unread, setUnread] = useState(initialUnread);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const id = setInterval(() => {
      // Only while the dropdown is closed — an unread badge that changes
      // count while somebody is mid-read of the open list is disorienting.
      if (document.hidden) return;
      refreshNotifications()
        .then(({ items, count }) => {
          setItems(items);
          setUnread(count);
        })
        .catch(() => {});
    }, POLL_MS);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!open) return;
    // Catch up the moment it's opened, rather than waiting for the next tick.
    refreshNotifications()
      .then(({ items, count }) => {
        setItems(items);
        setUnread(count);
      })
      .catch(() => {});

    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onEsc);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label={unread > 0 ? `Notifications, ${unread} unread` : "Notifications"}
        className="relative grid size-9 place-items-center rounded-lg border border-line bg-ink-850 text-text-dim transition-colors hover:text-text"
      >
        <Bell className="size-4" />
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-signal px-1 text-[10px] font-semibold leading-none text-white">
            {badgeCount(unread)}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-11 z-40 w-[360px] max-w-[90vw] rounded-xl border border-line bg-ink-900 p-3 shadow-2xl shadow-black/50">
          <div className="mb-2 flex items-center justify-between px-1">
            <span className="label-tech">Notifications</span>
            <Link
              href="/app/notifications"
              onClick={() => setOpen(false)}
              className="text-xs text-text-dim transition-colors hover:text-signal-bright"
            >
              See all
            </Link>
          </div>

          {items.length === 0 ? (
            <p className="px-2 py-6 text-center text-sm text-text-dim">
              Quiet. When a coach, teammate or share needs you, it lands here.
            </p>
          ) : (
            <div className="max-h-[70vh] overflow-y-auto">
              <NotificationList items={items.slice(0, 8)} onNavigate={() => setOpen(false)} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
