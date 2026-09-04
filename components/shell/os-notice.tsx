"use client";

import { useState, useTransition } from "react";
import { usePathname } from "next/navigation";
import { Loader2, ArrowLeftRight } from "lucide-react";
import { switchRole } from "@/app/app/actions";
import type { RoleId } from "@/lib/roles/roles";

/*
  "You are entitled to this page, but you are standing in another system."

  Shown when a page belongs to one operating system and the account is working
  in a different one — reached by a deep link, a bookmark, or a notification.
  Deliberately NOT a wall: the account may open this system and the data is its
  own, so refusing the click would protect nothing and lose it.

  What it fixes is the disorientation of a page appearing in a shell whose
  navigation does not contain it. The button uses the same `switchRole` action
  the switcher does, so the entitlement check that action performs is the one
  that applies here too — this component asks for nothing it could grant.
*/

export function OsNotice({ role, label }: { role: RoleId; label: string }) {
  const [error, setError] = useState<string | null>(null);
  const [busy, start] = useTransition();
  const pathname = usePathname();

  /*
    `switchRole` redirects on success, so there is nothing to do after it —
    only a failure ever returns. Passing the current path is what keeps the
    reader on the page they asked for instead of the new system's home.
  */
  const go = () => {
    setError(null);
    start(async () => {
      const res = await switchRole(role, pathname);
      if (!res.ok) setError(res.error ?? "That did not work.");
    });
  };

  return (
    <div className="mb-6 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border border-line bg-ink-850 px-3.5 py-2.5">
      <span className="text-xs leading-relaxed text-text-dim">
        This page is part of <span className="text-text-hi">{label}</span>. You are working in
        another system, so it is not in the menu on the left.
      </span>
      <button
        type="button"
        onClick={go}
        disabled={busy}
        className="flex h-7 items-center gap-1.5 rounded-md border border-line px-2.5 text-xs text-text-dim transition-colors hover:border-signal-line hover:text-signal-bright disabled:opacity-50"
      >
        {busy ? <Loader2 className="size-3 animate-spin" /> : <ArrowLeftRight className="size-3" />}
        Switch to {label}
      </button>
      {error && <span className="text-xs text-correction">{error}</span>}
    </div>
  );
}
