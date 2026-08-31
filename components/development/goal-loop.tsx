"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, RotateCw, Loader2, Plus, Trash2, Swords, Clapperboard, Lightbulb, Dumbbell, MessageSquare, type LucideIcon } from "lucide-react";
import { addEvidence, deleteEvidence } from "@/app/app/development/actions";
import { LOOP_STAGES, EVIDENCE_KINDS, evidenceMeta, type EvidenceKind, type EvidenceEntry } from "@/lib/data/development-types";

const kindIcon: Record<EvidenceKind, LucideIcon> = {
  match: Swords,
  film: Clapperboard,
  insight: Lightbulb,
  training: Dumbbell,
  coach: MessageSquare,
};

export function GoalLoop({ goalId, evidence }: { goalId: string; evidence: EvidenceEntry[] }) {
  const router = useRouter();
  const [kind, setKind] = useState<EvidenceKind>("match");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const noteRef = useRef<HTMLTextAreaElement>(null);

  const countFor = (k: EvidenceKind) => evidence.filter((e) => e.kind === k).length;

  const pick = (k: EvidenceKind) => {
    setKind(k);
    setTimeout(() => noteRef.current?.focus(), 20);
  };

  const add = async () => {
    if (!note.trim()) return;
    setBusy(true);
    setError(null);
    const res = await addEvidence(goalId, { kind, note });
    setBusy(false);
    if (res.ok) {
      setNote("");
      router.refresh();
    } else setError(res.error);
  };

  const remove = async (id: string) => {
    const res = await deleteEvidence(id, goalId);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    router.refresh();
  };

  return (
    <div className="space-y-4">
      {/* Loop diagram */}
      <div className="panel-raised p-5">
        <div className="mb-4 flex items-center gap-2">
          <RotateCw className="size-4 text-signal-bright" />
          <span className="label-tech !text-text">The development loop</span>
        </div>
        <div className="flex flex-wrap items-stretch gap-2">
          {LOOP_STAGES.map((stage, i) => {
            const Icon = kindIcon[stage.kind];
            const count = countFor(stage.kind);
            const active = kind === stage.kind;
            return (
              <div key={stage.kind} className="flex items-center gap-2">
                <button
                  onClick={() => pick(stage.kind)}
                  className={`group flex min-w-[104px] flex-col items-start rounded-lg border p-3 text-left transition-colors ${
                    active ? "border-signal-line bg-signal/10" : "border-line hover:border-line-strong"
                  }`}
                >
                  <div className="flex w-full items-center justify-between">
                    <Icon className="size-4" style={{ color: evidenceMeta(stage.kind).color }} />
                    <span className="stat-figure text-lg">{count}</span>
                  </div>
                  <span className="mt-1.5 font-display text-sm font-semibold text-text-hi">{stage.label}</span>
                  <span className="text-[10px] leading-tight text-text-faint">{stage.verb}</span>
                </button>
                {i < LOOP_STAGES.length - 1 ? (
                  <ArrowRight className="size-4 shrink-0 text-text-faint" />
                ) : (
                  <div className="flex shrink-0 items-center gap-1 text-text-faint" title="…and back into the next match">
                    <RotateCw className="size-4" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <p className="mt-3 text-xs text-text-dim">
          Each stage feeds the next. Log what you notice, study, and train — the evidence is the
          progress.
        </p>
      </div>

      {/* Composer */}
      <div className="panel p-4">
        <div className="mb-2 flex flex-wrap gap-1.5">
          {EVIDENCE_KINDS.map((e) => {
            const Icon = kindIcon[e.kind];
            const active = kind === e.kind;
            return (
              <button
                key={e.kind}
                onClick={() => setKind(e.kind)}
                className="flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs transition-colors"
                style={active ? { borderColor: e.color, color: e.color, background: "var(--signal-wash)" } : { borderColor: "var(--line-strong)", color: "var(--text-dim)" }}
              >
                <Icon className="size-3.5" /> {e.label}
              </button>
            );
          })}
        </div>
        <div className="flex gap-2">
          <textarea
            ref={noteRef}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={1}
            placeholder={`Add ${kind} evidence — what happened?`}
            className="min-h-10 flex-1 resize-y rounded-lg border border-line bg-ink-850 px-3 py-2 text-sm text-text-hi placeholder:text-text-faint focus:border-signal-line focus:outline-none"
          />
          <button
            onClick={add}
            disabled={busy || !note.trim()}
            className="flex h-10 shrink-0 items-center gap-2 self-start rounded-lg bg-signal px-3.5 text-sm font-medium text-white transition-colors hover:bg-signal-deep disabled:opacity-50"
          >
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />} Add
          </button>
        </div>
        {error && <p className="mt-2 text-sm text-correction">{error}</p>}
      </div>

      {/* Timeline */}
      {evidence.length > 0 ? (
        <div className="panel divide-y divide-line overflow-hidden">
          {evidence.map((e) => {
            const Icon = kindIcon[e.kind];
            const meta = evidenceMeta(e.kind);
            return (
              <div key={e.id} className="group flex items-start gap-3 px-4 py-3">
                <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-md border border-line" style={{ color: meta.color }}>
                  <Icon className="size-3.5" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="label-tech" style={{ color: meta.color }}>{meta.label}</span>
                    <span className="text-[11px] text-text-faint">
                      {new Date(e.createdAt).toLocaleDateString("en-GB", { timeZone: "UTC", day: "numeric", month: "short" })}
                    </span>
                  </div>
                  <p className="mt-0.5 text-sm text-text">{e.note}</p>
                </div>
                <button
                  onClick={() => remove(e.id)}
                  aria-label="Remove evidence"
                  className="text-text-faint opacity-0 transition-opacity hover:text-correction group-hover:opacity-100"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="px-1 text-sm text-text-dim">
          No evidence yet. Start the loop above — a match observation, a clip, a study insight, a session.
        </p>
      )}
    </div>
  );
}
