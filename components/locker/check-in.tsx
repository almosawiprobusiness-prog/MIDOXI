"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Check, HeartPulse, X, Loader2 } from "lucide-react";
import { saveCheckin } from "@/app/app/actions";
import { isDemoMode } from "@/lib/env";

const FIELDS = [
  { key: "energy", label: "Energy", low: "Flat", high: "Firing" },
  { key: "sleep", label: "Sleep", low: "Poor", high: "Deep" },
  { key: "soreness", label: "Soreness", low: "Fresh", high: "Heavy" },
  { key: "mental", label: "Mental", low: "Foggy", high: "Sharp" },
] as const;

type Key = (typeof FIELDS)[number]["key"];

export function CheckIn({ done }: { done: boolean }) {
  const [open, setOpen] = useState(false);
  const [saved, setSaved] = useState(done);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDemo, setIsDemo] = useState(isDemoMode);
  const [values, setValues] = useState<Record<Key, number>>({
    energy: 4,
    sleep: 5,
    soreness: 2,
    mental: 5,
  });

  const submit = async () => {
    setBusy(true);
    setError(null);
    const res = await saveCheckin(values);
    setBusy(false);
    if (res.ok) {
      setIsDemo(Boolean(res.demo));
      setSaved(true);
      setOpen(false);
    } else {
      setError(res.error);
    }
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex w-full items-center gap-3 rounded-lg border border-line bg-ink-850 px-4 py-3 text-left transition-colors hover:border-signal-line hover:bg-signal/5"
      >
        <span className="grid size-9 place-items-center rounded-md bg-signal/10 text-signal-bright">
          <HeartPulse className="size-[18px]" />
        </span>
        <span className="flex-1">
          <span className="block text-sm font-medium text-text-hi">
            Daily check-in
          </span>
          <span className="block text-xs text-text-dim">
            {saved ? "Logged today · tap to update" : "~15 seconds"}
          </span>
        </span>
        {saved && (
          <span className="flex size-5 items-center justify-center rounded-full bg-positive/15 text-positive">
            <Check className="size-3.5" />
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
          >
            <div
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setOpen(false)}
            />
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-label="Daily check-in"
              className="panel-raised relative w-full max-w-sm p-5 shadow-2xl shadow-black/50"
              initial={{ opacity: 0, y: 10, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.98 }}
              transition={{ duration: 0.18, ease: [0.2, 0.8, 0.2, 1] }}
            >
              <div className="mb-5 flex items-start justify-between">
                <div>
                  <div className="label-tech">Readiness</div>
                  <h3 className="font-display text-lg font-semibold text-text-hi">
                    How do you feel?
                  </h3>
                </div>
                <button
                  onClick={() => setOpen(false)}
                  className="text-text-faint transition-colors hover:text-text"
                  aria-label="Close"
                >
                  <X className="size-5" />
                </button>
              </div>

              <div className="space-y-4">
                {FIELDS.map((f) => (
                  <div key={f.key}>
                    <div className="mb-1.5 flex items-baseline justify-between">
                      <span className="text-sm text-text-hi">{f.label}</span>
                      <span className="data-mono text-sm text-signal-bright">
                        {values[f.key]}
                        <span className="text-text-faint">/5</span>
                      </span>
                    </div>
                    <input
                      type="range"
                      min={1}
                      max={5}
                      value={values[f.key]}
                      onChange={(e) =>
                        setValues((v) => ({ ...v, [f.key]: Number(e.target.value) }))
                      }
                      className="mido-range w-full"
                      aria-label={f.label}
                    />
                    <div className="mt-1 flex justify-between text-[10px] text-text-faint">
                      <span>{f.low}</span>
                      <span>{f.high}</span>
                    </div>
                  </div>
                ))}
              </div>

              {error && (
                <p className="mt-4 rounded-lg border border-correction/30 bg-correction/10 px-3 py-2 text-sm text-correction">
                  {error}
                </p>
              )}

              <button
                onClick={submit}
                disabled={busy}
                className="mt-6 flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-signal font-medium text-white transition-colors hover:bg-signal-deep disabled:opacity-60"
              >
                {busy ? <Loader2 className="size-4 animate-spin" /> : <><Check className="size-4" /> Log check-in</>}
              </button>
              <p className="mt-2 text-center text-[11px] text-text-faint">
                {isDemo ? "Demo — won't be saved yet" : "Saves to your football record"}
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
