"use client";

import { useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ExternalLink, X, Loader2 } from "lucide-react";
import { detachBoard } from "@/app/app/tactics/actions";
import { BoardPlayer } from "./board-player";
import type { AttachedBoard } from "@/lib/data/boards";
import type { BoardEntityType } from "@/lib/tactics/links";

/*
  Boards shown on the thing they are attached to.

  Read-only by design: a drill's board is expanded in place, and editing
  it means opening the board itself. That keeps a session page from
  loading an editor per block — six drills would otherwise mount six
  editing surfaces, which is precisely the weight §23 warns about.

  A snapshot link says so plainly. "This session shows the board as it
  was" is the honest answer to why a delivered session does not reflect
  a later edit; leaving it unexplained makes it look like a bug.
*/

export function AttachedBoards({
  attached,
  entityType,
  entityId,
  revalidate,
  editable = true,
}: {
  attached: AttachedBoard[];
  entityType: BoardEntityType;
  entityId: string;
  revalidate?: string;
  editable?: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  if (!attached.length) return null;

  const remove = (boardId: string) => {
    start(async () => {
      await detachBoard(boardId, entityType, entityId, revalidate);
      router.refresh();
    });
  };

  return (
    <div className="space-y-3">
      {attached.map(({ link, board, doc }) => (
        <div key={link.id} className="panel overflow-hidden">
          <div className="flex flex-wrap items-center gap-2 border-b border-line px-3 py-2">
            <span className="label-tech">{board.formation}</span>
            <span className="min-w-0 flex-1 truncate text-sm text-text-hi">{board.title}</span>

            {link.mode === "snapshot" && (
              <span className="chip" title="Frozen when this was delivered, so the record stays accurate">
                as delivered
              </span>
            )}

            <Link
              href={`/app/tactics/${board.id}`}
              className="grid size-7 place-items-center rounded-md border border-line text-text-dim transition-colors hover:border-signal-line hover:text-signal-bright"
              aria-label={`Open ${board.title}`}
              title="Open the board"
            >
              <ExternalLink className="size-3" />
            </Link>

            {editable && (
              <button
                type="button"
                onClick={() => remove(board.id)}
                disabled={pending}
                aria-label={`Remove ${board.title}`}
                title="Remove from here. The board itself is kept."
                className="grid size-7 place-items-center rounded-md border border-line text-text-faint transition-colors hover:text-correction disabled:opacity-50"
              >
                {pending ? <Loader2 className="size-3 animate-spin" /> : <X className="size-3" />}
              </button>
            )}
          </div>

          <div className="bg-ink-950 p-3">
            <div className="mx-auto max-w-[340px]">
              <BoardPlayer doc={doc} title={board.title} />
            </div>
          </div>

          {(board.doc.objective || board.notes) && (
            <p className="border-t border-line px-3 py-2 text-xs leading-relaxed text-text-dim">
              {board.doc.objective || board.notes}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}
