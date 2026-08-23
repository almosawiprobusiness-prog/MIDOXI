import { Ban, Check, Sparkles } from "lucide-react";
import { CAPABILITIES, LIMITS, capabilitiesFor } from "@/lib/ai/capabilities";
import type { RoleId } from "@/lib/roles/roles";

/*
  The reach of the product, stated where someone is deciding whether to pay for
  it. Two lists, and the second one is the reason to trust the first.

  Everything here is read from the capability registry rather than written as
  marketing copy, so this panel cannot drift away from what the software
  actually does — adding a builder adds a row, and removing one removes it.
*/

const PATH_LABEL = {
  deterministic: { label: "Free", hint: "Rules and curated football knowledge — no allowance used" },
  both: { label: "Free + AI", hint: "Drafts free; Claude deepens it when you ask" },
  ai: { label: "Pro", hint: "Runs on Claude, metered against your plan" },
} as const;

export function WhatMidoBuilds({ role, isPro }: { role: RoleId; isPro: boolean }) {
  const mine = capabilitiesFor(role);
  const others = CAPABILITIES.filter((c) => !c.roles.includes(role));

  return (
    <div className="space-y-3">
      <div className="panel divide-y divide-line">
        {mine.map((c) => {
          const path = PATH_LABEL[c.path];
          const locked = c.path === "ai" && !isPro;
          return (
            <div key={c.id} className="flex items-start gap-3 p-4">
              <Check
                className={`mt-0.5 size-4 shrink-0 ${locked ? "text-text-faint" : "text-positive"}`}
              />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm text-text-hi">{c.builds}</span>
                  <span className="chip" title={path.hint}>
                    {path.label}
                  </span>
                </div>
                <p className="text-xs leading-relaxed text-text-dim">{c.produces}</p>
                {c.needs.length > 0 && (
                  <p className="mt-1 text-xs text-text-faint">Needs: {c.needs.join(" · ")}</p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {others.length > 0 && (
        <p className="text-xs leading-relaxed text-text-faint">
          <Sparkles className="mr-1 inline size-3" />
          {others.length} more {others.length === 1 ? "builder belongs" : "builders belong"} to the
          other operating systems — switch role and they appear. One account, four systems.
        </p>
      )}

      <div className="panel overflow-hidden">
        <div className="border-b border-line px-4 py-3">
          <span className="label-tech">And what it will not do</span>
        </div>
        <div className="divide-y divide-line">
          {LIMITS.map((l) => (
            <div key={l.asked} className="flex items-start gap-3 p-4">
              <Ban className="mt-0.5 size-4 shrink-0 text-text-faint" />
              <div className="min-w-0">
                <div className="text-sm text-text-dim">{l.asked}</div>
                <p className="text-xs leading-relaxed text-text-faint">
                  {l.why}
                  {l.wouldNeed ? ` Would need: ${l.wouldNeed}` : ""}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <p className="text-xs leading-relaxed text-text-faint">
        Ask for any of these in the command bar and MIDO routes you to the builder that owns it. Ask
        for something on the second list and it says so, rather than inventing an answer.
      </p>
    </div>
  );
}
