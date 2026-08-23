"use client";

import { useState } from "react";
import Link from "next/link";
import { X, Sparkles, ArrowUpRight } from "lucide-react";
import type { ProfilePrompt } from "@/lib/data/profiling";

/*
  One question, at the moment it matters.

  Dismissal is remembered in `sessionStorage` rather than the database on
  purpose: this is not a decision worth persisting forever. Someone who does not
  want to answer today is not saying "never ask me again" — and a prompt that
  can be permanently silenced by one impatient click is a prompt that stops
  doing its job for the accounts that most need it.
*/

const KEY = "mido:dismissed-prompt";

export function ProfilePromptCard({ prompt }: { prompt: ProfilePrompt | null }) {
  const [dismissed, setDismissed] = useState(() => {
    if (typeof window === "undefined") return false;
    return sessionStorage.getItem(KEY) === prompt?.field;
  });

  if (!prompt || dismissed) return null;

  const dismiss = () => {
    try {
      sessionStorage.setItem(KEY, prompt.field);
    } catch {
      // Private browsing can refuse storage; dismissing for this render is enough.
    }
    setDismissed(true);
  };

  return (
    <div className="min-w-0 panel relative flex items-start gap-3 p-4">
      <Sparkles className="mt-0.5 size-4 shrink-0 text-signal-bright" aria-hidden />
      <div className="min-w-0 flex-1 pr-6">
        <p className="text-sm font-medium text-text-hi">{prompt.ask}</p>
        <p className="mt-0.5 text-sm leading-relaxed text-text-dim">{prompt.unlocks}</p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {prompt.options?.map((o) => (
            <span key={o} className="chip">
              {o}
            </span>
          ))}
          <Link
            href={prompt.href}
            className="inline-flex items-center gap-1 text-xs text-signal-bright transition-colors hover:text-text-hi"
          >
            Answer it
            <ArrowUpRight className="size-3.5" />
          </Link>
        </div>
      </div>
      <button
        onClick={dismiss}
        aria-label="Not now"
        className="absolute right-3 top-3 grid size-6 place-items-center rounded-md text-text-faint transition-colors hover:bg-ink-800 hover:text-text"
      >
        <X className="size-3.5" />
      </button>
    </div>
  );
}
