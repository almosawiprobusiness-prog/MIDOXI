"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Grid3x3, Plus, Loader2, Copy, Check, Sparkles, Info } from "lucide-react";
import { attachBoard, newBoardFor } from "@/app/app/tactics/actions";
import { askDraftBoard } from "@/app/app/tactics/ai-actions";
import { BoardView } from "./board-view";
import { FORMATION_NAMES } from "@/lib/tactics/document";
import type { TacticalBoard } from "@/lib/tactics/types";
import type { BoardEntityType, BoardLinkRole } from "@/lib/tactics/links";
import { Modal, FormError } from "@/components/forms/ui";
import { cn } from "@/lib/utils";

/*
  Attach a tactical board — the one picker, used everywhere (§14).

  Three ways in, which is what the brief asks for minus the ones that do
  not exist yet: pick a saved board, duplicate a saved board so edits
  stay local to this drill, or start a new one from a formation. MIDO
  generation is deliberately absent rather than stubbed — a button that
  produces nothing is worse than no button.

  The candidate list is passed in from the server rather than fetched
  here, so opening the picker costs nothing and a session page with six
  drills does not make six round trips.
*/

export function BoardPicker({
  entityType,
  entityId,
  boards,
  revalidate,
  label = "Attach tactical board",
  compact,
  role,
}: {
  entityType: BoardEntityType;
  entityId: string;
  /** The user's boards, newest first. Supplied by the page. */
  boards: TacticalBoard[];
  /** Path to refresh after attaching, e.g. the session page. */
  revalidate?: string;
  label?: string;
  compact?: boolean;
  /**
   * Why it is being attached. `assigned` is the one that crosses an
   * account boundary — it is what migration 0045's policy lets the other
   * person read — so it is passed explicitly rather than inferred.
   */
  role?: BoardLinkRole;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"saved" | "new" | "mido">("saved");
  const [ask, setAsk] = useState("");
  const [midoNote, setMidoNote] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [formation, setFormation] = useState("4-3-3");
  const [title, setTitle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);

  const shown = q.trim()
    ? boards.filter((b) =>
        [b.title, b.notes, b.formation, ...b.tags].join(" ").toLowerCase().includes(q.trim().toLowerCase()),
      )
    : boards;

  const close = () => {
    setOpen(false);
    setError(null);
    setQ("");
  };

  const attach = (boardId: string, duplicate: boolean) => {
    setError(null);
    setBusyId(boardId + (duplicate ? "-d" : ""));
    start(async () => {
      const res = await attachBoard(boardId, entityType, entityId, { duplicate, revalidate, role });
      setBusyId(null);
      if (!res.ok) return setError(res.error);
      close();
      router.refresh();
    });
  };

  const create = () => {
    setError(null);
    start(async () => {
      const res = await newBoardFor(entityType, entityId, formation, title, revalidate);
      if (!res.ok) return setError(res.error);
      close();
      router.refresh();
    });
  };

  /*
    Ask MIDO to draw it, then attach what came back.

    Two steps rather than one action, because the board must exist as a
    real editable object either way — §42 forbids a generated board that
    cannot be changed, and a draft that only lives inside an attachment
    would be exactly that.
  */
  const generate = () => {
    setError(null);
    setMidoNote(null);
    start(async () => {
      const res = await askDraftBoard(ask, { formation });
      if (!res.ok) return setError(res.error);
      const attached = await attachBoard(res.data.boardId, entityType, entityId, {
        revalidate,
        role,
      });
      if (!attached.ok) return setError(attached.error);
      // A composed fallback is still attached — and still said out loud.
      if (res.data.composed || res.data.note) {
        setMidoNote(res.data.note ?? "MIDO drew the starting shape only.");
        router.refresh();
        return;
      }
      close();
      router.refresh();
    });
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "flex items-center gap-1.5 rounded-lg border border-line text-text-dim transition-colors hover:border-signal-line hover:text-signal-bright",
          compact ? "h-7 px-2 text-[11px]" : "h-9 px-3 text-xs",
        )}
      >
        <Grid3x3 className={compact ? "size-3" : "size-3.5"} /> {label}
      </button>

      <Modal open={open} onClose={close} eyebrow="Tactical board" title={label}>
        <div className="mb-3 flex items-center gap-1 border-b border-line pb-2">
          {(["saved", "new", "mido"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={cn(
                "rounded-md px-2.5 py-1.5 text-xs transition-colors",
                tab === t ? "bg-signal/10 text-signal-bright" : "text-text-dim hover:text-text",
              )}
            >
              {t === "saved" ? `Saved · ${boards.length}` : t === "new" ? "Create new" : "Ask MIDO"}
            </button>
          ))}
        </div>

        {tab === "mido" ? (
          <>
            <label className="block">
              <span className="label-tech mb-1 block">What should the board show?</span>
              <textarea
                value={ask}
                onChange={(e) => setAsk(e.target.value)}
                rows={3}
                placeholder="A 4v4+3 possession exercise for playing through midfield"
                className="w-full resize-y rounded-lg border border-line bg-ink-850 px-3 py-2 text-sm leading-relaxed text-text-hi placeholder:text-text-faint focus:border-signal-line focus:outline-none"
              />
            </label>

            <p className="mt-2 flex items-start gap-1.5 text-[11px] leading-relaxed text-text-faint">
              <Info className="mt-0.5 size-3 shrink-0" />
              MIDO draws a real board you can then move, redraw and save. It is marked as MIDO&rsquo;s
              draft, never as yours.
            </p>

            <button
              type="button"
              onClick={generate}
              disabled={pending || !ask.trim()}
              className="mt-3 flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-signal text-sm font-medium text-white transition-colors hover:bg-signal-deep disabled:opacity-60"
            >
              {pending ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
              Draw it
            </button>

            {midoNote && (
              <p className="mt-3 rounded-lg border border-review/30 bg-review/10 px-3 py-2 text-xs leading-relaxed text-review">
                {midoNote}
              </p>
            )}
          </>
        ) : tab === "saved" ? (
          <>
            {boards.length > 6 && (
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search your boards…"
                aria-label="Search boards"
                className="mb-3 h-9 w-full rounded-lg border border-line bg-ink-850 px-3 text-sm text-text-hi placeholder:text-text-faint focus:border-signal-line focus:outline-none"
              />
            )}

            {shown.length === 0 ? (
              <p className="py-6 text-center text-sm text-text-dim">
                {boards.length === 0
                  ? "No saved boards yet. Create one on the Create new tab."
                  : "Nothing matches that search."}
              </p>
            ) : (
              <ul className="max-h-[46vh] space-y-2 overflow-y-auto pr-1">
                {shown.map((b) => (
                  <li key={b.id} className="flex items-center gap-3 rounded-lg border border-line p-2">
                    <span className="h-14 w-10 shrink-0 overflow-hidden rounded border border-line">
                      <BoardView doc={b.doc} scope={`pick-${b.id}`} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm text-text-hi">{b.title}</span>
                      <span className="label-tech block">
                        {b.formation} · {b.phase.replace(/-/g, " ")}
                      </span>
                    </span>
                    <span className="flex shrink-0 items-center gap-1">
                      <button
                        type="button"
                        onClick={() => attach(b.id, false)}
                        disabled={pending}
                        title="Attach this board. Editing it later updates everywhere it is used."
                        className="flex h-7 items-center gap-1 rounded-md border border-signal-line px-2 text-[11px] text-signal-bright transition-colors hover:bg-signal/10 disabled:opacity-50"
                      >
                        {busyId === b.id ? <Loader2 className="size-3 animate-spin" /> : <Check className="size-3" />}
                        Use
                      </button>
                      <button
                        type="button"
                        onClick={() => attach(b.id, true)}
                        disabled={pending}
                        title="Attach a copy, so changes here do not affect the original"
                        aria-label="Duplicate and attach"
                        className="grid size-7 place-items-center rounded-md border border-line text-text-dim transition-colors hover:text-text disabled:opacity-50"
                      >
                        {busyId === `${b.id}-d` ? <Loader2 className="size-3 animate-spin" /> : <Copy className="size-3" />}
                      </button>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </>
        ) : (
          <>
            <label className="block">
              <span className="label-tech mb-1 block">Title</span>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Third-man combination"
                className="h-10 w-full rounded-lg border border-line bg-ink-850 px-3 text-sm text-text-hi placeholder:text-text-faint focus:border-signal-line focus:outline-none"
              />
            </label>

            <div className="mt-3">
              <span className="label-tech mb-1 block">Starting shape</span>
              <div className="flex flex-wrap gap-1.5">
                {FORMATION_NAMES.map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setFormation(f)}
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
            </div>

            <button
              type="button"
              onClick={create}
              disabled={pending}
              className="mt-4 flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-signal text-sm font-medium text-white transition-colors hover:bg-signal-deep disabled:opacity-60"
            >
              {pending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
              Create and attach
            </button>
          </>
        )}

        <FormError error={error} />
      </Modal>
    </>
  );
}
