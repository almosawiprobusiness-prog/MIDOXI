"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Search, Menu, Sparkles } from "lucide-react";
import { roleDef, sectionTitleFor, type ShellIdentity } from "@/lib/roles/roles";
import { MobileNav } from "./mobile-nav";
import { NotificationBell } from "./notification-bell";
import { FeedbackButton } from "./feedback-button";
import type { Notification } from "@/lib/data/notification-types";

export function Topbar({
  onOpenPalette,
  identity,
  dateLabel,
  notifications,
  notifUnread,
}: {
  onOpenPalette: () => void;
  identity: ShellIdentity;
  /** Rendered on the server so client and server never disagree about today. */
  dateLabel: string;
  notifications: Notification[];
  notifUnread: number;
}) {
  const pathname = usePathname();
  const [navOpen, setNavOpen] = useState(false);
  const def = roleDef(identity.role);
  const primary = def.quickActions[0];
  const PrimaryIcon = primary?.icon ?? Sparkles;

  return (
    <header data-shell-topbar className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-3 border-b border-line bg-ink-950/80 px-4 pt-[env(safe-area-inset-top)] backdrop-blur-md md:gap-4 md:px-6">
      <button
        onClick={() => setNavOpen(true)}
        aria-label="Open menu"
        className="grid size-9 shrink-0 place-items-center rounded-lg border border-line bg-ink-850 text-text-dim transition-colors hover:text-text lg:hidden"
      >
        <Menu className="size-4" />
      </button>
      <MobileNav open={navOpen} onClose={() => setNavOpen(false)} identity={identity} />

      <div className="flex shrink-0 items-center gap-2.5">
        <span className="hidden size-1.5 rounded-full bg-signal pulse-dot sm:block" />
        {/*
          A breadcrumb, not the page's heading. This used to be an <h1>, which
          left every page in the product with two competing titles — the page's
          own and this one. The page owns the h1; this says where you are.
        */}
        <p
          aria-label={`Section: ${sectionTitleFor(identity.role, pathname)}`}
          className="font-display text-[15px] font-semibold tracking-tight text-text-hi"
        >
          {sectionTitleFor(identity.role, pathname)}
        </p>
      </div>

      <button
        onClick={onOpenPalette}
        className="group ml-auto flex h-9 w-full min-w-0 max-w-sm items-center gap-2.5 rounded-lg border border-line bg-ink-850 px-3 text-left text-sm text-text-dim transition-colors hover:border-line-strong hover:text-text"
      >
        <Search className="size-4 text-text-faint" />
        <span className="flex-1 truncate">Ask MIDO, search, or command…</span>
        <kbd className="chip hidden sm:inline-flex">⌘K</kbd>
      </button>

      <FeedbackButton />

      <NotificationBell initial={notifications} initialUnread={notifUnread} />

      {primary && (
        <Link
          href={primary.href}
          className="flex h-9 shrink-0 items-center gap-2 rounded-lg border border-signal-line bg-signal/10 px-3 text-sm font-medium text-signal-bright transition-colors hover:bg-signal/20"
        >
          <PrimaryIcon className="size-4" />
          <span className="hidden md:inline">{primary.label}</span>
        </Link>
      )}

      <div className="hidden items-center gap-3 border-l border-line pl-4 xl:flex">
        <span className="label-tech">{dateLabel}</span>
      </div>
    </header>
  );
}
