"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { X, Loader2, Check, Plus, Pencil } from "lucide-react";
import { createMatch, updateMatch } from "@/app/app/matches/actions";
import type { MatchInput } from "@/lib/data/match-types";
import type { Match } from "@/lib/types";

const POSITIONS = ["GK","RB","RCB","LCB","LB","RWB","LWB","6","8","10","RW","LW","CF","ST"];

function toLocalInput(iso: string) {
  // "2026-08-09T15:00:00" → "2026-08-09T15:00"
  return iso ? iso.slice(0, 16) : "";
}

function fromMatch(m: Match): MatchInput {
  return {
    opponent: m.opponent,
    competition: m.competition,
    playedAt: toLocalInput(m.date),
    home: m.home,
    goalsFor: m.goalsFor,
    goalsAgainst: m.goalsAgainst,
    formation: m.formation,
    position: m.position,
    started: m.started,
    minutes: m.minutes,
    rating: m.rating || null,
    goals: m.goals,
    assists: m.assists,
  };
}

function emptyInput(): MatchInput {
  return {
    opponent: "",
    competition: "",
    playedAt: "",
    home: true,
    goalsFor: null,
    goalsAgainst: null,
    formation: "4-3-3",
    position: "CF",
    started: true,
    minutes: null,
    rating: null,
    goals: 0,
    assists: 0,
  };
}

export function MatchFormDialog({
  mode,
  match,
  variant = "primary",
}: {
  mode: "create" | "edit";
  match?: Match;
  variant?: "primary" | "ghost";
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<MatchInput>(
    mode === "edit" && match ? fromMatch(match) : emptyInput()
  );

  const set = (patch: Partial<MatchInput>) => setForm((f) => ({ ...f, ...patch }));
  const num = (v: string): number | null => (v === "" ? null : Number(v));

  const submit = async () => {
    setBusy(true);
    setError(null);
    const res =
      mode === "create"
        ? await createMatch(form)
        : await updateMatch(match!.id, form);
    if (res.ok) {
      setOpen(false);
      setBusy(false);
      if (mode === "create" && res.id) router.push(`/app/matches/${res.id}`);
      else router.refresh();
    } else {
      setError(res.error);
      setBusy(false);
    }
  };

  return (
    <>
      {mode === "create" ? (
        <button
          onClick={() => setOpen(true)}
          className="flex h-9 items-center gap-2 rounded-lg bg-signal px-3.5 text-sm font-medium text-white transition-colors hover:bg-signal-deep"
        >
          <Plus className="size-4" /> Add match
        </button>
      ) : (
        <button
          onClick={() => setOpen(true)}
          className={
            variant === "ghost"
              ? "flex h-9 items-center gap-2 rounded-lg border border-line px-3 text-sm text-text transition-colors hover:border-signal-line hover:text-signal-bright"
              : "flex h-9 items-center gap-2 rounded-lg bg-signal/10 px-3 text-sm text-signal-bright transition-colors hover:bg-signal/20"
          }
        >
          <Pencil className="size-3.5" /> Edit
        </button>
      )}

      <AnimatePresence>
        {open && (
          <motion.div
            className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 py-[8vh]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
          >
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setOpen(false)} />
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-label={mode === "create" ? "Add match" : "Edit match"}
              className="panel-raised relative w-full max-w-lg p-5 shadow-2xl shadow-black/50"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 12 }}
              transition={{ duration: 0.18, ease: [0.2, 0.8, 0.2, 1] }}
            >
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <div className="label-tech">{mode === "create" ? "New match" : "Edit match"}</div>
                  <h3 className="font-display text-lg font-semibold text-text-hi">Match details</h3>
                </div>
                <button onClick={() => setOpen(false)} className="text-text-faint hover:text-text" aria-label="Close">
                  <X className="size-5" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Opponent" span>
                  <input value={form.opponent} onChange={(e) => set({ opponent: e.target.value })} className={inputCls} placeholder="e.g. Riverside Athletic" />
                </Field>
                <Field label="Competition" span>
                  <input value={form.competition ?? ""} onChange={(e) => set({ competition: e.target.value })} className={inputCls} placeholder="League · Round 1" />
                </Field>
                <Field label="Date & kickoff">
                  <input type="datetime-local" value={form.playedAt} onChange={(e) => set({ playedAt: e.target.value })} className={inputCls} />
                </Field>
                <Field label="Venue">
                  <Toggle value={form.home} onChange={(v) => set({ home: v })} left="Home" right="Away" />
                </Field>
                <Field label="Goals for">
                  <input type="number" value={form.goalsFor ?? ""} onChange={(e) => set({ goalsFor: num(e.target.value) })} className={inputCls} />
                </Field>
                <Field label="Goals against">
                  <input type="number" value={form.goalsAgainst ?? ""} onChange={(e) => set({ goalsAgainst: num(e.target.value) })} className={inputCls} />
                </Field>
                <Field label="Role">
                  <Toggle value={form.started} onChange={(v) => set({ started: v })} left="Start" right="Sub" />
                </Field>
                <Field label="Position">
                  <select value={form.position ?? ""} onChange={(e) => set({ position: e.target.value })} className={inputCls}>
                    {POSITIONS.map((p) => <option key={p} value={p}>{p}</option>)}
                  </select>
                </Field>
                <Field label="Minutes">
                  <input type="number" value={form.minutes ?? ""} onChange={(e) => set({ minutes: num(e.target.value) })} className={inputCls} />
                </Field>
                <Field label="Formation">
                  <input value={form.formation ?? ""} onChange={(e) => set({ formation: e.target.value })} className={inputCls} placeholder="4-3-3" />
                </Field>
                <Field label="Goals">
                  <input type="number" value={form.goals} onChange={(e) => set({ goals: Number(e.target.value) || 0 })} className={inputCls} />
                </Field>
                <Field label="Assists">
                  <input type="number" value={form.assists} onChange={(e) => set({ assists: Number(e.target.value) || 0 })} className={inputCls} />
                </Field>
                <Field label="Rating (0–10)" span>
                  <input type="number" step="0.1" min="0" max="10" value={form.rating ?? ""} onChange={(e) => set({ rating: num(e.target.value) })} className={inputCls} placeholder="e.g. 7.5" />
                </Field>
              </div>

              {error && (
                <p className="mt-3 rounded-lg border border-correction/30 bg-correction/10 px-3 py-2 text-sm text-correction">
                  {error}
                </p>
              )}

              <div className="mt-5 flex items-center gap-3">
                <button onClick={() => setOpen(false)} className="h-11 rounded-lg border border-line px-4 text-sm text-text-dim transition-colors hover:text-text-hi">
                  Cancel
                </button>
                <button
                  onClick={submit}
                  disabled={busy || !form.opponent.trim() || !form.playedAt}
                  className="flex h-11 flex-1 items-center justify-center gap-2 rounded-lg bg-signal font-medium text-white transition-colors hover:bg-signal-deep disabled:opacity-50"
                >
                  {busy ? <Loader2 className="size-4 animate-spin" /> : <><Check className="size-4" /> {mode === "create" ? "Create match" : "Save changes"}</>}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

const inputCls =
  "h-10 w-full rounded-lg border border-line bg-ink-850 px-3 text-sm text-text-hi placeholder:text-text-faint focus:border-signal-line focus:outline-none";

function Field({ label, span, children }: { label: string; span?: boolean; children: React.ReactNode }) {
  return (
    <label className={span ? "col-span-2" : ""}>
      <span className="label-tech mb-1 block">{label}</span>
      {children}
    </label>
  );
}

function Toggle({ value, onChange, left, right }: { value: boolean; onChange: (v: boolean) => void; left: string; right: string }) {
  return (
    <div className="flex h-10 rounded-lg border border-line bg-ink-850 p-1">
      <button
        onClick={() => onChange(true)}
        className={`flex-1 rounded-md text-sm transition-colors ${value ? "bg-signal/15 text-signal-bright" : "text-text-dim"}`}
      >
        {left}
      </button>
      <button
        onClick={() => onChange(false)}
        className={`flex-1 rounded-md text-sm transition-colors ${!value ? "bg-signal/15 text-signal-bright" : "text-text-dim"}`}
      >
        {right}
      </button>
    </div>
  );
}
