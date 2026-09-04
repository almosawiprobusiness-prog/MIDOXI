"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Send, Check, Undo2 } from "lucide-react";
import { moveDeliverableTo } from "@/app/app/delivery/actions";
import { nextStates, type DeliverableStatus } from "@/lib/data/deliverable-types";

/*
  The review actions, on the page where the work is actually visible.

  Same state machine as the queue — `nextStates` decides what is offered, so
  the two surfaces cannot drift apart or offer a move the server refuses. The
  difference is only that here the reviewer has read the thing first, which is
  the whole reason this page exists.
*/

const VERB: Record<DeliverableStatus, string> = {
  draft: "Back to draft",
  in_review: "Send for review",
  changes_requested: "Request changes",
  approved: "Approve",
  delivered: "Send to client",
};

const ICON: Partial<Record<DeliverableStatus, typeof Check>> = {
  in_review: Send,
  approved: Check,
  changes_requested: Undo2,
  delivered: Send,
};

export function DeliverableActions({ id, status }: { id: string; status: DeliverableStatus }) {
  const [error, setError] = useState<string | null>(null);
  const [noteOpen, setNoteOpen] = useState(false);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [, start] = useTransition();
  const router = useRouter();

  const move = (to: DeliverableStatus, withNote?: string) => {
    setError(null);
    setBusy(to);
    start(async () => {
      const res = await moveDeliverableTo(id, to, withNote);
      if (res.ok) {
        setNoteOpen(false);
        setNote("");
        router.refresh();
      } else setError(res.error);
      setBusy(null);
    });
  };

  const moves = nextStates(status);
  if (moves.length === 0) {
    return <p className="text-xs text-positive">This is with the client. Nothing left to do.</p>;
  }

  return (
    <div>
      <div className="flex flex-wrap gap-1.5">
        {moves.map((to) => {
          const Icon = ICON[to];
          const asksForNote = to === "changes_requested";
          return (
            <button
              key={to}
              type="button"
              onClick={() => (asksForNote ? setNoteOpen((v) => !v) : move(to))}
              disabled={busy !== null}
              aria-expanded={asksForNote ? noteOpen : undefined}
              className={`flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-xs transition-colors disabled:opacity-50 ${
                to === "delivered"
                  ? "border-signal-line bg-signal text-white hover:bg-signal-deep"
                  : "border-line text-text-dim hover:border-signal-line hover:text-signal-bright"
              }`}
            >
              {busy === to ? (
                <Loader2 className="size-3 animate-spin" />
              ) : (
                Icon && <Icon className="size-3" />
              )}
              {VERB[to]}
            </button>
          );
        })}
      </div>

      {noteOpen && (
        <div className="mt-3 border-t border-line pt-3">
          <label htmlFor={`note-${id}`} className="label-tech">
            What needs changing
          </label>
          <textarea
            id={`note-${id}`}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            placeholder="Be specific — this is what the next draft is written against."
            className="mt-1.5 w-full rounded-lg border border-line bg-ink-900 px-3 py-2 text-sm text-text placeholder:text-text-faint focus:border-signal-line focus:outline-none"
          />
          <button
            type="button"
            onClick={() => move("changes_requested", note)}
            disabled={busy !== null || !note.trim()}
            className="mt-2 flex h-8 items-center gap-1.5 rounded-lg border border-line px-2.5 text-xs text-text-dim transition-colors hover:border-correction/60 hover:text-correction disabled:opacity-50"
          >
            <Undo2 className="size-3" />
            Send it back
          </button>
        </div>
      )}

      {error && (
        <p className="mt-3 rounded-lg border border-correction/30 bg-correction/10 px-3 py-2 text-xs text-correction">
          {error}
        </p>
      )}
    </div>
  );
}
