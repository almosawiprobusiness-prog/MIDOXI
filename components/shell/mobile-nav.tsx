"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut, X } from "lucide-react";
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
  On a phone the whole drawer is visible at once, so the work and the account
  are separated by a labelled break rather than a fold — same hierarchy, no
  extra tap.
*/

export function MobileNav({
  open,
  onClose,
  identity,
}: {
  open: boolean;
  onClose: () => void;
  identity: ShellIdentity;
}) {
  const pathname = usePathname();
  const def = roleDef(identity.role);
  const primary = primaryNav(identity.role);
  const more = moreNav(identity.role);

  // Close whenever the route changes (a nav item was tapped).
  useEffect(() => {
    onClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  // Lock body scroll while open.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  const link = (item: NavItem) => {
    const active =
      item.href === "/app"
        ? pathname === "/app"
        : pathname === item.href || pathname.startsWith(item.href + "/");
    const Icon = item.icon;
    return (
      <li key={item.href}>
        <Link
          href={item.href}
          onClick={onClose}
          className={cn(
            "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm",
            active ? "bg-signal/10 text-text-hi" : "text-text-dim hover:bg-ink-800 hover:text-text",
          )}
        >
          <Icon className={cn("size-[18px] shrink-0", active ? "text-signal-bright" : "text-text-faint")} />
          <span className="flex-1">{item.label}</span>
          {item.status === "scaffold" && <span className="size-1.5 rounded-full bg-ink-600" />}
        </Link>
      </li>
    );
  };

  return (
    <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <aside className="absolute inset-y-0 left-0 flex w-[280px] max-w-[82%] flex-col border-r border-line bg-ink-925 shadow-2xl shadow-black/60">
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <Link href="/app" className="flex items-baseline gap-2" onClick={onClose}>
            <span className="font-display text-lg font-bold tracking-tight text-text-hi">MIDO</span>
            <span className="font-display text-lg font-bold tracking-tight text-signal">XI</span>
          </Link>
          <button
            onClick={onClose}
            aria-label="Close menu"
            className="grid size-8 place-items-center rounded-md text-text-faint hover:bg-ink-800 hover:text-text"
          >
            <X className="size-5" />
          </button>
        </div>
        <div className="label-tech px-5 pb-3">{def.label} OS</div>

        <div className="mx-3 mb-2 flex items-center gap-3 rounded-lg border border-line bg-ink-850 px-3 py-2.5">
          <div className="grid size-9 shrink-0 place-items-center rounded-md bg-gradient-to-br from-signal to-signal-deep font-display text-sm font-bold text-white">
            {identity.badge}
          </div>
          <div className="min-w-0">
            <div className="truncate text-sm font-medium text-text-hi">{identity.displayName}</div>
            <div className="label-tech truncate">{identity.identityLine}</div>
          </div>
        </div>

        <div className="mx-3 mb-3">
          <RoleSwitcher identity={identity} compact />
        </div>

        <nav aria-label="Main" className="flex-1 overflow-y-auto px-3 py-1">
          <ul className="space-y-0.5">{primary.map(link)}</ul>

          {more.length > 0 && (
            <>
              <div className="label-tech mt-4 mb-1 px-3 !text-[10px]">More</div>
              <ul className="space-y-0.5">{more.map(link)}</ul>
            </>
          )}

          <div className="label-tech mt-4 mb-1 px-3 !text-[10px]">Account</div>
          <ul className="space-y-0.5">{ACCOUNT_NAV.map(link)}</ul>
        </nav>

        <div className="border-t border-line px-3 py-3">
          <form action={signOut}>
            <button
              type="submit"
              className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-sm text-text-dim transition-colors hover:bg-ink-800 hover:text-correction"
            >
              <LogOut className="size-[18px]" /> Sign out
            </button>
          </form>
        </div>
      </aside>
    </div>
  );
}
