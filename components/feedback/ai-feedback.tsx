"use client";

import { useState, useTransition } from "react";
import { usePathname } from "next/navigation";
import { ThumbsUp, ThumbsDown, Check, Loader2 } from "lucide-react";
import { sendFeedback } from "@/app/app/feedback-actions";

/*
  Two thumbs on AI output, and nothing more.

  This is how the beta learns whether MIDO's football writing is
  actually useful, per surface, without a survey. A thumbs-down invites
  one optional line — invites, never requires, because a required reason
  converts "not useful" clicks into no clicks at all, and silence reads
  as approval.
*/

export function AiFeedback({ subject }: { subject: string }) {
  const pathname = usePathname();
  const [state, setState] = useState<"idle" | "down" | "sent">("idle");
  const [reason, setReason] = useState("");
  const [pending, start] = useTransition();

  const send = (rating: 1 | -1, body?: string) => {
    start(async () => {
      await sendFeedback({ kind: "ai_feedback", objectId: subject, route: pathname, rating, body });
      setState("sent");
    });
  };

  if (state === "sent") {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-text-faint">
        <Check className="size-3.5 text-positive" /> Noted — thank you.
      </span>
    );
  }

  if (state === "down") {
    return (
      <span className="inline-flex flex-wrap items-center gap-2">
        <input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          maxLength={300}
          placeholder="What was off? (optional)"
          className="h-8 w-56 rounded-lg border border-line bg-ink-900 px-2.5 text-xs text-text placeholder:text-text-faint focus:border-signal-line focus:outline-none"
        />
        <button
          onClick={() => send(-1, reason)}
          disabled={pending}
          className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-line px-2.5 text-xs text-text-dim hover:border-line-strong disabled:opacity-50"
        >
          {pending ? <Loader2 className="size-3 animate-spin" /> : null}
          Send
        </button>
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="text-xs text-text-faint">Useful?</span>
      <button
        onClick={() => send(1)}
        disabled={pending}
        className="grid size-7 place-items-center rounded-lg border border-line text-text-dim transition-colors hover:border-positive hover:text-positive disabled:opacity-50"
        aria-label="Useful"
      >
        <ThumbsUp className="size-3.5" />
      </button>
      <button
        onClick={() => setState("down")}
        disabled={pending}
        className="grid size-7 place-items-center rounded-lg border border-line text-text-dim transition-colors hover:border-correction hover:text-correction disabled:opacity-50"
        aria-label="Not useful"
      >
        <ThumbsDown className="size-3.5" />
      </button>
    </span>
  );
}
