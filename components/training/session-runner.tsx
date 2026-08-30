"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ChevronLeft, Check, Play, X } from "lucide-react";
import { trainingMeta } from "@/lib/data/training-types";
import type { TrainingEntry } from "@/lib/data/training-types";
import { TrainingFormDialog } from "./training-form-dialog";

/*
  SESSION EXECUTION MODE — the plan, one block at a time, readable from
  two metres with a ball under one arm.

  A generated session is a document until the player is standing on the
  pitch, at which point it must become a card: current block, the work,
  the cue, a clock, and two thumb-sized controls. Everything here is
  client state — once the page loaded, running the session needs no
  network at all, because pitches have terrible signal and a timer that
  buffers is worse than a watch.

  The timer counts UP. The plan's "10 minutes" is a prescription, not a
  countdown — a drill that is working is allowed to run long, and a
  countdown hitting zero mid-rep tells the player to stop doing the
  thing that was working.

  Finishing hands over to the existing log dialog — RPE and how it felt
  already live there, and a second feedback form would be a second
  place the same fact goes.
*/

function fmtClock(s: number) {
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export function SessionRunner({ entry }: { entry: TrainingEntry }) {
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);
  const [done, setDone] = useState<boolean[]>([]);
  const [blockSeconds, setBlockSeconds] = useState(0);
  const [totalSeconds, setTotalSeconds] = useState(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const plan = entry.plan ?? [];
  const meta = trainingMeta(entry.kind);
  const finished = done.length === plan.length && done.every(Boolean);

  useEffect(() => {
    if (!open) return;
    timer.current = setInterval(() => {
      setBlockSeconds((s) => s + 1);
      setTotalSeconds((s) => s + 1);
    }, 1000);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [open]);

  if (!plan.length) return null;

  const start = () => {
    setIndex(0);
    setDone(plan.map(() => false));
    setBlockSeconds(0);
    setTotalSeconds(0);
    setOpen(true);
  };

  const completeBlock = () => {
    setDone((d) => d.map((v, i) => (i === index ? true : v)));
    if (index < plan.length - 1) {
      setIndex(index + 1);
      setBlockSeconds(0);
    }
  };

  const back = () => {
    if (index > 0) {
      setIndex(index - 1);
      setBlockSeconds(0);
    }
  };

  const block = plan[index];

  return (
    <>
      <button
        onClick={start}
        className="flex h-8 items-center gap-1.5 rounded-md border border-signal-line px-2.5 text-xs font-medium text-signal-bright transition-colors hover:bg-signal/10"
        aria-label={`Run ${entry.title}`}
      >
        <Play className="size-3" /> Run
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            className="fixed inset-0 z-50 flex flex-col bg-ink-950"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            role="dialog"
            aria-modal="true"
            aria-label={`Running ${entry.title}`}
          >
            <div className="flex items-center justify-between border-b border-line px-4 py-3">
              <div className="min-w-0">
                <div className="label-tech" style={{ color: meta.color }}>{meta.label}</div>
                <div className="truncate text-sm font-medium text-text-hi">{entry.title}</div>
              </div>
              <div className="flex items-center gap-3">
                <span className="data-mono text-sm text-text-dim">{fmtClock(totalSeconds)} total</span>
                <button onClick={() => setOpen(false)} aria-label="Close" className="text-text-faint hover:text-text">
                  <X className="size-5" />
                </button>
              </div>
            </div>

            {!finished && block ? (
              <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
                <div className="label-tech mb-2">
                  Block {String(index + 1).padStart(2, "0")} / {String(plan.length).padStart(2, "0")}
                </div>
                <h2 className="font-display text-3xl font-semibold uppercase text-text-hi md:text-4xl">
                  {block.name}
                </h2>
                <div className="data-mono mt-2 text-lg text-signal-bright">{block.work}</div>

                <div className="data-mono mt-8 text-6xl font-light tabular-nums text-text-hi md:text-7xl">
                  {fmtClock(blockSeconds)}
                </div>

                {block.detail && (
                  <p className="mt-8 max-w-md text-base leading-relaxed text-text">{block.detail}</p>
                )}
                {block.source && (
                  <span className="mt-4 rounded-full border border-signal-line px-3 py-1 text-[11px] uppercase tracking-wide text-signal-bright">
                    {block.source}
                  </span>
                )}

                {index < plan.length - 1 && (
                  <p className="mt-6 text-xs text-text-faint">
                    Next: {plan[index + 1]?.name}
                  </p>
                )}
              </div>
            ) : (
              <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
                <span className="grid size-14 place-items-center rounded-full border border-positive/40 bg-positive/10 text-positive">
                  <Check className="size-7" />
                </span>
                <h2 className="mt-4 font-display text-2xl font-semibold uppercase text-text-hi">Session done</h2>
                <p className="data-mono mt-1 text-sm text-text-dim">{fmtClock(totalSeconds)} on the clock</p>
                <p className="mt-4 max-w-sm text-sm leading-relaxed text-text-dim">
                  Log how it felt — RPE and one honest line. That is what MIDO reads before it
                  builds the next one.
                </p>
                {/*
                  The log dialog must stay MOUNTED while it opens, so the
                  runner does not close on this tap — the dialog renders
                  above it, and closing the runner would unmount the
                  dialog mid-open.
                */}
                <div className="mt-5">
                  <TrainingFormDialog mode="edit" entry={entry} />
                </div>
                <button
                  onClick={() => setOpen(false)}
                  className="mt-3 text-xs text-text-faint transition-colors hover:text-text"
                >
                  Close without logging
                </button>
              </div>
            )}

            {!finished && (
              <div className="flex items-center gap-3 border-t border-line p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
                <button
                  onClick={back}
                  disabled={index === 0}
                  className="flex h-14 w-24 items-center justify-center gap-1 rounded-xl border border-line text-sm text-text-dim transition-colors hover:text-text-hi disabled:opacity-40"
                >
                  <ChevronLeft className="size-4" /> Back
                </button>
                <button
                  onClick={completeBlock}
                  className="flex h-14 flex-1 items-center justify-center gap-2 rounded-xl bg-signal text-base font-medium text-white transition-colors hover:bg-signal-deep"
                >
                  <Check className="size-5" />
                  {index < plan.length - 1 ? "Complete block" : "Finish session"}
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
