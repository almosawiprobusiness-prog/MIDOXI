"use client";

import { useState, useTransition } from "react";
import { MessageSquarePlus, Check, Loader2, X } from "lucide-react";
import { sendFeedback, type FeedbackKind } from "@/app/app/feedback-actions";

/*
  The beta feedback door. One button, one small sheet, two kinds.

  Kept deliberately beneath a support system: no categories beyond
  problem/idea, no severity picker, no screenshots. Eleven founders who
  can reach us in one tap will tell us more than a form that interrogates
  them. The thank-you state names what actually happens — a person reads
  it — because "your feedback is important to us" is how products say
  nobody will.
*/

export function FeedbackButton() {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<FeedbackKind>("feedback");
  const [body, setBody] = useState("");
  const [state, setState] = useState<"idle" | "sent" | "error">("idle");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  const submit = () => {
    start(async () => {
      const res = await sendFeedback({ kind, body });
      if (res.ok) {
        setState("sent");
        setBody("");
      } else {
        setState("error");
        setError(res.error);
      }
    });
  };

  const close = () => {
    setOpen(false);
    setState("idle");
    setError("");
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="grid size-9 place-items-center rounded-lg border border-line text-text-dim transition-colors hover:border-line-strong hover:text-text"
        title="Send feedback"
        aria-label="Send feedback"
      >
        <MessageSquarePlus className="size-4" />
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center"
          onClick={close}
          role="dialog"
          aria-modal="true"
          aria-label="Send feedback"
        >
          <div
            className="w-full max-w-md panel-raised p-5"
            onClick={(e) => e.stopPropagation()}
          >
            {state === "sent" ? (
              <div className="flex items-start gap-3">
                <Check className="mt-0.5 size-4 shrink-0 text-positive" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-text-hi">Sent. A person reads every one of these.</p>
                  <p className="mt-1 text-sm text-text-dim">
                    You are one of eleven — what you say here shapes what gets built next.
                  </p>
                </div>
                <button onClick={close} className="text-text-faint hover:text-text" aria-label="Close">
                  <X className="size-4" />
                </button>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-sm font-medium text-text-hi">Tell us something</h2>
                  <button onClick={close} className="text-text-faint hover:text-text" aria-label="Close">
                    <X className="size-4" />
                  </button>
                </div>

                <div className="mt-3 flex gap-2">
                  {(
                    [
                      { k: "problem" as const, label: "Something's broken" },
                      { k: "feedback" as const, label: "Idea / feedback" },
                    ]
                  ).map(({ k, label }) => (
                    <button
                      key={k}
                      onClick={() => setKind(k)}
                      className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                        kind === k
                          ? "border-signal-line bg-signal/10 text-signal-bright"
                          : "border-line text-text-dim hover:border-line-strong"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  rows={4}
                  maxLength={2000}
                  placeholder={
                    kind === "problem"
                      ? "What happened, and where? Rough is fine."
                      : "What would make MIDO more useful to you?"
                  }
                  className="mt-3 w-full resize-none rounded-lg border border-line bg-ink-900 px-3 py-2.5 text-sm text-text placeholder:text-text-faint focus:border-signal-line focus:outline-none"
                />

                {state === "error" && <p className="mt-2 text-xs text-correction">{error}</p>}

                <div className="mt-3 flex justify-end">
                  <button
                    onClick={submit}
                    disabled={pending || !body.trim()}
                    className="inline-flex h-9 items-center gap-2 rounded-lg bg-signal px-4 text-sm font-medium text-white transition-colors hover:bg-signal-deep disabled:opacity-50"
                  >
                    {pending && <Loader2 className="size-3.5 animate-spin" />}
                    Send
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
