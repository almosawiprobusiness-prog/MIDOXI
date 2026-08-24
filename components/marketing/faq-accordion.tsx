"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";

export function FaqAccordion({ items }: { items: { question: string; answer: string }[] }) {
  // First one open by default — an FAQ that opens fully collapsed makes
  // somebody click before they even know there's an answer worth reading.
  const [open, setOpen] = useState<number | null>(0);

  return (
    <div className="divide-y divide-line rounded-xl border border-line">
      {items.map((item, i) => {
        const expanded = open === i;
        return (
          <div key={item.question}>
            <button
              onClick={() => setOpen(expanded ? null : i)}
              aria-expanded={expanded}
              className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
            >
              <span className="font-display text-[15px] font-semibold text-text-hi">{item.question}</span>
              <Plus
                className={cn(
                  "size-4 shrink-0 text-text-faint transition-transform duration-200",
                  expanded && "rotate-45 text-signal-bright",
                )}
              />
            </button>
            <div
              className={cn(
                "grid transition-all duration-200 ease-out",
                expanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
              )}
            >
              <div className="overflow-hidden">
                <p className="px-5 pb-4 text-sm leading-relaxed text-text-dim">{item.answer}</p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
