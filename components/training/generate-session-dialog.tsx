"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { X, Loader2, Check, Sparkles, RefreshCw } from "lucide-react";
import { createTraining, generateSession, adaptGeneratedSession } from "@/app/app/training/actions";
import { trainingMeta } from "@/lib/data/training-types";
import {
  BRIEF_MINUTES,
  BRIEF_LOCATIONS,
  BRIEF_MODES,
  BRIEF_EQUIPMENT,
  type SessionBrief,
  type SessionProposal,
} from "@/lib/intelligence/session-plan";
import { ADAPT_DIRECTIVES, type AdaptDirective } from "@/lib/intelligence/session-adapt";

/*
  The session engine's front door.

  The player asks, MIDO drafts, the player confirms — nothing is
  written until Accept, the same contract as voice logging. Every
  block shows the piece of the record it exists because of; that
  pill IS the feature, so it renders even when space is tight.

  The brief is chips, not a form: MIDO drafts immediately from the
  record alone, and the chips exist for the player who knows today is
  "30 minutes, wall, solo". Changing a chip does not silently redraft
  (a paid unit is not spent by a stray tap) — the Redraft button says
  when. Adaptations run on the drafted session and land in place; the
  original is kept so a bad adaptation costs one tap to undo.

  The brief's last use is remembered locally per device — memory of a
  convenience, not of the record, so localStorage is the right home.
*/

const BRIEF_KEY = "mido.sessionBrief";

function loadBrief(): SessionBrief {
  try {
    const raw = localStorage.getItem(BRIEF_KEY);
    return raw ? (JSON.parse(raw) as SessionBrief) : {};
  } catch {
    return {};
  }
}

function saveBrief(brief: SessionBrief) {
  try {
    localStorage.setItem(BRIEF_KEY, JSON.stringify(brief));
  } catch {
    /* a convenience that failed to persist is not an error */
  }
}

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
  const [adapting, setAdapting] = useState<AdaptDirective | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [proposal, setProposal] = useState<SessionProposal | null>(null);
  const [previous, setPrevious] = useState<SessionProposal | null>(null);
  const [sources, setSources] = useState<Record<string, string>>({});
  const [when, setWhen] = useState(defaultWhen());
  const [brief, setBrief] = useState<SessionBrief>({});
  const [showBrief, setShowBrief] = useState(false);

  const draft = async (withBrief: SessionBrief) => {
    setBusy(true);
    setError(null);
    setPrevious(null);
    const res = await generateSession(withBrief);
    if (res.ok) {
      setProposal(res.proposal);
      setSources(res.sources);
    } else {
      setError(res.error);
    }
    setBusy(false);
  };

  const start = () => {
    const remembered = loadBrief();
    setBrief(remembered);
    setShowBrief(false);
    setOpen(true);
    setProposal(null);
    setWhen(defaultWhen());
    void draft(remembered);
  };

  const redraft = () => {
    saveBrief(brief);
    void draft(brief);
  };

  const adapt = async (directive: AdaptDirective) => {
    if (!proposal || adapting) return;
    setAdapting(directive);
    setError(null);
    const res = await adaptGeneratedSession(proposal, directive);
    if (res.ok) {
      setPrevious(proposal);
      setProposal(res.proposal);
      setSources((s) => ({ ...s, ...res.sources }));
    } else {
      setError(res.error);
    }
    setAdapting(null);
  };

  const setBriefField = <K extends keyof SessionBrief>(key: K, value: SessionBrief[K]) => {
    setBrief((b) => {
      const next = { ...b };
      if (next[key] === value) delete next[key];
      else next[key] = value;
      return next;
    });
  };

  const toggleEquipment = (item: string) => {
    setBrief((b) => {
      const has = b.equipment?.includes(item);
      const eq = has ? (b.equipment ?? []).filter((e) => e !== item) : [...(b.equipment ?? []), item];
      const next = { ...b };
      if (eq.length) next.equipment = eq;
      else delete next.equipment;
      return next;
    });
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

              <div className="mb-3">
                <button
                  onClick={() => setShowBrief((s) => !s)}
                  className="text-xs font-medium text-text-dim transition-colors hover:text-signal-bright"
                >
                  {showBrief ? "Hide today's setup" : "Today's setup — time, place, equipment"}
                </button>
                {showBrief && (
                  <div className="mt-2 space-y-2 rounded-lg border border-line bg-ink-850 p-3">
                    <div className="flex flex-wrap gap-1.5">
                      {BRIEF_MINUTES.map((m) => (
                        <button
                          key={m}
                          onClick={() => setBriefField("minutes", m)}
                          aria-pressed={brief.minutes === m}
                          className={`h-7 rounded-md border px-2 text-xs transition-colors ${brief.minutes === m ? "border-signal-line bg-signal/10 text-signal-bright" : "border-line text-text-dim hover:text-text"}`}
                        >
                          {m} min
                        </button>
                      ))}
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {BRIEF_LOCATIONS.map((l) => (
                        <button
                          key={l}
                          onClick={() => setBriefField("location", l)}
                          aria-pressed={brief.location === l}
                          className={`h-7 rounded-md border px-2 text-xs capitalize transition-colors ${brief.location === l ? "border-signal-line bg-signal/10 text-signal-bright" : "border-line text-text-dim hover:text-text"}`}
                        >
                          {l.replace("-", " ")}
                        </button>
                      ))}
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {BRIEF_MODES.map((m) => (
                        <button
                          key={m}
                          onClick={() => setBriefField("mode", m)}
                          aria-pressed={brief.mode === m}
                          className={`h-7 rounded-md border px-2 text-xs capitalize transition-colors ${brief.mode === m ? "border-signal-line bg-signal/10 text-signal-bright" : "border-line text-text-dim hover:text-text"}`}
                        >
                          {m}
                        </button>
                      ))}
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {BRIEF_EQUIPMENT.map((e) => (
                        <button
                          key={e}
                          onClick={() => toggleEquipment(e)}
                          aria-pressed={brief.equipment?.includes(e) ?? false}
                          className={`h-7 rounded-md border px-2 text-xs capitalize transition-colors ${brief.equipment?.includes(e) ? "border-signal-line bg-signal/10 text-signal-bright" : "border-line text-text-dim hover:text-text"}`}
                        >
                          {e}
                        </button>
                      ))}
                    </div>
                    <button
                      onClick={redraft}
                      disabled={busy}
                      className="mt-1 flex h-8 items-center gap-1.5 rounded-md border border-signal-line px-3 text-xs font-medium text-signal-bright transition-colors hover:bg-signal/10 disabled:opacity-50"
                    >
                      <RefreshCw className="size-3" /> Redraft with this setup
                    </button>
                  </div>
                )}
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

                  <div className="mt-4">
                    <div className="label-tech mb-1.5">Adjust it</div>
                    <div className="flex flex-wrap gap-1.5">
                      {ADAPT_DIRECTIVES.map((d) => (
                        <button
                          key={d.key}
                          onClick={() => adapt(d.key)}
                          disabled={busy || adapting !== null}
                          className="flex h-7 items-center gap-1 rounded-md border border-line px-2 text-xs text-text-dim transition-colors hover:border-signal-line hover:text-signal-bright disabled:opacity-50"
                        >
                          {adapting === d.key && <Loader2 className="size-3 animate-spin" />}
                          {d.label}
                        </button>
                      ))}
                    </div>
                    {previous && (
                      <button
                        onClick={() => {
                          setProposal(previous);
                          setPrevious(null);
                        }}
                        className="mt-2 text-xs font-medium text-text-faint transition-colors hover:text-text"
                      >
                        Undo — back to the previous version
                      </button>
                    )}
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
