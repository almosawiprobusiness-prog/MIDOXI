"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { X, Loader2, Check, Sparkles } from "lucide-react";
import { createTraining, generateSession } from "@/app/app/training/actions";
import { trainingMeta } from "@/lib/data/training-types";
import type { SessionProposal } from "@/lib/intelligence/session-plan";

/*
  The session engine's front door.

  The player asks, MIDO drafts, the player confirms — nothing is
  written until Accept, the same contract as voice logging. Every
  block shows the piece of the record it exists because of; that
  pill IS the feature, so it renders even when space is tight.
*/

function defaultWhen(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(17, 0, 0, 0);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function GenerateSessionDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [proposal, setProposal] = useState<SessionProposal | null>(null);
  const [sources, setSources] = useState<Record<string, string>>({});
  const [when, setWhen] = useState(defaultWhen());

  const draft = async () => {
    setBusy(true);
    setError(null);
    const res = await generateSession();
    if (res.ok) {
      setProposal(res.proposal);
      setSources(res.sources);
    } else {
      setError(res.error);
    }
    setBusy(false);
  };

  const start = () => {
    setOpen(true);
    setProposal(null);
    setWhen(defaultWhen());
    void draft();
  };

  const accept = async () => {
    if (!proposal) return;
    setSaving(true);
    setError(null);
    const concepts = proposal.blocks
      .filter((b) => b.sourceKey.startsWith("film:"))
      .map((b) => b.sourceKey.slice(5));
    const res = await createTraining({
      kind: proposal.kind,
      title: proposal.title,
      scheduledAt: when,
      durationMin: proposal.durationMin,
      objective: proposal.objective,
      plan: proposal.blocks.map((b) => ({
        name: b.name,
        detail: b.detail,
        work: b.work,
        source: sources[b.sourceKey] ?? "",
      })),
      concepts: [...new Set(concepts)],
    });
    if (res.ok) {
      setOpen(false);
      setSaving(false);
      router.refresh();
    } else {
      setError(res.error);
      setSaving(false);
    }
  };

  const meta = proposal ? trainingMeta(proposal.kind) : null;

  return (
    <>
      <button
        onClick={start}
        className="flex h-9 items-center gap-2 rounded-lg border border-signal-line px-3.5 text-sm font-medium text-signal-bright transition-colors hover:bg-signal/10"
      >
        <Sparkles className="size-4" /> Draft with MIDO
      </button>

      <AnimatePresence>
        {open && (
          <motion.div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 py-[7vh]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setOpen(false)} />
            <motion.div role="dialog" aria-modal="true" aria-label="Draft a session" className="panel-raised relative w-full max-w-lg p-5 shadow-2xl shadow-black/50" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 12 }} transition={{ duration: 0.18, ease: [0.2, 0.8, 0.2, 1] }}>
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <div className="label-tech">From your record</div>
                  <h3 className="font-display text-lg font-semibold uppercase text-text-hi">Drafted session</h3>
                </div>
                <button onClick={() => setOpen(false)} className="text-text-faint hover:text-text" aria-label="Close"><X className="size-5" /></button>
              </div>

              {busy && (
                <div className="flex items-center gap-3 rounded-lg border border-line bg-ink-850 px-4 py-6 text-sm text-text-dim">
                  <Loader2 className="size-4 animate-spin text-signal-bright" /> Reading your record — goals, film, readiness…
                </div>
              )}

              {!busy && proposal && (
                <>
                  {proposal.note && (
                    <p className="mb-3 rounded-lg border border-review/30 bg-review/10 px-3 py-2 text-xs text-review">{proposal.note}</p>
                  )}

                  <div className="mb-1 flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium text-text-hi">{proposal.title}</span>
                    {meta && <span className="label-tech" style={{ color: meta.color }}>{meta.label}</span>}
                    <span className="label-tech">{proposal.durationMin} min</span>
                  </div>
                  <p className="mb-4 text-xs text-text-dim">{proposal.objective}</p>

                  <div className="space-y-2">
                    {proposal.blocks.map((b, i) => (
                      <div key={i} className="rounded-lg border border-line bg-ink-850 p-3">
                        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                          <span className="text-sm font-medium text-text-hi">{b.name}</span>
                          <span className="data-mono text-xs text-text-dim">{b.work}</span>
                        </div>
                        <p className="mt-1 text-xs text-text">{b.detail}</p>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <span className="rounded-full border border-signal-line px-2 py-0.5 text-[10px] uppercase tracking-wide text-signal-bright">
                            {sources[b.sourceKey] ?? "Your week"}
                          </span>
                          {b.why && <span className="text-[11px] text-text-faint">{b.why}</span>}
                        </div>
                      </div>
                    ))}
                  </div>

                  <label className="mt-4 block">
                    <span className="label-tech mb-1 block">Schedule for</span>
                    <input
                      type="datetime-local"
                      value={when}
                      onChange={(e) => setWhen(e.target.value)}
                      className="h-10 w-full rounded-lg border border-line bg-ink-850 px-3 text-sm text-text-hi focus:border-signal-line focus:outline-none"
                    />
                  </label>
                </>
              )}

              {error && <p className="mt-3 rounded-lg border border-correction/30 bg-correction/10 px-3 py-2 text-sm text-correction">{error}</p>}

              <div className="mt-5 flex items-center gap-3">
                <button onClick={() => setOpen(false)} className="h-11 rounded-lg border border-line px-4 text-sm text-text-dim transition-colors hover:text-text-hi">Cancel</button>
                <button
                  onClick={accept}
                  disabled={busy || saving || !proposal || !when}
                  className="flex h-11 flex-1 items-center justify-center gap-2 rounded-lg bg-signal font-medium text-white transition-colors hover:bg-signal-deep disabled:opacity-50"
                >
                  {saving ? <Loader2 className="size-4 animate-spin" /> : <><Check className="size-4" /> Accept session</>}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
