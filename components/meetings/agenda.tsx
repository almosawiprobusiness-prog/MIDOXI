"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronDown,
  ChevronUp,
  Clapperboard,
  Check,
  GraduationCap,
  Loader2,
  Plus,
  StickyNote,
  Target,
  Trash2,
  Video,
} from "lucide-react";
import {
  addAgendaItem,
  deleteAgendaItem,
  moveAgendaItem,
  setAgendaDone,
} from "@/app/app/meetings/actions";
import { AGENDA_TITLE_MAX, type AgendaItem, type AgendaKind } from "@/lib/data/meeting-types";
import { cn } from "@/lib/utils";

/*
  The shared agenda.

  Both people add to it, both reorder it, and both tick things off —
  including each other's items. An agenda where only the author can move
  their own lines is two lists in a trench coat. The one thing held to
  the author is deleting, because removing somebody's point is a
  different act from reordering it.

  Reordering is up/down rather than drag. Drag is nicer with a mouse and
  unusable with a keyboard, hopeless on a phone, and this list is read
  on a phone in a car park more often than anywhere else. Each move
  writes one row — the midpoint between its new neighbours — so two
  people reordering at once do not renumber the list out from under each
  other.
*/

const ICONS: Record<AgendaKind, typeof StickyNote> = {
  note: StickyNote,
  clip: Clapperboard,
  study: GraduationCap,
  goal: Target,
  video: Video,
};

function timecode(s: number): string {
  const m = Math.floor(s / 60);
  const r = Math.floor(s % 60);
  return `${m}:${String(r).padStart(2, "0")}`;
}

export function Agenda({ meetingId, items }: { meetingId: string; items: AgendaItem[] }) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  // Which row is mid-request, so only that one shows a spinner.
  const [busy, setBusy] = useState<string | null>(null);

  const run = (id: string | null, fn: () => Promise<{ ok: boolean; error?: string }>) =>
    startTransition(async () => {
      setBusy(id);
      setError(null);
      const res = await fn();
      if (!res.ok && res.error) setError(res.error);
      setBusy(null);
      router.refresh();
    });

  const add = () => {
    const t = title.trim();
    if (!t) return;
    run(null, async () => {
      const res = await addAgendaItem(meetingId, { kind: "note", title: t });
      if (res.ok) {
        setTitle("");
        setAdding(false);
      }
      return res;
    });
  };

  /*
    Move by one place. The neighbours at the destination are what the
    server needs — the row lands between them — so this reads two
    positions out of the list rather than sending an index.
  */
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= items.length) return;
    const target = items[j];
    const beyond = items[j + dir];
    const [before, after] =
      dir === 1
        ? [target.position, beyond?.position ?? null]
        : [beyond?.position ?? null, target.position];
    run(items[i].id, () => moveAgendaItem(items[i].id, meetingId, before, after));
  };

  return (
    <section className="mt-6">
      <div className="mb-3 flex items-center justify-between gap-2 border-b border-line pb-2">
        <span className="label-tech">Agenda</span>
        <span className="data-mono text-[10px] text-text-faint">
          {items.filter((i) => i.done).length}/{items.length}
        </span>
      </div>

      {items.length === 0 && !adding && (
        <p className="py-6 text-center text-sm text-text-dim">
          Nothing on the agenda yet. Add what you want to get through — either of you can.
        </p>
      )}

      <ul className="space-y-1.5">
        {items.map((item, i) => {
          const Icon = ICONS[item.kind];
          const working = busy === item.id && pending;
          return (
            <li
              key={item.id}
              className={cn(
                "panel flex items-start gap-3 px-3 py-2.5",
                item.done && "opacity-55",
              )}
            >
              <button
                onClick={() => run(item.id, () => setAgendaDone(item.id, meetingId, !item.done))}
                aria-label={item.done ? "Mark not done" : "Mark done"}
                className={cn(
                  "mt-0.5 grid size-5 shrink-0 place-items-center rounded border transition-colors",
                  item.done
                    ? "border-positive bg-positive/20 text-positive"
                    : "border-line text-transparent hover:border-signal-line",
                )}
              >
                {working ? <Loader2 className="size-3 animate-spin text-text-dim" /> : <Check className="size-3.5" />}
              </button>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Icon className="size-3.5 shrink-0 text-text-faint" />
                  <p className={cn("min-w-0 text-sm text-text-hi", item.done && "line-through decoration-text-faint")}>
                    {item.title}
                  </p>
                  {item.atSeconds !== null && (
                    <span className="data-mono rounded border border-line px-1.5 py-0.5 text-[10px] text-text-dim">
                      {timecode(item.atSeconds)}
                    </span>
                  )}
                </div>
                {item.body && <p className="mt-1 text-xs leading-relaxed text-text-dim">{item.body}</p>}
              </div>

              <div className="flex shrink-0 items-center gap-0.5">
                <IconBtn label="Move up" disabled={i === 0} onClick={() => move(i, -1)}>
                  <ChevronUp className="size-4" />
                </IconBtn>
                <IconBtn label="Move down" disabled={i === items.length - 1} onClick={() => move(i, 1)}>
                  <ChevronDown className="size-4" />
                </IconBtn>
                {item.mine && (
                  <IconBtn label="Remove" onClick={() => run(item.id, () => deleteAgendaItem(item.id, meetingId))}>
                    <Trash2 className="size-4" />
                  </IconBtn>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      {adding ? (
        <div className="mt-2 flex gap-2">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") add();
              if (e.key === "Escape") setAdding(false);
            }}
            maxLength={AGENDA_TITLE_MAX}
            autoFocus
            placeholder="What do you want to cover?"
            className="h-9 flex-1 rounded-lg border border-line bg-ink-850 px-3 text-sm text-text-hi placeholder:text-text-faint focus:border-signal-line focus:outline-none"
          />
          <button
            onClick={add}
            disabled={pending || !title.trim()}
            className="h-9 rounded-lg border border-signal-line bg-signal/10 px-3 text-sm text-signal-bright disabled:opacity-50"
          >
            Add
          </button>
        </div>
      ) : (
        <button
          onClick={() => setAdding(true)}
          className="mt-2 flex h-9 w-full items-center justify-center gap-2 rounded-lg border border-dashed border-line text-sm text-text-dim transition-colors hover:border-signal-line hover:text-signal-bright"
        >
          <Plus className="size-4" />
          Add an item
        </button>
      )}

      {error && <p className="mt-2 text-xs text-correction">{error}</p>}
    </section>
  );
}

function IconBtn({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="grid size-7 place-items-center rounded text-text-faint transition-colors hover:text-text disabled:opacity-25"
    >
      {children}
    </button>
  );
}
