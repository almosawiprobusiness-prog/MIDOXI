"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { X, Loader2, Check, Trash2 } from "lucide-react";
import { createEvent, updateEvent, deleteEvent } from "@/app/app/calendar/actions";
import { CALENDAR_KINDS, type CalendarInput, type CalendarEvent } from "@/lib/data/calendar-types";

const MD_TAGS = ["", "MD", "MD-1", "MD-2", "MD-3", "MD-4", "MD-5", "MD+1", "MD+2"];

function initialForm(mode: "create" | "edit", event?: CalendarEvent, presetDate?: string): CalendarInput {
  if (mode === "edit" && event) {
    return { kind: event.kind, title: event.title, startsAt: event.startsAt.slice(0, 16), endsAt: event.endsAt ?? null, mdTag: event.mdTag ?? "" };
  }
  return { kind: "team", title: "", startsAt: presetDate ?? "", endsAt: null, mdTag: "" };
}

export function EventFormDialog({
  open,
  onClose,
  mode,
  event,
  presetDate,
}: {
  open: boolean;
  onClose: () => void;
  mode: "create" | "edit";
  event?: CalendarEvent;
  presetDate?: string;
}) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 py-[10vh]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
          <EventFormBody onClose={onClose} mode={mode} event={event} presetDate={presetDate} />
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function EventFormBody({
  onClose,
  mode,
  event,
  presetDate,
}: {
  onClose: () => void;
  mode: "create" | "edit";
  event?: CalendarEvent;
  presetDate?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<CalendarInput>(() => initialForm(mode, event, presetDate));

  const set = (patch: Partial<CalendarInput>) => setForm((f) => ({ ...f, ...patch }));

  const submit = async () => {
    setBusy(true);
    setError(null);
    const res = mode === "create" ? await createEvent(form) : await updateEvent(event!.id, form);
    if (res.ok) {
      onClose();
      router.refresh();
    } else {
      setError(res.error);
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!event) return;
    setBusy(true);
    const res = await deleteEvent(event.id);
    if (res.ok) {
      onClose();
      router.refresh();
    } else setBusy(false);
  };

  return (
    <motion.div role="dialog" aria-modal="true" aria-label={mode === "create" ? "Add event" : "Edit event"} className="panel-raised relative w-full max-w-md p-5 shadow-2xl shadow-black/50" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 12 }} transition={{ duration: 0.18, ease: [0.2, 0.8, 0.2, 1] }}>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <div className="label-tech">{mode === "create" ? "New event" : "Edit event"}</div>
          <h3 className="font-display text-lg font-semibold text-text-hi">Calendar</h3>
        </div>
        <button onClick={onClose} className="text-text-faint hover:text-text" aria-label="Close"><X className="size-5" /></button>
      </div>

      <div className="mb-3 flex flex-wrap gap-1.5">
        {CALENDAR_KINDS.map((k) => {
          const active = form.kind === k.kind;
          return (
            <button key={k.kind} onClick={() => set({ kind: k.kind })} className="rounded-lg border px-2.5 py-1.5 text-xs transition-colors" style={active ? { borderColor: k.color, color: k.color, background: "var(--signal-wash)" } : { borderColor: "var(--line-strong)", color: "var(--text-dim)" }}>
              {k.label}
            </button>
          );
        })}
      </div>

      <div className="space-y-3">
        <label className="block">
          <span className="label-tech mb-1 block">Title</span>
          <input value={form.title} onChange={(e) => set({ title: e.target.value })} className={inp} placeholder="e.g. Team Training" />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="label-tech mb-1 block">Date & time</span>
            <input type="datetime-local" value={form.startsAt} onChange={(e) => set({ startsAt: e.target.value })} className={inp} />
          </label>
          <label className="block">
            <span className="label-tech mb-1 block">Matchday tag</span>
            <select value={form.mdTag ?? ""} onChange={(e) => set({ mdTag: e.target.value })} className={inp}>
              {MD_TAGS.map((t) => <option key={t} value={t}>{t || "None"}</option>)}
            </select>
          </label>
        </div>
      </div>

      {error && <p className="mt-3 rounded-lg border border-correction/30 bg-correction/10 px-3 py-2 text-sm text-correction">{error}</p>}

      <div className="mt-5 flex items-center gap-3">
        {mode === "edit" && (
          <button onClick={remove} disabled={busy} aria-label="Delete event" className="flex size-11 items-center justify-center rounded-lg border border-line text-text-dim transition-colors hover:border-correction/40 hover:text-correction disabled:opacity-60">
            <Trash2 className="size-4" />
          </button>
        )}
        <button onClick={onClose} className="h-11 rounded-lg border border-line px-4 text-sm text-text-dim transition-colors hover:text-text-hi">Cancel</button>
        <button onClick={submit} disabled={busy || !form.title.trim() || !form.startsAt} className="flex h-11 flex-1 items-center justify-center gap-2 rounded-lg bg-signal font-medium text-white transition-colors hover:bg-signal-deep disabled:opacity-50">
          {busy ? <Loader2 className="size-4 animate-spin" /> : <><Check className="size-4" /> {mode === "create" ? "Add event" : "Save"}</>}
        </button>
      </div>
    </motion.div>
  );
}

const inp = "h-10 w-full rounded-lg border border-line bg-ink-850 px-3 text-sm text-text-hi placeholder:text-text-faint focus:border-signal-line focus:outline-none";
