"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { ChevronDown, Check, Loader2, Lock } from "lucide-react";
import { ROLES, type RoleId, type ShellIdentity } from "@/lib/roles/roles";
import { cheapestPlanFor, formatPrice } from "@/lib/billing/plans";
import { switchRole } from "@/app/app/actions";
import { cn } from "@/lib/utils";

/*
  The role switcher. MIDO XI is four operating systems on one platform —
  this is how a user who holds more than one role moves between them.
  Switching changes navigation, dashboard, terminology and AI context.

  A system the account is not entitled to is shown **locked with its price**,
  not hidden. Hiding it would make the product look smaller than it is and give
  someone no idea what upgrading buys; a lock with "Coach — from $29" is an
  answer. The entitlement itself is decided server-side in `getCurrentUser`, so
  nothing here is load-bearing for access.
*/
export function RoleSwitcher({ identity, compact = false }: { identity: ShellIdentity; compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const active = ROLES[identity.role];
  const ActiveIcon = active.icon;

  const choose = (role: RoleId) => {
    setOpen(false);
    if (role === identity.role) return;
    startTransition(() => {
      void switchRole(role);
    });
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className={cn(
          "flex w-full items-center gap-2 rounded-lg border border-line bg-ink-850 px-2.5 py-2 text-left transition-colors hover:border-line-strong",
          compact && "px-2 py-1.5",
        )}
      >
        <span className="grid size-6 shrink-0 place-items-center rounded-md bg-signal/12 text-signal-bright">
          {pending ? <Loader2 className="size-3.5 animate-spin" /> : <ActiveIcon className="size-3.5" />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="label-tech block !text-[9.5px] !text-text-faint">Operating system</span>
          <span className="block truncate text-[13px] font-medium text-text-hi">{active.label}</span>
        </span>
        <ChevronDown className={cn("size-3.5 shrink-0 text-text-faint transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} aria-hidden />
          <div
            role="menu"
            className="absolute left-0 right-0 top-[calc(100%+6px)] z-50 overflow-hidden rounded-lg border border-line-strong bg-ink-850 p-1 shadow-2xl shadow-black/60"
          >
            {Object.values(ROLES).map((r) => {
              const Icon = r.icon;
              const isActive = r.id === identity.role;
              const open = identity.availableRoles.includes(r.id);
              const plan = open ? null : cheapestPlanFor(r.id);

              const inner = (
                <>
                  <Icon
                    className={cn(
                      "mt-0.5 size-4 shrink-0",
                      isActive ? "text-signal-bright" : open ? "text-text-faint" : "text-ink-600",
                    )}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-1.5">
                      <span
                        className={cn(
                          "text-[13px] font-medium",
                          open ? "text-text-hi" : "text-text-dim",
                        )}
                      >
                        {r.label}
                      </span>
                      {!open && plan && (
                        <span className="chip !px-1.5 !py-0 !text-[9px]">
                          from {formatPrice(plan.priceCents)}
                        </span>
                      )}
                    </span>
                    <span className="mt-0.5 block text-[11px] leading-snug text-text-dim">
                      {r.tagline}
                    </span>
                  </span>
                  {isActive && <Check className="mt-0.5 size-3.5 shrink-0 text-signal-bright" />}
                  {!open && <Lock className="mt-0.5 size-3 shrink-0 text-text-faint" />}
                </>
              );

              const shared = cn(
                "flex w-full items-start gap-2.5 rounded-md px-2.5 py-2 text-left transition-colors",
                isActive ? "bg-signal/10" : "hover:bg-ink-800",
              );

              // A locked system routes to membership rather than doing nothing.
              return open ? (
                <button key={r.id} role="menuitem" onClick={() => choose(r.id)} className={shared}>
                  {inner}
                </button>
              ) : (
                <Link
                  key={r.id}
                  role="menuitem"
                  href="/app/membership"
                  onClick={() => setOpen(false)}
                  className={shared}
                >
                  {inner}
                </Link>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
