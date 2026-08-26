"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { triageFeedback } from "@/app/app/admin/triage-actions";

/*
  Two selects. That is the whole triage UI.

  Severity is set here, by us, and never by the player — a form that
  asks somebody to rate the urgency of their own problem receives
  nothing but criticals, and rightly so: it is critical to them.
*/

const STATUSES = ["new", "investigating", "planned", "fixed", "not_planned"] as const;
const SEVERITIES = ["critical", "high", "medium", "low"] as const;

export function TriageControls({
  id,
  status,
  severity,
}: {
  id: string;
  status: string;
  severity: string | null;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  const set = (patch: { status?: (typeof STATUSES)[number]; severity?: (typeof SEVERITIES)[number] }) =>
    start(async () => {
      await triageFeedback({ id, ...patch });
      router.refresh();
    });

  const cls =
    "h-8 rounded-lg border border-line bg-ink-900 px-2 text-xs text-text-dim focus:border-signal-line focus:outline-none disabled:opacity-50";

  return (
    <span className="inline-flex gap-2">
      <select
        value={severity ?? ""}
        disabled={pending}
        onChange={(e) =>
          set({ severity: (e.target.value || undefined) as (typeof SEVERITIES)[number] })
        }
        className={cls}
        aria-label="Severity"
      >
        <option value="">severity…</option>
        {SEVERITIES.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>

      <select
        value={status}
        disabled={pending}
        onChange={(e) => set({ status: e.target.value as (typeof STATUSES)[number] })}
        className={cls}
        aria-label="Status"
      >
        {STATUSES.map((s) => (
          <option key={s} value={s}>
            {s.replace("_", " ")}
          </option>
        ))}
      </select>
    </span>
  );
}
