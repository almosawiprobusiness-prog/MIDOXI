"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Save, Loader2, Archive } from "lucide-react";
import { saveBoard, removeBoard, setBoardArchived } from "@/app/app/tactics/actions";
import { BoardEditor } from "@/components/tactics/board-editor";
import { countDocument } from "@/lib/tactics/document";
import { summariseLinks, type BoardLink } from "@/lib/tactics/links";
import {
  BOARD_PHASES,
  BOARD_KINDS,
  PITCH_TYPES,
  type BoardKind,
  type BoardPhase,
  type PitchType,
  type TacticalBoard,
  type TacticalDocument,
} from "@/lib/tactics/types";
import { FORMATION_NAMES } from "@/lib/tactics/document";
import { cn } from "@/lib/utils";
import { ConfirmDelete, FormError, FormNote } from "@/components/forms/ui";

/*
  The Tactics page's editing surface.

  What used to be a 551-line component that drew its own pitch, held its
  own tool state and imported its own save action is now a host: it owns
  the metadata around a board — title, phase, tags, notes — and delegates
  everything about the board itself to `BoardEditor`. That is what lets
  the same drawing surface appear inside a session drill and a Player's
  personal board without any of this page coming with it.
*/

export function TacticalBoardEditor({
  board,
  links = [],
}: {
  board: TacticalBoard;
  links?: BoardLink[];
}) {
  const router = useRouter();

  const [title, setTitle] = useState(board.title);
  const [kind, setKind] = useState<BoardKind>(board.kind);
  const [phase, setPhase] = useState<BoardPhase>(board.phase);
  const [formation, setFormation] = useState(board.formation || "4-3-3");
  const [notes, setNotes] = useState(board.notes);
  const [tagText, setTagText] = useState(board.tags.join(", "));
  const [doc, setDoc] = useState<TacticalDocument>(board.doc);
  const [dirty, setDirty] = useState(false);

  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const counts = countDocument(doc);
  const usage = summariseLinks(links);

  const touch = () => {
    setDirty(true);
    setNote(null);
  };

  /* The formation lives on the board record AND in the document, so the
     library card and the drawing cannot disagree about the shape. */
  const chooseFormation = (f: string) => {
    setFormation(f);
    touch();
    setDoc((d) => ({ ...d, formation: f }));
  };

  const choosePitch = (type: PitchType) => {
    setDoc((d) => ({ ...d, pitch: { ...d.pitch, type } }));
    touch();
  };

  const save = () => {
    setError(null);
    setNote(null);
    start(async () => {
      const res = await saveBoard(board.id, {
        title,
        kind,
        phase,
        formation,
        notes,
        tags: tagText
          .split(",")
          .map((t) => t.trim().toLowerCase())
          .filter(Boolean)
          .slice(0, 12),
        visibility: board.visibility,
        origin: board.origin,
        doc,
      });
      if (res.ok) {
        setDirty(false);
        setNote(res.message ?? "Board saved.");
        router.refresh();
      } else {
        setError(res.error);
      }
    });
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
      <BoardEditor
        doc={board.doc}
        mode={kind === "personal" ? "simple" : kind === "drill" ? "drill" : "full"}
        onChange={(next) => {
          setDoc(next);
          setDirty(true);
        }}
      />

      <div className="space-y-3">
        <div className="panel p-4">
          <label className="block">
            <span className="label-tech mb-1 block">Title</span>
            <input
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                touch();
              }}
              className="h-10 w-full rounded-lg border border-line bg-ink-850 px-3 text-sm text-text-hi focus:border-signal-line focus:outline-none"
            />
          </label>

          <label className="mt-3 block">
            <span className="label-tech mb-1 block">Objective</span>
            <input
              value={doc.objective ?? ""}
              onChange={(e) => {
                setDoc((d) => ({ ...d, objective: e.target.value }));
                touch();
              }}
              placeholder="What should this board make happen?"
              className="h-10 w-full rounded-lg border border-line bg-ink-850 px-3 text-sm text-text-hi placeholder:text-text-faint focus:border-signal-line focus:outline-none"
            />
            <span className="mt-1 block text-[11px] text-text-faint">
              One sentence. MIDO reads this when asked about the board.
            </span>
          </label>

          <div className="mt-3">
            <span className="label-tech mb-1 block">Board is</span>
            <div className="flex flex-wrap gap-1.5">
              {BOARD_KINDS.map((k) => (
                <button
                  key={k.kind}
                  type="button"
                  onClick={() => {
                    setKind(k.kind);
                    touch();
                  }}
                  className={cn(
                    "rounded-lg border px-2.5 py-1.5 text-xs transition-colors",
                    kind === k.kind
                      ? "border-signal-line bg-signal/10 text-signal-bright"
                      : "border-line text-text-dim hover:border-line-strong hover:text-text",
                  )}
                >
                  {k.label}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-3">
            <span className="label-tech mb-1 block">Surface</span>
            <div className="flex flex-wrap gap-1.5">
              {PITCH_TYPES.map((p) => (
                <button
                  key={p.type}
                  type="button"
                  onClick={() => choosePitch(p.type)}
                  title={p.hint}
                  className={cn(
                    "rounded-lg border px-2.5 py-1.5 text-xs transition-colors",
                    doc.pitch.type === p.type
                      ? "border-signal-line bg-signal/10 text-signal-bright"
                      : "border-line text-text-dim hover:border-line-strong hover:text-text",
                  )}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-3">
            <span className="label-tech mb-1 block">Formation</span>
            <div className="flex flex-wrap gap-1.5">
              {FORMATION_NAMES.map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => chooseFormation(f)}
                  className={cn(
                    "rounded-lg border px-2.5 py-1.5 text-xs transition-colors",
                    formation === f
                      ? "border-signal-line bg-signal/10 text-signal-bright"
                      : "border-line text-text-dim hover:border-line-strong hover:text-text",
                  )}
                >
                  {f}
                </button>
              ))}
            </div>
            <p className="mt-1.5 text-[11px] text-text-faint">
              Set the shape here; use the board&rsquo;s own tools to move anyone.
            </p>
          </div>

          <div className="mt-3">
            <span className="label-tech mb-1 block">Phase</span>
            <div className="flex flex-wrap gap-1.5">
              {BOARD_PHASES.map((p) => (
                <button
                  key={p.phase}
                  type="button"
                  onClick={() => {
                    setPhase(p.phase);
                    touch();
                  }}
                  className={cn(
                    "rounded-lg border px-2.5 py-1.5 text-xs transition-colors",
                    phase === p.phase
                      ? "border-signal-line bg-signal/10 text-signal-bright"
                      : "border-line text-text-dim hover:border-line-strong hover:text-text",
                  )}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <label className="mt-3 block">
            <span className="label-tech mb-1 block">Tags</span>
            <input
              value={tagText}
              onChange={(e) => {
                setTagText(e.target.value);
                touch();
              }}
              placeholder="wide trap, press trigger"
              className="h-10 w-full rounded-lg border border-line bg-ink-850 px-3 text-sm text-text-hi placeholder:text-text-faint focus:border-signal-line focus:outline-none"
            />
          </label>

          <label className="mt-3 block">
            <span className="label-tech mb-1 block">Notes</span>
            <textarea
              value={notes}
              rows={4}
              onChange={(e) => {
                setNotes(e.target.value);
                touch();
              }}
              placeholder="What is this board teaching? What does it create for the opponent?"
              className="w-full resize-y rounded-lg border border-line bg-ink-850 px-3 py-2 text-sm leading-relaxed text-text-hi placeholder:text-text-faint focus:border-signal-line focus:outline-none"
            />
          </label>

          <div className="mt-4 flex items-center gap-2">
            <button
              type="button"
              onClick={save}
              disabled={pending}
              className="flex h-10 flex-1 items-center justify-center gap-2 rounded-lg bg-signal text-sm font-medium text-white transition-colors hover:bg-signal-deep disabled:opacity-60"
            >
              {pending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
              {dirty ? "Save board" : "Saved"}
            </button>
            <ConfirmDelete onConfirm={() => removeBoard(board.id)} compact />
          </div>

          <FormError error={error} />
          <FormNote message={note} />
        </div>

        <div className="panel p-4">
          <div className="label-tech">On the board</div>
          <dl className="mt-2 space-y-1.5 text-sm">
            {[
              { label: "Your players", value: counts.ours },
              { label: "Opponents", value: counts.theirs },
              { label: "Movements", value: counts.paths },
              { label: "Zones", value: counts.zones },
              { label: "Phases", value: counts.frames },
            ].map((r) => (
              <div key={r.label} className="flex items-center justify-between">
                <dt className="text-text-dim">{r.label}</dt>
                <dd className="data-mono text-text">{r.value}</dd>
              </div>
            ))}
          </dl>

          {usage && (
            <p className="mt-3 border-t border-line pt-3 text-[11px] leading-relaxed text-text-dim">
              Used by {usage}. Editing this board updates it everywhere it is
              referenced — duplicate it first to change one place only.
            </p>
          )}

          <p className="mt-3 border-t border-line pt-3 text-[11px] leading-relaxed text-text-faint">
            Drag with <span className="text-text-dim">Move</span>. Draw with{" "}
            <span className="text-text-dim">Movement</span> or <span className="text-text-dim">Zone</span>.
            Click anything with <span className="text-text-dim">Erase</span> to remove it.
          </p>
        </div>

        <button
          type="button"
          onClick={() =>
            start(async () => {
              const res = await setBoardArchived(board.id, !board.archivedAt);
              if (!res.ok) setError(res.error);
              else router.refresh();
            })
          }
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-line py-2 text-xs text-text-faint transition-colors hover:border-line-strong hover:text-text"
        >
          <Archive className="size-3" />
          {board.archivedAt ? "Restore from archive" : "Archive this board"}
        </button>
      </div>
    </div>
  );
}
