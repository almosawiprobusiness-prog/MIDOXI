"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, Eye, Link2, Loader2, Trash2 } from "lucide-react";
import { withdrawShare } from "@/app/app/reports/share-actions";
import { expiryLabel, shareKindLabel, shareState, type ReportShare } from "@/lib/reports/share-types";
import { periodLabel } from "@/lib/reports/period";
import { plural } from "@/lib/data/timeline-types";
import { cn } from "@/lib/utils";

/*
  Every link the player has made, and the button that kills one.

  Withdrawal has to be one click from the place they'd look, because the moment
  somebody wants a link gone is not a moment for a settings hunt. Expired and
  withdrawn links stay listed rather than disappearing — "who did I send that
  to, and is it still open" is the question this page exists to answer, and a
  row that has vanished cannot answer it.
*/

export function ShareList({ shares }: { shares: (ReportShare & { url: string })[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [copied, setCopied] = useState<string | null>(null);

  if (shares.length === 0) {
    return (
      <div className="min-w-0 panel px-4 py-6 text-center">
        <p className="text-sm text-text-dim">No links yet.</p>
        <p className="mt-1 text-xs leading-relaxed text-text-faint">
          Open a report and press Share to make one. Every link expires, and you can withdraw it
          from here at any time.
        </p>
      </div>
    );
  }

  const copy = async (url: string, id: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(id);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      /* the input below is selectable; a failed copy is not worth an error */
    }
  };

  return (
    <div className="min-w-0 panel divide-y divide-line">
      {shares.map((s) => {
        const state = shareState(s);
        const live = state === "live";
        return (
          <div key={s.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
            <Link2
              className={cn("size-4 shrink-0", live ? "text-signal-bright" : "text-text-faint")}
            />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline gap-2">
                <span className="text-sm font-medium text-text-hi">
                  {shareKindLabel(s.kind)}
                </span>
                <span className="text-xs text-text-dim">
                  {/^\d{4}-\d{2}$/.test(s.ref) ? periodLabel(s.ref) : s.ref}
                </span>
              </div>
              <div className="mt-0.5 flex flex-wrap items-center gap-x-3 text-xs text-text-faint">
                <span className={cn(!live && "text-review")}>{expiryLabel(s)}</span>
                <span className="flex items-center gap-1">
                  <Eye className="size-3" />
                  {s.views} {plural(s.views, "view")}
                </span>
                {s.fields.length > 0 && (
                  <span>
                    {s.fields.length} {plural(s.fields.length, "field")} shown
                  </span>
                )}
              </div>
            </div>

            {live && (
              <>
                <button
                  onClick={() => copy(s.url, s.id)}
                  className="chip shrink-0 hover:border-signal-line hover:text-signal-bright"
                  title="Copy the link"
                >
                  {copied === s.id ? <Check className="size-3" /> : <Copy className="size-3" />}
                  {copied === s.id ? "copied" : "copy"}
                </button>
                <button
                  onClick={() =>
                    start(async () => {
                      await withdrawShare(s.id);
                      router.refresh();
                    })
                  }
                  disabled={pending}
                  aria-label="Withdraw this link"
                  className="shrink-0 text-text-faint transition-colors hover:text-correction disabled:opacity-50"
                >
                  {pending ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
                </button>
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}
