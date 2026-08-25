"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, LogOut } from "lucide-react";
import {
  ACCOUNT_NAV,
  moreNav,
  primaryNav,
  roleDef,
  type NavItem,
  type ShellIdentity,
} from "@/lib/roles/roles";
import { cn } from "@/lib/utils";
import { signOut } from "@/app/app/actions";
import { RoleSwitcher } from "./role-switcher";

/*
  The sidebar shows the work, and only the work.

  Everything about the account — profile, connections, membership, settings —
  lives behind the identity card, because a player opens MIDO XI to train, not
  to look at their subscription. Secondary surfaces fold under "More"; they are
  one click away, and the command bar reaches everything regardless.
*/

export function Sidebar({ identity }: { identity: ShellIdentity }) {
  const pathname = usePathname();
  const def = roleDef(identity.role);
  const primary = primaryNav(identity.role);
  const more = moreNav(identity.role);

  const inMore = more.some((n) => isActive(n, pathname));
  const [showMore, setShowMore] = useState(inMore);
  const [accountOpen, setAccountOpen] = useState(false);
  const accountActive = ACCOUNT_NAV.some((n) => isActive(n, pathname));

  return (
    <aside className="hidden w-[236px] shrink-0 flex-col border-r border-line bg-ink-925 lg:flex">
      {/* Wordmark + the active operating system */}
      <div className="px-5 pt-5 pb-4">
        <Link href="/app" className="flex items-baseline gap-2">
          <span className="font-display text-lg font-bold tracking-tight text-text-hi">MIDO</span>
          <span className="font-display text-lg font-bold tracking-tight text-signal">XI</span>
        </Link>
        <div className="label-tech mt-0.5">{def.label} OS</div>
      </div>

      {/* Identity — and everything about the account, behind it */}
      <div className="relative mx-3 mb-2">
        <button
          onClick={() => setAccountOpen((v) => !v)}
          aria-expanded={accountOpen}
          className={cn(
            "flex w-full items-center gap-3 rounded-lg border bg-ink-850 px-3 py-2.5 text-left transition-colors",
            accountOpen || accountActive ? "border-signal-line" : "border-line hover:border-line-strong",
          )}
        >
          <div className="grid size-9 shrink-0 place-items-center rounded-md bg-gradient-to-br from-signal to-signal-deep font-display text-sm font-bold text-white">
            {identity.badge}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium text-text-hi">{identity.displayName}</div>
            <div className="label-tech truncate">{identity.identityLine}</div>
          </div>
          <ChevronDown
            className={cn("size-3.5 shrink-0 text-text-faint transition-transform", accountOpen && "rotate-180")}
          />
        </button>

        {accountOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setAccountOpen(false)} aria-hidden />
            <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-50 overflow-hidden rounded-lg border border-line-strong bg-ink-850 p-1 shadow-2xl shadow-black/60">
              {ACCOUNT_NAV.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setAccountOpen(false)}
                    className={cn(
                      "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors",
                      isActive(item, pathname)
                        ? "bg-signal/10 text-text-hi"
                        : "text-text-dim hover:bg-ink-800 hover:text-text",
                    )}
                  >
                    <Icon className="size-4 shrink-0 text-text-faint" />
                    {item.label}
                  </Link>
                );
              })}
              <form action={signOut} className="border-t border-line pt-1">
                <button
                  type="submit"
                  className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-sm text-text-dim transition-colors hover:bg-ink-800 hover:text-correction"
                >
                  <LogOut className="size-4 shrink-0" />
                  Sign out
                </button>
              </form>
            </div>
          </>
        )}
      </div>

      {/* Role switcher */}
      <div className="mx-3 mb-3">
        <RoleSwitcher identity={identity} />
      </div>

      {/*
        The work, in two tabs rather than a list with a drawer under it.

        The old shape was every primary destination, then a "More"
        disclosure that started CLOSED. For a coach that hid Film Room,
        Matches and Calendar behind a click with no indication they
        existed — a destination nobody can see is a destination nobody
        uses.

        Tabs put both sets one click away and, unlike a disclosure,
        never push the rest of the sidebar down: the panel is the same
        height whichever is showing, so the menu does not jump under
        the cursor. Whichever tab holds the current route opens
        selected, so arriving from a link never lands you on the wrong
        one.
      */}
      <nav aria-label="Main" className="flex-1 overflow-y-auto px-3 py-1">
        {more.length > 0 && (
          <div
            role="tablist"
            aria-label="Navigation groups"
            className="mb-2 grid grid-cols-2 gap-1 rounded-lg border border-line bg-ink-850 p-1"
          >
            {([
              { key: "work" as const, label: "Work", count: primary.length },
              { key: "more" as const, label: "More", count: more.length },
            ]).map((t) => {
              const selected = (t.key === "more") === showMore;
              return (
                <button
                  key={t.key}
                  role="tab"
                  aria-selected={selected}
                  onClick={() => setShowMore(t.key === "more")}
                  className={cn(
                    "flex items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs transition-colors",
                    selected
                      ? "bg-signal/15 text-signal-bright"
                      : "text-text-faint hover:text-text-dim",
                  )}
                >
                  {t.label}
                  <span className="data-mono text-[10px] opacity-60">{t.count}</span>
                </button>
              );
            })}
          </div>
        )}

        <ul className="space-y-0.5">
          {(showMore && more.length > 0 ? more : primary).map((item) => (
            <li key={item.href}>
              <NavLink item={item} pathname={pathname} />
            </li>
          ))}
        </ul>
      </nav>

      <div className="border-t border-line px-4 py-3">
        <p className="text-[11px] leading-relaxed text-text-faint">
          Press <kbd className="chip !px-1 !py-0">⌘K</kbd> to reach anything.
        </p>
      </div>
    </aside>
  );
}

function isActive(item: NavItem, pathname: string): boolean {
  return item.href === "/app"
    ? pathname === "/app"
    : pathname === item.href || pathname.startsWith(item.href + "/");
}

function NavLink({ item, pathname }: { item: NavItem; pathname: string }) {
  const active = isActive(item, pathname);
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      data-active={active}
      className={cn(
        "nav-item group flex items-center gap-3 rounded-md px-3 py-2 text-sm",
        active ? "bg-signal/10 text-text-hi" : "text-text-dim hover:bg-ink-800 hover:text-text",
      )}
    >
      <Icon
        className={cn(
          "size-[18px] shrink-0",
          active ? "text-signal-bright" : "text-text-faint group-hover:text-text-dim",
        )}
      />
      {/*
        Every nav item has carried a written `hint` — "The week", "Video
        study", "Share & discuss" — and the sidebar has never shown one.
        Surfaced on the ACTIVE item only: it tells you what you are
        looking at without turning a ten-item menu into a wall of
        subtitles.
      */}
      <span className="min-w-0 flex-1">
        <span className="block truncate">{item.label}</span>
        {active && item.hint && (
          <span className="label-tech mt-0.5 block truncate !text-[9px] !text-text-faint">
            {item.hint}
          </span>
        )}
      </span>
      {item.status === "scaffold" && (
        <span className="size-1.5 shrink-0 rounded-full bg-ink-600" title="Scaffolded — building" />
      )}
    </Link>
  );
}
