"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { X, Loader2, Check, Plus, Pencil } from "lucide-react";
import { createTraining, updateTraining } from "@/app/app/training/actions";
import { TRAINING_KINDS, type TrainingInput, type TrainingEntry } from "@/lib/data/training-types";

function empty(): TrainingInput {
  return { kind: "individual", title: "", scheduledAt: "", durationMin: 60, objective: "", rpe: null, physicalFeel: null, technicalFeel: null, improved: "", feltOff: "" };
}

function fromEntry(e: TrainingEntry): TrainingInput {
  return {
    kind: e.kind,
    title: e.title,
    scheduledAt: e.scheduledAt.slice(0, 16),
    durationMin: e.durationMin,
    objective: e.objective,
    rpe: e.rpe,
    physicalFeel: e.physicalFeel,
    technicalFeel: e.technicalFeel,
    improved: e.improved,
    feltOff: e.feltOff,
  };
}

export function TrainingFormDialog({ mode, entry }: { mode: "create" | "edit"; entry?: TrainingEntry }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<TrainingInput>(mode === "edit" && entry ? fromEntry(entry) : empty());

  const set = (patch: Partial<TrainingInput>) => setForm((f) => ({ ...f, ...patch }));
  const numN = (v: string): number | null => (v === "" ? null : Number(v));

  const submit = async () => {
    setBusy(true);
    setError(null);
    const res = mode === "create" ? await createTraining(form) : await updateTraining(entry!.id, form);
    if (res.ok) {
      setOpen(false);
      setBusy(false);
      router.refresh();
    } else {
      setError(res.error);
      setBusy(false);
    }
  };

  return (
    <>
      {mode === "create" ? (
        <button onClick={() => setOpen(true)} className="flex h-9 items-center gap-2 rounded-lg bg-signal px-3.5 text-sm font-medium text-white transition-colors hover:bg-signal-deep">
          <Plus className="size-4" /> Log training
        </button>
      ) : (
        <button onClick={() => setOpen(true)} aria-label="Edit session" className="flex size-8 items-center justify-center rounded-lg border border-line text-text-dim transition-colors hover:border-signal-line hover:text-signal-bright">
          <Pencil className="size-3.5" />
        </button>
      )}

      <AnimatePresence>
        {open && (
          <motion.div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 py-[7vh]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setOpen(false)} />
            <motion.div role="dialog" aria-modal="true" aria-label={mode === "create" ? "Log training" : "Edit session"} className="panel-raised relative w-full max-w-lg p-5 shadow-2xl shadow-black/50" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 12 }} transition={{ duration: 0.18, ease: [0.2, 0.8, 0.2, 1] }}>
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <div className="label-tech">{mode === "create" ? "New session" : "Edit session"}</div>
                  <h3 className="font-display text-lg font-semibold text-text-hi">Training</h3>
                </div>
                <button onClick={() => setOpen(false)} className="text-text-faint hover:text-text" aria-label="Close"><X className="size-5" /></button>
              </div>

              {/* Type */}
              <div className="mb-3 flex flex-wrap gap-1.5">
                {TRAINING_KINDS.map((k) => {
                  const active = form.kind === k.kind;
                  return (
                    <button key={k.kind} onClick={() => set({ kind: k.kind })} className="rounded-lg border px-2.5 py-1.5 text-xs transition-colors" style={active ? { borderColor: k.color, color: k.color, background: "var(--signal-wash)" } : { borderColor: "var(--line-strong)", color: "var(--text-dim)" }}>
                      {k.label}
                    </button>
                  );
                })}
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <F label="Title" span><input value={form.title} onChange={(e) => set({ title: e.target.value })} className={inp} placeholder="e.g. Finishing · Individual" /></F>
                <F label="Date & time"><input type="datetime-local" value={form.scheduledAt} onChange={(e) => set({ scheduledAt: e.target.value })} className={inp} /></F>
                <F label="Duration (min)"><input type="number" value={form.durationMin ?? ""} onChange={(e) => set({ durationMin: numN(e.target.value) })} className={inp} /></F>
                <F label="Objective" span><input value={form.objective ?? ""} onChange={(e) => set({ objective: e.target.value })} className={inp} placeholder="What was the focus?" /></F>
              </div>

              {/* Post-session log */}
              <div className="mt-4 border-t border-line pt-4">
                <div className="label-tech mb-3">After the session</div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <Slider label="RPE" max={10} value={form.rpe} onChange={(v) => set({ rpe: v })} />
                  <Slider label="Physical" max={5} value={form.physicalFeel} onChange={(v) => set({ physicalFeel: v })} />
                  <Slider label="Technical" max={5} value={form.technicalFeel} onChange={(v) => set({ technicalFeel: v })} />
                </div>
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <F label="What improved?"><textarea value={form.improved ?? ""} onChange={(e) => set({ improved: e.target.value })} rows={2} className={`${inp} h-auto resize-y py-2`} /></F>
                  <F label="Anything off?"><textarea value={form.feltOff ?? ""} onChange={(e) => set({ feltOff: e.target.value })} rows={2} className={`${inp} h-auto resize-y py-2`} /></F>
                </div>
              </div>

              {error && <p className="mt-3 rounded-lg border border-correction/30 bg-correction/10 px-3 py-2 text-sm text-correction">{error}</p>}

              <div className="mt-5 flex items-center gap-3">
                <button onClick={() => setOpen(false)} className="h-11 rounded-lg border border-line px-4 text-sm text-text-dim transition-colors hover:text-text-hi">Cancel</button>
                <button onClick={submit} disabled={busy || !form.title.trim() || !form.scheduledAt} className="flex h-11 flex-1 items-center justify-center gap-2 rounded-lg bg-signal font-medium text-white transition-colors hover:bg-signal-deep disabled:opacity-50">
                  {busy ? <Loader2 className="size-4 animate-spin" /> : <><Check className="size-4" /> {mode === "create" ? "Save session" : "Save changes"}</>}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

const inp = "h-10 w-full rounded-lg border border-line bg-ink-850 px-3 text-sm text-text-hi placeholder:text-text-faint focus:border-signal-line focus:outline-none";

function F({ label, span, children }: { label: string; span?: boolean; children: React.ReactNode }) {
  return (
    <label className={span ? "col-span-2" : ""}>
      <span className="label-tech mb-1 block">{label}</span>
      {children}
    </label>
  );
}

function Slider({ label, max, value, onChange }: { label: string; max: number; value: number | null | undefined; onChange: (v: number) => void }) {
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between">
        <span className="label-tech">{label}</span>
        <span className="data-mono text-sm text-signal-bright">{value ?? "—"}<span className="text-text-faint">/{max}</span></span>
      </div>
      <input type="range" min={1} max={max} value={value ?? Math.round(max / 2)} onChange={(e) => onChange(Number(e.target.value))} className="mido-range w-full" aria-label={label} />
    </div>
  );
}
