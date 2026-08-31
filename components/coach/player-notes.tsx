"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { addNote, removeNote } from "@/app/app/squad/actions";
import { NOTE_KINDS, noteKindMeta, type PlayerNote, type PlayerNoteKind } from "@/lib/data/coach-types";
import { ChipPicker, TextArea, FormError } from "@/components/forms/ui";

/*
  A player's development history. Every note is dated and typed, so six months
  later a coach can see how a player actually developed rather than guessing.
*/
export function PlayerNotes({ playerId, notes }: { playerId: string; notes: PlayerNote[] }) {
  const router = useRouter();
  const [kind, setKind] = useState<PlayerNoteKind>("note");
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const submit = () => {
    setError(null);
    start(async () => {
      const res = await addNote(playerId, kind, body);
      if (res.ok) {
        setBody("");
        router.refresh();
      } else {
        setError(res.error);
      }
    });
  };

  return (
    <div>
      <div className="panel p-4">
        <ChipPicker<PlayerNoteKind>
          value={kind}
          onChange={setKind}
          options={NOTE_KINDS.map((n) => ({ value: n.kind, label: n.label, color: n.color }))}
        />
        <div className="mt-3">
          <TextArea
            value={body}
            onChange={setBody}
            rows={2}
            placeholder={
              kind === "focus"
                ? "The development focus this player is working on…"
                : kind === "match"
                  ? "What you saw in the match…"
                  : "What you saw…"
            }
          />
        </div>
        <div className="mt-2 flex items-center gap-2">
          <button
            onClick={submit}
            disabled={pending || !body.trim()}
            className="flex h-9 items-center gap-2 rounded-lg border border-signal-line bg-signal/10 px-3 text-sm font-medium text-signal-bright transition-colors hover:bg-signal/20 disabled:opacity-40"
          >
            {pending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
            Add
          </button>
          {kind === "focus" && (
            <span className="text-[11px] text-text-faint">
              A new focus also becomes this player&rsquo;s squad headline.
            </span>
          )}
        </div>
        <FormError error={error} />
      </div>

      {notes.length > 0 ? (
        <ol className="mt-4 space-y-2">
          {notes.map((n) => {
            const meta = noteKindMeta(n.kind);
            return (
              <li key={n.id} className="panel flex items-start gap-3 p-4">
                <span className="mt-1.5 size-1.5 shrink-0 rounded-full" style={{ background: meta.color }} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="label-tech" style={{ color: meta.color }}>
                      {meta.label}
                    </span>
                    <span className="label-tech !text-text-faint">
                      {new Date(n.createdAt).toLocaleDateString("en-GB", {
                        timeZone: "UTC",
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </span>
                  </div>
                  <p className="mt-1 text-sm leading-relaxed text-text">{n.body}</p>
                </div>
                <DeleteNote playerId={playerId} noteId={n.id} />
              </li>
            );
          })}
        </ol>
      ) : (
        <p className="mt-4 text-sm text-text-dim">
          No history yet. Notes written here build this player&rsquo;s development record over the season.
        </p>
      )}
    </div>
  );
}

function DeleteNote({ playerId, noteId }: { playerId: string; noteId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button
      onClick={() =>
        start(async () => {
          await removeNote(playerId, noteId);
          router.refresh();
        })
      }
      aria-label="Delete note"
      className="shrink-0 text-text-faint transition-colors hover:text-correction"
    >
      {pending ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
    </button>
  );
}
