"use client";

import { useState, useTransition } from "react";
import { Loader2, Send, Check, Undo2, Sparkles, User } from "lucide-react";
import { moveDeliverableTo } from "@/app/app/delivery/actions";
import {
  kindLabel,
  label,
  nextAction,
  nextStates,
  type Deliverable,
  type DeliverableStatus,
} from "@/lib/data/deliverable-types";

/*
  The queue, as a person works it.

  The buttons on a row are `nextStates(status)` — the same state machine the
  server enforces — so the UI cannot offer a move the action will refuse. It
  is one source of truth rendered, rather than a second copy of the rules.

  The deliberate friction: sending work back opens a note field and will not
  submit empty. A rejection without a reason produces a second draft with the
  same problem in it.
*/

const TONE: Record<DeliverableStatus, string> = {
  draft: "text-text-dim",
  in_review: "text-caution",
  changes_requested: "text-correction",
  approved: "text-signal-bright",
  delivered: "text-positive",
};

const ICON: Partial<Record<DeliverableStatus, typeof Check>> = {
  in_review: Send,
  approved: Check,
  changes_requested: Undo2,
  delivered: Send,
};

const VERB: Record<DeliverableStatus, string> = {
  draft: "Back to draft",
  in_review: "Send for review",
  changes_requested: "Request changes",
  approved: "Approve",
  delivered: "Send to client",
};

export function DeliveryQueue({ items }: { items: Deliverable[] }) {
  const [error, setError] = useState<string | null>(null);
  const [noteFor, setNoteFor] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [, start] = useTransition();

  const move = (id: string, to: DeliverableStatus, withNote?: string) => {
    setError(null);
    setBusy(`${id}:${to}`);
    start(async () => {
      const res = await moveDeliverableTo(id, to, withNote);
      if (!res.ok) setError(res.error);
      else {
        setNoteFor(null);
        setNote("");
      }
      setBusy(null);
    });
  };

  if (items.length === 0) {
    return (
      <div className="panel p-6 text-center">
        <p className="text-sm text-text-dim">Nothing in the queue.</p>
        <p className="mt-1 text-xs leading-relaxed text-text-faint">
          Work drafted for a client lands here first. Nothing reaches them until a person has read
          it and approved it.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {error && (
        <p className="rounded-lg border border-correction/30 bg-correction/10 px-3 py-2 text-xs text-correction">
          {error}
        </p>
      )}

      {items.map((d) => {
        const moves = nextStates(d.status);
        return (
          <article key={d.id} className="panel p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-display text-base font-semibold leading-tight text-text-hi">
                    {d.title}
                  </h3>
                  <span className={`label-tech ${TONE[d.status]}`}>{label(d.status)}</span>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-text-faint">
                  <span>{kindLabel(d.kind)}</span>
                  <span aria-hidden>·</span>
                  {/* Who wrote it — a question a client is entitled to ask. */}
                  <span className="inline-flex items-center gap-1">
                    {d.aiDrafted ? (
                      <>
                        <Sparkles className="size-3" /> MIDO drafted
                      </>
                    ) : (
                      <>
                        <User className="size-3" /> Written by hand
                      </>
                    )}
                  </span>
                </div>
              </div>

              <span className="text-[11px] leading-relaxed text-text-faint">
                {nextAction(d.status)}
              </span>
            </div>

            {d.reviewNote && (
              <p className="mt-3 border-l-2 border-correction/50 pl-3 text-sm leading-relaxed text-text-dim">
                {d.reviewNote}
              </p>
            )}

            {moves.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-1.5">
                {moves.map((to) => {
                  const Icon = ICON[to];
                  const key = `${d.id}:${to}`;
                  const send = to === "changes_requested";
                  return (
                    <button
                      key={to}
                      type="button"
                      onClick={() => (send ? setNoteFor(noteFor === d.id ? null : d.id) : move(d.id, to))}
                      disabled={busy !== null}
                      aria-expanded={send ? noteFor === d.id : undefined}
                      className={`flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-xs transition-colors disabled:opacity-50 ${
                        to === "delivered"
                          ? "border-signal-line bg-signal text-white hover:bg-signal-deep"
                          : "border-line text-text-dim hover:border-signal-line hover:text-signal-bright"
                      }`}
                    >
                      {busy === key ? (
                        <Loader2 className="size-3 animate-spin" />
                      ) : (
                        Icon && <Icon className="size-3" />
                      )}
                      {VERB[to]}
                    </button>
                  );
                })}
              </div>
            )}

            {noteFor === d.id && (
              <div className="mt-3 border-t border-line pt-3">
                <label htmlFor={`note-${d.id}`} className="label-tech">
                  What needs changing
                </label>
                <textarea
                  id={`note-${d.id}`}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={3}
                  placeholder="Be specific — this is what the next draft is written against."
                  className="mt-1.5 w-full rounded-lg border border-line bg-ink-900 px-3 py-2 text-sm text-text placeholder:text-text-faint focus:border-signal-line focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => move(d.id, "changes_requested", note)}
                  disabled={busy !== null || !note.trim()}
                  className="mt-2 flex h-8 items-center gap-1.5 rounded-lg border border-line px-2.5 text-xs text-text-dim transition-colors hover:border-correction/60 hover:text-correction disabled:opacity-50"
                >
                  <Undo2 className="size-3" />
                  Send it back
                </button>
              </div>
            )}
          </article>
        );
      })}
    </div>
  );
}
