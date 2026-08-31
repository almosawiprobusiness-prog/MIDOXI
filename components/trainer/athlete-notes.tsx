"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { addNote, removeNote } from "@/app/app/athletes/actions";
import {
  ATHLETE_NOTE_KINDS,
  athleteNoteMeta,
  type AthleteNote,
  type AthleteNoteKind,
} from "@/lib/data/trainer-types";
import { ChipPicker, TextArea, FormError } from "@/components/forms/ui";

/*
  An athlete's record. Objectives and limitations written here also update the
  roster, because a limitation nobody sees is a limitation that gets programmed
  straight through.
*/
export function AthleteNotes({ athleteId, notes }: { athleteId: string; notes: AthleteNote[] }) {
  const router = useRouter();
  const [kind, setKind] = useState<AthleteNoteKind>("session");
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const submit = () => {
    setError(null);
    start(async () => {
      const res = await addNote(athleteId, kind, body);
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
        <ChipPicker<AthleteNoteKind>
          value={kind}
          onChange={setKind}
          options={ATHLETE_NOTE_KINDS.map((n) => ({ value: n.kind, label: n.label, color: n.color }))}
        />
        <div className="mt-3">
          <TextArea
            value={body}
            onChange={setBody}
            rows={2}
            placeholder={
              kind === "limitation"
                ? "What must a session respect?"
                : kind === "objective"
                  ? "What is the physical work for?"
                  : "What happened?"
            }
          />
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <button
            onClick={submit}
            disabled={pending || !body.trim()}
            className="flex h-9 items-center gap-2 rounded-lg border border-signal-line bg-signal/10 px-3 text-sm font-medium text-signal-bright transition-colors hover:bg-signal/20 disabled:opacity-40"
          >
            {pending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
            Add
          </button>
          {(kind === "objective" || kind === "limitation") && (
            <span className="text-[11px] text-text-faint">
              This also updates the athlete&rsquo;s {kind === "objective" ? "objective" : "limitations"} on
              the roster.
            </span>
          )}
        </div>
        <FormError error={error} />
      </div>

      {notes.length > 0 ? (
        <ol className="mt-4 space-y-2">
          {notes.map((n) => {
            const meta = athleteNoteMeta(n.kind);
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
                <DeleteNote athleteId={athleteId} noteId={n.id} />
              </li>
            );
          })}
        </ol>
      ) : (
        <p className="mt-4 text-sm text-text-dim">
          Nothing recorded yet. Objectives, limitations and session notes build the record a block is
          programmed from.
        </p>
      )}
    </div>
  );
}

function DeleteNote({ athleteId, noteId }: { athleteId: string; noteId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button
      onClick={() =>
        start(async () => {
          await removeNote(athleteId, noteId);
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
