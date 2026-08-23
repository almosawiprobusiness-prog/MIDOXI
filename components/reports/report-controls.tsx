"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Printer, Shield, Check } from "lucide-react";
import { REPORT_FIELDS, fieldsToParam, type ReportField } from "@/lib/reports/fields";
import { ShareButton } from "./share-button";
import type { ShareKind } from "@/lib/reports/share-types";
import { cn } from "@/lib/utils";

/*
  Everything a player can turn on or off before this leaves the building.

  Two rules the design follows:

  · The toggles change the page, not a preview of the page. What is on screen
    is what prints and what a recipient reads — there is no second rendering
    path where a field could survive being switched off.

  · Sensitive fields are marked as such and start off. A player adding their
    date of birth to a report is making a decision; a player discovering it was
    there all along is not.
*/

export function ReportControls({
  active,
  periodLabel,
  shareKind,
  shareRef,
}: {
  active: ReportField[];
  periodLabel: string;
  shareKind: ShareKind;
  /** The period or video id the link will point at. */
  shareRef: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const toggle = (id: ReportField) => {
    const next = active.includes(id) ? active.filter((f) => f !== id) : [...active, id];
    const sp = new URLSearchParams(params.toString());
    // An empty list still has to be explicit, or it would fall back to the
    // defaults and silently switch fields back on.
    sp.set("show", fieldsToParam(next) || "none");
    router.replace(`${pathname}?${sp.toString()}`, { scroll: false });
  };

  return (
    <div className="no-print mb-6 panel p-4">
      <div className="flex flex-wrap items-center gap-3">
        <Shield className="size-4 text-signal-bright" />
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-medium text-text-hi">What this report shows</h2>
          <p className="text-xs text-text-dim">
            {periodLabel}. Everything off by default except your football — add what this
            particular reader needs, and nothing else.
          </p>
        </div>
        <div className="relative flex shrink-0 items-center gap-2">
          {/*
            The link carries the ticks as they are right now. Changing them
            afterwards does not reach a link already sent — which is why the
            share panel restates what a reader will see before creating one.
          */}
          <ShareButton
            kind={shareKind}
            refId={shareRef}
            fields={active}
            periodLabel={periodLabel}
          />
          <button
            onClick={() => window.print()}
            className="flex h-10 items-center gap-2 rounded-lg border border-signal-line bg-signal/10 px-4 text-sm font-medium text-signal-bright transition-colors hover:bg-signal/20"
          >
            <Printer className="size-4" />
            Print / save as PDF
          </button>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-1.5">
        {REPORT_FIELDS.map((f) => {
          const on = active.includes(f.id);
          return (
            <button
              key={f.id}
              onClick={() => toggle(f.id)}
              title={f.hint}
              aria-pressed={on}
              className={cn(
                "flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs transition-colors",
                on
                  ? "border-signal-line bg-signal/10 text-signal-bright"
                  : "border-line text-text-dim hover:border-line-strong hover:text-text",
              )}
            >
              {on && <Check className="size-3" />}
              {f.label}
              {f.sensitive && (
                <span className="text-[10px] text-text-faint" title="Personal data">
                  ·
                </span>
              )}
            </button>
          );
        })}
      </div>

      <p className="mt-3 text-xs leading-relaxed text-text-faint">
        Fields marked with a dot are personal rather than football. Printing produces a real PDF
        from your browser — nothing is uploaded, and no copy is kept anywhere but on your machine.
      </p>
    </div>
  );
}
