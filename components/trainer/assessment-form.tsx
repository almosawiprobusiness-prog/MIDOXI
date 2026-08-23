"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Loader2, Trash2 } from "lucide-react";
import { recordAssessment, removeAssessment } from "@/app/app/assessments/actions";
import { TESTS, test as testMeta } from "@/lib/knowledge/physical";
import type { Athlete } from "@/lib/data/trainer-types";
import { Modal, Field, TextInput, TextArea, FormError, SubmitRow } from "@/components/forms/ui";

const today = () => new Date().toISOString().slice(0, 10);

export function AssessmentForm({
  athletes,
  presetAthleteId = "",
  label = "Record a test",
}: {
  athletes: Athlete[];
  presetAthleteId?: string;
  label?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [athleteId, setAthleteId] = useState(presetAthleteId || athletes[0]?.id || "");
  const [test, setTest] = useState<string>(TESTS[0].id);
  const [value, setValue] = useState("");
  const [side, setSide] = useState<"left" | "right" | "">("");
  const [testedOn, setTestedOn] = useState(today());
  const [notes, setNotes] = useState("");

  const meta = testMeta(test);

  const submit = async () => {
    setBusy(true);
    setError(null);
    const res = await recordAssessment({
      athleteId,
      test,
      value: Number(value),
      unit: meta?.unit ?? "",
      side: side || null,
      testedOn,
      notes,
    });
    setBusy(false);
    if (res.ok) {
      setOpen(false);
      setValue("");
      setNotes("");
      router.refresh();
    } else {
      setError(res.error);
    }
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        disabled={athletes.length === 0}
        className="flex h-9 items-center gap-2 rounded-lg bg-signal px-3.5 text-sm font-medium text-white transition-colors hover:bg-signal-deep disabled:opacity-50"
      >
        <Plus className="size-4" /> {label}
      </button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        eyebrow="New result"
        title="Assessment"
        footer={
          <SubmitRow
            onCancel={() => setOpen(false)}
            onSubmit={submit}
            busy={busy}
            label="Record result"
            disabled={!athleteId || !value.trim()}
          />
        }
      >
        <div className="grid grid-cols-2 gap-3">
          <Field label="Athlete" span>
            <select
              value={athleteId}
              onChange={(e) => setAthleteId(e.target.value)}
              className="h-10 w-full rounded-lg border border-line bg-ink-850 px-3 text-sm text-text-hi focus:border-signal-line focus:outline-none"
            >
              {athletes.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                  {a.position ? ` · ${a.position}` : ""}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Test" span>
            <select
              value={test}
              onChange={(e) => setTest(e.target.value)}
              className="h-10 w-full rounded-lg border border-line bg-ink-850 px-3 text-sm text-text-hi focus:border-signal-line focus:outline-none"
            >
              {TESTS.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label} ({t.unit})
                </option>
              ))}
            </select>
          </Field>

          <Field label={`Result (${meta?.unit ?? ""})`}>
            <TextInput value={value} onChange={setValue} placeholder={meta?.unit === "s" ? "1.72" : "45"} type="number" />
          </Field>
          <Field label="Tested on">
            <TextInput type="date" value={testedOn} onChange={setTestedOn} />
          </Field>
        </div>

        <div className="mt-3">
          <span className="label-tech mb-1 block">Side (when the test is sided)</span>
          <div className="flex gap-1.5">
            {[
              { v: "", label: "Not sided" },
              { v: "left", label: "Left" },
              { v: "right", label: "Right" },
            ].map((o) => (
              <button
                key={o.label}
                type="button"
                onClick={() => setSide(o.v as "left" | "right" | "")}
                className="h-9 flex-1 rounded-lg border text-xs transition-colors"
                style={
                  side === o.v
                    ? { borderColor: "var(--signal-line)", color: "var(--signal-bright)", background: "var(--signal-wash)" }
                    : { borderColor: "var(--line-strong)", color: "var(--text-dim)" }
                }
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>

        {meta && (
          <div className="mt-3 rounded-lg border border-line bg-ink-850 p-3">
            <div className="label-tech">What it tells you</div>
            <p className="mt-1 text-xs leading-relaxed text-text-dim">{meta.tells}</p>
            <div className="label-tech mt-2">Protocol</div>
            <p className="mt-1 text-xs leading-relaxed text-text-dim">{meta.protocol}</p>
          </div>
        )}

        <div className="mt-3">
          <Field label="Notes" span>
            <TextArea value={notes} onChange={setNotes} rows={2} placeholder="Conditions, surface, anything unusual…" />
          </Field>
        </div>

        <FormError error={error} />
      </Modal>
    </>
  );
}

export function DeleteAssessment({ id, athleteId }: { id: string; athleteId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button
      onClick={() =>
        start(async () => {
          await removeAssessment(id, athleteId);
          router.refresh();
        })
      }
      aria-label="Delete result"
      className="shrink-0 text-text-faint transition-colors hover:text-correction"
    >
      {pending ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
    </button>
  );
}
