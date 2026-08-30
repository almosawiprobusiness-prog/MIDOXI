"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, CornerDownLeft, Sparkles } from "lucide-react";
import { parseIntent } from "@/lib/knowledge/intent";
import { searchKnowledge } from "@/lib/knowledge/graph";
import type { RoleId } from "@/lib/roles/roles";

/*
  The study command line. "Study Harry Kane" is the headline command, but the
  same input routes concepts, sessions and questions — intent is classified
  deterministically, so nothing is spent working out where a request belongs.
*/
export function StudyCommand({ role, openers }: { role: RoleId; openers: string[] }) {
  const router = useRouter();
  const [q, setQ] = useState("");

  const intent = useMemo(() => parseIntent(q, role), [q, role]);
  const hits = useMemo(() => (q.trim().length > 1 && !intent ? searchKnowledge(q, 5) : []), [q, intent]);

  const go = () => {
    if (intent) return router.push(intent.href);
    if (hits[0]) return router.push(hits[0].href);
  };

  return (
    <div className="relative overflow-hidden rounded-xl border border-signal-line bg-gradient-to-b from-signal/10 via-ink-900 to-ink-900">
      <div className="field-glow absolute inset-0" aria-hidden />
      <div className="relative">
        <div className="label-tech !text-signal-bright border-b border-line px-4 py-2.5">Study command / 01</div>
        <div className="flex items-center gap-3 px-4">
          <Search className="size-4 shrink-0 text-signal-bright" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && go()}
            placeholder="Study Harry Kane"
            className="h-14 flex-1 bg-transparent text-[15px] text-text-hi placeholder:text-text-faint focus:outline-none"
          />
          {(intent || hits.length > 0) && (
            <button
              onClick={go}
              className="hidden h-8 items-center gap-1.5 rounded-lg border border-signal-line bg-signal/10 px-3 text-xs font-medium text-signal-bright sm:flex"
            >
              Open <CornerDownLeft className="size-3" />
            </button>
          )}
        </div>

        {intent && (
          <button
            onClick={go}
            className="flex w-full items-start gap-3 border-t border-line px-4 py-3 text-left transition-colors hover:bg-ink-850"
          >
            <Sparkles className="mt-0.5 size-4 shrink-0 text-signal-bright" />
            <span className="min-w-0">
              <span className="block text-sm text-text-hi">{intent.label}</span>
              <span className="mt-0.5 block text-xs text-text-dim">{intent.hint}</span>
            </span>
          </button>
        )}

        {!intent && hits.length > 0 && (
          <div className="border-t border-line">
            {hits.map((h) => (
              <button
                key={h.kind + h.slug}
                onClick={() => router.push(h.href)}
                className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-ink-850"
              >
                <span className="chip shrink-0">{h.kind}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-text-hi">{h.title}</span>
                  <span className="block truncate text-xs text-text-dim">{h.subtitle}</span>
                </span>
              </button>
            ))}
          </div>
        )}

        {!q && (
          <div className="flex flex-wrap gap-2 border-t border-line px-4 py-3">
            {openers.map((o) => (
              <button
                key={o}
                onClick={() => setQ(o)}
                className="chip chip-prose transition-colors hover:border-signal-line hover:text-signal-bright"
              >
                {o}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
