"use client";

import { useEffect, useRef, useState } from "react";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";
import { CommandPalette } from "./command-palette";
import type { ShellIdentity } from "@/lib/roles/roles";
import type { SearchEntry } from "@/lib/search";
import type { Notification } from "@/lib/data/notification-types";

export function AppShell({
  identity,
  dateLabel,
  searchIndex,
  notifications,
  notifUnread,
  children,
}: {
  identity: ShellIdentity;
  dateLabel: string;
  /** The user's own football memory, resolved on the server. */
  searchIndex: SearchEntry[];
  notifications: Notification[];
  notifUnread: number;
  children: React.ReactNode;
}) {
  const [paletteOpen, setPaletteOpen] = useState(false);
  // Where the keyboard was before the palette took over, so it can be given back.
  const returnFocus = useRef<HTMLElement | null>(null);

  const openPalette = () => {
    returnFocus.current = document.activeElement as HTMLElement | null;
    setPaletteOpen(true);
  };

  const closePalette = () => {
    setPaletteOpen(false);
    // Closing a dialog without restoring focus drops a keyboard user at the top
    // of the document, which is worse than never having opened it.
    returnFocus.current?.focus?.();
    returnFocus.current = null;
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (paletteOpen) closePalette();
        else openPalette();
      }
      if (e.key === "Escape" && paletteOpen) closePalette();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [paletteOpen]);

  return (
    <div className="flex min-h-screen w-full">
      {/*
        Visible only when tabbed to. Without it, reaching the page content by
        keyboard means walking through the whole sidebar on every navigation.
      */}
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-lg focus:bg-signal focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-white"
      >
        Skip to content
      </a>
      <Sidebar identity={identity} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar onOpenPalette={openPalette} identity={identity} dateLabel={dateLabel} notifications={notifications} notifUnread={notifUnread} />
        <main id="main" tabIndex={-1} className="pitch-grid flex-1">
          <div className="field-glow min-h-full">{children}</div>
        </main>
      </div>
      <CommandPalette
        open={paletteOpen}
        onClose={closePalette}
        identity={identity}
        searchIndex={searchIndex}
      />
    </div>
  );
}
