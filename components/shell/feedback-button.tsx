"use client";

import { useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
import { MessageSquarePlus, Check, Loader2, X } from "lucide-react";
import { sendFeedback, type FeedbackKind } from "@/app/app/feedback-actions";

/*
  The beta feedback door. One button, one sheet, five words.

  PORTALLED TO THE BODY, and it must stay that way. The topbar carries
  `backdrop-blur`, and a backdrop-filter makes an element a containing
  block for `position: fixed` descendants — so a modal rendered in place
  here anchors to a 56px-tall header rather than the viewport, and lands
  mostly above the top of the screen. Measured, not theorised: the
  overlay came back 55px tall with the panel at y = -148.

  That failure is quiet in the worst way. The sheet still exists, still
  reads correctly in the DOM, and still submits if you can reach it —
  so a DOM-level check passes while a player sees a sliver of a box, or
  nothing. For the one surface that collects every piece of beta
  evidence, "renders off-screen for some viewports" would have meant
  silence we then misread as contentment.

  Every category is phrased as something a footballer would actually
  say. Nobody picks "severity: high" — they pick "something didn't
  work", and we work out what that means on our side. The whole design
  rule here is that the player should be able to write "my video never
  finished uploading" and press send: the route, the device class and
  the build are attached automatically, because asking a player to
  describe which screen they were on is asking them to do our job.
*/

const KINDS: { k: FeedbackKind; label: string; hint: string }[] = [
  { k: "bug", label: "Something didn't work", hint: "What were you doing when it went wrong? Rough is fine." },
  { k: "confusing", label: "I didn't understand", hint: "What did you expect to happen instead?" },
  { k: "idea", label: "An idea", hint: "What would make MIDO more useful to you?" },
  { k: "ai_feedback", label: "MIDO got it wrong", hint: "What did MIDO say, and what was wrong about it?" },
  { k: "other", label: "Something else", hint: "Anything at all." },
];

export function FeedbackButton() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<FeedbackKind>("bug");
  const [body, setBody] = useState("");
  const [state, setState] = useState<"idle" | "sent" | "error">("idle");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  const active = KINDS.find((k) => k.k === kind) ?? KINDS[0];

  const submit = () => {
    start(async () => {
      const res = await sendFeedback({ kind, body, route: pathname });
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

      {open && typeof document !== "undefined" && createPortal(
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center"
          onClick={close}
          role="dialog"
          aria-modal="true"
          aria-label="Send feedback"
        >
          <div
            className="max-h-[90vh] w-full max-w-md overflow-y-auto panel-raised p-5"
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

                <div className="mt-3 flex flex-wrap gap-2">
                  {KINDS.map(({ k, label }) => (
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
                  placeholder={active.hint}
                  className="mt-3 w-full resize-none rounded-lg border border-line bg-ink-900 px-3 py-2.5 text-sm text-text placeholder:text-text-faint focus:border-signal-line focus:outline-none"
                />

                {/*
                  Said plainly rather than buried in a privacy page. A
                  player who knows exactly what is attached is a player
                  who will keep sending these.
                */}
                <p className="mt-2 text-[11px] leading-relaxed text-text-faint">
                  Sent with this: the page you are on ({pathname}), whether you are on a phone
                  or a computer, and the app version. Nothing else.
                </p>

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
        </div>,
        document.body,
      )}
    </>
  );
}
