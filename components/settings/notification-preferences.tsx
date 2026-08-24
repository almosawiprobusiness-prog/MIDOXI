"use client";

import { useState } from "react";
import { updateEmailOptIn } from "@/app/app/settings/actions";

/*
  One switch. `emailWorthy()` in `lib/data/notification-types.ts` already
  decided which kinds are worth emailing at all — a follow or a like never
  reaches this gate — so what is left to control here is genuinely just
  "email me, or don't."
*/
export function EmailPreferenceToggle({ initial, configured }: { initial: boolean; configured: boolean }) {
  const [optIn, setOptIn] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const toggle = async (next: boolean) => {
    setOptIn(next);
    setBusy(true);
    setNote(null);
    const res = await updateEmailOptIn(next);
    setBusy(false);
    if (!res.ok) {
      setOptIn(!next);
      setNote(res.error);
    } else if (res.demo) {
      setNote("Demo — preference not persisted.");
    }
  };

  return (
    <div className="panel flex items-start justify-between gap-4 p-5">
      <div>
        <div className="text-sm font-medium text-text-hi">Email notifications</div>
        <p className="mt-1 max-w-md text-sm leading-relaxed text-text-dim">
          Session invitations, proposed times and answers — the things worth knowing about
          away from the app. Never for follows, likes or comments; those stay in-app only.
        </p>
        {!configured && (
          <p className="mt-2 text-xs text-text-faint">
            Not available on this deployment yet — email is not configured.
          </p>
        )}
        {note && <p className="mt-2 text-xs text-review">{note}</p>}
      </div>
      <button
        role="switch"
        aria-checked={optIn}
        aria-label="Email notifications"
        disabled={busy || !configured}
        onClick={() => toggle(!optIn)}
        className={`relative mt-1 h-6 w-11 shrink-0 rounded-full transition-colors ${optIn && configured ? "bg-signal" : "bg-ink-700"} disabled:opacity-60`}
      >
        <span
          className={`absolute top-0.5 size-5 rounded-full bg-white transition-transform ${optIn ? "translate-x-5" : "translate-x-0.5"}`}
        />
      </button>
    </div>
  );
}
