"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { createReport, updateReport, removeReport } from "@/app/app/opposition/actions";
import {
  OBSERVATION_GROUPS,
  type OppositionKeyPlayer,
  type OppositionReport,
  type OppositionReportInput,
} from "@/lib/data/coach-types";
import { Modal, Field, TextInput, TextArea, ListEditor, FormError, SubmitRow, ConfirmDelete } from "@/components/forms/ui";

function empty(): OppositionReportInput {
  return {
    opponent: "",
    competition: "",
    matchDate: "",
    home: true,
    formation: "",
    keyPlayers: [],
    inPossession: [],
    outOfPossession: [],
    transition: [],
    setPieces: [],
    weaknesses: [],
    notes: "",
  };
}

export function OppositionForm({
  mode,
  report,
}: {
  mode: "create" | "edit";
  report?: OppositionReport;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<OppositionReportInput>(
    mode === "edit" && report
      ? {
          opponent: report.opponent,
          competition: report.competition,
          matchDate: report.matchDate ?? "",
          home: report.home ?? true,
          formation: report.formation,
          keyPlayers: report.keyPlayers,
          inPossession: report.inPossession,
          outOfPossession: report.outOfPossession,
          transition: report.transition,
          setPieces: report.setPieces,
          weaknesses: report.weaknesses,
          notes: report.notes,
        }
      : empty(),
  );

  const set = (patch: Partial<OppositionReportInput>) => setForm((f) => ({ ...f, ...patch }));

  const submit = async () => {
    setBusy(true);
    setError(null);
    const res = mode === "create" ? await createReport(form) : await updateReport(report!.id, form);
    setBusy(false);
    if (res.ok) {
      setOpen(false);
      if (mode === "create" && res.id) router.push(`/app/opposition/${res.id}`);
      else router.refresh();
    } else {
      setError(res.error);
    }
  };

  return (
    <>
      {mode === "create" ? (
        <button
          onClick={() => setOpen(true)}
          className="flex h-9 items-center gap-2 rounded-lg bg-signal px-3.5 text-sm font-medium text-white transition-colors hover:bg-signal-deep"
        >
          <Plus className="size-4" /> New report
        </button>
      ) : (
        <button
          onClick={() => setOpen(true)}
          aria-label="Edit report"
          className="flex size-8 items-center justify-center rounded-lg border border-line text-text-dim transition-colors hover:border-signal-line hover:text-signal-bright"
        >
          <Pencil className="size-3.5" />
        </button>
      )}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        wide
        eyebrow={mode === "create" ? "New report" : "Edit report"}
        title="Opposition"
        footer={
          <div className="flex items-center gap-2">
            {mode === "edit" && report && <ConfirmDelete onConfirm={() => removeReport(report.id)} />}
            <div className="flex-1">
              <SubmitRow
                onCancel={() => setOpen(false)}
                onSubmit={submit}
                busy={busy}
                label={mode === "create" ? "Create report" : "Save report"}
                disabled={!form.opponent.trim()}
              />
            </div>
          </div>
        }
      >
        <div className="grid grid-cols-2 gap-3">
          <Field label="Opponent" span>
            <TextInput value={form.opponent} onChange={(v) => set({ opponent: v })} placeholder="Riverside Athletic" />
          </Field>
          <Field label="Competition">
            <TextInput value={form.competition} onChange={(v) => set({ competition: v })} placeholder="Championship North" />
          </Field>
          <Field label="Match date">
            <TextInput type="date" value={form.matchDate} onChange={(v) => set({ matchDate: v })} />
          </Field>
          <Field label="Their shape">
            <TextInput value={form.formation} onChange={(v) => set({ formation: v })} placeholder="4-4-2" />
          </Field>
          <Field label="Venue">
            <div className="flex gap-1.5">
              {[
                { v: true, label: "Home" },
                { v: false, label: "Away" },
              ].map((o) => (
                <button
                  key={o.label}
                  type="button"
                  onClick={() => set({ home: o.v })}
                  className="h-10 flex-1 rounded-lg border text-sm transition-colors"
                  style={
                    form.home === o.v
                      ? { borderColor: "var(--signal-line)", color: "var(--signal-bright)", background: "var(--signal-wash)" }
                      : { borderColor: "var(--line-strong)", color: "var(--text-dim)" }
                  }
                >
                  {o.label}
                </button>
              ))}
            </div>
          </Field>
        </div>

        <div className="mt-4 border-t border-line pt-4">
          <div className="label-tech mb-1">Key players</div>
          <p className="mb-2 text-[11px] leading-relaxed text-text-faint">
            Only what you have seen. MIDO will use these words and will not add players of its own.
          </p>
          <KeyPlayerEditor value={form.keyPlayers} onChange={(v) => set({ keyPlayers: v })} />
        </div>

        <div className="mt-4 space-y-4 border-t border-line pt-4">
          {OBSERVATION_GROUPS.map((g) => (
            <div key={g.key}>
              <div className="label-tech" style={{ color: g.color }}>
                {g.label}
              </div>
              <p className="mb-1.5 text-[11px] text-text-faint">{g.hint}</p>
              <ListEditor
                items={form[g.key]}
                onChange={(v) => set({ [g.key]: v } as Partial<OppositionReportInput>)}
                placeholder="One observation…"
                color={g.color}
              />
            </div>
          ))}
        </div>

        <div className="mt-4 border-t border-line pt-4">
          <Field label="Notes" span>
            <TextArea value={form.notes} onChange={(v) => set({ notes: v })} rows={2} placeholder="Anything else you noticed…" />
          </Field>
        </div>

        <FormError error={error} />
      </Modal>
    </>
  );
}

function KeyPlayerEditor({
  value,
  onChange,
}: {
  value: OppositionKeyPlayer[];
  onChange: (v: OppositionKeyPlayer[]) => void;
}) {
  const [draft, setDraft] = useState<OppositionKeyPlayer>({ name: "", position: "", threat: "" });

  const add = () => {
    if (!draft.name.trim() || !draft.threat.trim()) return;
    onChange([...value, { ...draft, name: draft.name.trim(), threat: draft.threat.trim() }]);
    setDraft({ name: "", position: "", threat: "" });
  };

  return (
    <div>
      {value.length > 0 && (
        <ul className="mb-2 space-y-1.5">
          {value.map((p, i) => (
            <li key={i} className="flex items-start gap-2 rounded-lg border border-line bg-ink-850 px-3 py-2">
              <span className="min-w-0 flex-1">
                <span className="text-sm text-text-hi">
                  {p.name}
                  {p.position && <span className="text-text-dim"> · {p.position}</span>}
                </span>
                <span className="mt-0.5 block text-xs leading-relaxed text-text-dim">{p.threat}</span>
              </span>
              <button
                type="button"
                onClick={() => onChange(value.filter((_, j) => j !== i))}
                aria-label="Remove player"
                className="shrink-0 text-text-faint transition-colors hover:text-correction"
              >
                <Trash2 className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="grid grid-cols-[1.2fr_0.6fr] gap-2">
        <TextInput value={draft.name} onChange={(v) => setDraft({ ...draft, name: v })} placeholder="Name or number" />
        <TextInput value={draft.position} onChange={(v) => setDraft({ ...draft, position: v })} placeholder="Position" />
      </div>
      <div className="mt-2 flex gap-2">
        <input
          value={draft.threat}
          onChange={(e) => setDraft({ ...draft, threat: e.target.value })}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          placeholder="What makes them dangerous?"
          className="h-10 flex-1 rounded-lg border border-line bg-ink-850 px-3 text-sm text-text-hi placeholder:text-text-faint focus:border-signal-line focus:outline-none"
        />
        <button
          type="button"
          onClick={add}
          disabled={!draft.name.trim() || !draft.threat.trim()}
          aria-label="Add player"
          className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-line text-text-dim transition-colors hover:border-signal-line hover:text-signal-bright disabled:opacity-40"
        >
          <Plus className="size-4" />
        </button>
      </div>
    </div>
  );
}
