"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { X, Loader2, Check, Plus, Pencil } from "lucide-react";
import { createGoal, updateGoal } from "@/app/app/development/actions";
import { CATEGORIES, STATUSES, type GoalInput } from "@/lib/data/development-types";
import type { DevelopmentGoal } from "@/lib/types";
import { categoryStyle } from "@/components/ui/primitives";

function fromGoal(g: DevelopmentGoal): GoalInput {
  return { category: g.category, title: g.title, why: g.why, status: g.status, progress: g.progress };
}

export function GoalFormDialog({ mode, goal }: { mode: "create" | "edit"; goal?: DevelopmentGoal }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<GoalInput>(
    mode === "edit" && goal ? fromGoal(goal) : { category: "technical", title: "", why: "", status: "active", progress: 20 }
  );

  const set = (patch: Partial<GoalInput>) => setForm((f) => ({ ...f, ...patch }));

  const submit = async () => {
    setBusy(true);
    setError(null);
    const res = mode === "create" ? await createGoal(form) : await updateGoal(goal!.id, form);
    if (res.ok) {
      setOpen(false);
      setBusy(false);
      if (mode === "create" && res.id) router.push(`/app/development/${res.id}`);
      else router.refresh();
    } else {
      setError(res.error);
      setBusy(false);
    }
  };

  return (
    <>
      {mode === "create" ? (
        <button onClick={() => setOpen(true)} className="flex h-9 items-center gap-2 rounded-lg bg-signal px-3.5 text-sm font-medium text-white transition-colors hover:bg-signal-deep">
          <Plus className="size-4" /> New goal
        </button>
      ) : (
        <button onClick={() => setOpen(true)} className="flex h-9 items-center gap-2 rounded-lg bg-signal/10 px-3 text-sm text-signal-bright transition-colors hover:bg-signal/20">
          <Pencil className="size-3.5" /> Edit
        </button>
      )}

      <AnimatePresence>
        {open && (
          <motion.div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 py-[10vh]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setOpen(false)} />
            <motion.div role="dialog" aria-modal="true" aria-label={mode === "create" ? "New goal" : "Edit goal"} className="panel-raised relative w-full max-w-md p-5 shadow-2xl shadow-black/50" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 12 }} transition={{ duration: 0.18, ease: [0.2, 0.8, 0.2, 1] }}>
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <div className="label-tech">{mode === "create" ? "New development goal" : "Edit goal"}</div>
                  <h3 className="font-display text-lg font-semibold text-text-hi">What are you working on?</h3>
                </div>
                <button onClick={() => setOpen(false)} className="text-text-faint hover:text-text" aria-label="Close"><X className="size-5" /></button>
              </div>

              <div className="space-y-3">
                <label className="block">
                  <span className="label-tech mb-1 block">Category</span>
                  <div className="flex flex-wrap gap-1.5">
                    {CATEGORIES.map((c) => {
                      const active = form.category === c;
                      const s = categoryStyle[c];
                      return (
                        <button key={c} onClick={() => set({ category: c })} className="rounded-lg border px-2.5 py-1.5 text-xs capitalize transition-colors" style={active ? { borderColor: s.color, color: s.color, background: "var(--signal-wash)" } : { borderColor: "var(--line-strong)", color: "var(--text-dim)" }}>
                          {s.label}
                        </button>
                      );
                    })}
                  </div>
                </label>

                <label className="block">
                  <span className="label-tech mb-1 block">Goal</span>
                  <input value={form.title} onChange={(e) => set({ title: e.target.value })} placeholder="e.g. Near-post finishing" className={inputCls} />
                </label>

                <label className="block">
                  <span className="label-tech mb-1 block">Why does this matter?</span>
                  <textarea value={form.why ?? ""} onChange={(e) => set({ why: e.target.value })} rows={2} placeholder="What are you seeing that you want to change?" className={`${inputCls} h-auto resize-y py-2`} />
                </label>

                <div className="grid grid-cols-2 gap-3">
                  <label className="block">
                    <span className="label-tech mb-1 block">Status</span>
                    <select value={form.status} onChange={(e) => set({ status: e.target.value as GoalInput["status"] })} className={inputCls}>
                      {STATUSES.map((s) => <option key={s} value={s} className="capitalize">{s}</option>)}
                    </select>
                  </label>
                  <label className="block">
                    <span className="label-tech mb-1 flex items-center justify-between">
                      <span>Progress</span>
                      <span className="data-mono text-signal-bright">{form.progress}%</span>
                    </span>
                    <input type="range" min={0} max={100} step={2} value={form.progress} onChange={(e) => set({ progress: Number(e.target.value) })} className="mido-range mt-2.5 w-full" />
                  </label>
                </div>
              </div>

              {error && <p className="mt-3 rounded-lg border border-correction/30 bg-correction/10 px-3 py-2 text-sm text-correction">{error}</p>}

              <div className="mt-5 flex items-center gap-3">
                <button onClick={() => setOpen(false)} className="h-11 rounded-lg border border-line px-4 text-sm text-text-dim transition-colors hover:text-text-hi">Cancel</button>
                <button onClick={submit} disabled={busy || !form.title.trim()} className="flex h-11 flex-1 items-center justify-center gap-2 rounded-lg bg-signal font-medium text-white transition-colors hover:bg-signal-deep disabled:opacity-50">
                  {busy ? <Loader2 className="size-4 animate-spin" /> : <><Check className="size-4" /> {mode === "create" ? "Create goal" : "Save changes"}</>}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

const inputCls = "h-10 w-full rounded-lg border border-line bg-ink-850 px-3 text-sm text-text-hi placeholder:text-text-faint focus:border-signal-line focus:outline-none";
