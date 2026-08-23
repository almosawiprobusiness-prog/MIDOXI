"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil } from "lucide-react";
import { addProgram, editProgram, removeProgram } from "@/app/app/programs/actions";
import {
  PROGRAM_STATUS,
  type Athlete,
  type Program,
  type ProgramInput,
  type ProgramStatus,
} from "@/lib/data/trainer-types";
import { Modal, Field, TextInput, NumberInput, TextArea, ChipPicker, FormError, SubmitRow, ConfirmDelete } from "@/components/forms/ui";

function mondayNext(): string {
  const d = new Date();
  d.setDate(d.getDate() + ((8 - d.getDay()) % 7 || 7));
  return d.toISOString().slice(0, 10);
}

function empty(athleteId: string | null): ProgramInput {
  return {
    athleteId,
    title: "",
    objective: "",
    weeks: 6,
    sessionsPerWeek: 2,
    startsOn: mondayNext(),
    status: "draft",
  };
}

export function ProgramForm({
  mode,
  program,
  athletes,
  presetAthleteId = null,
}: {
  mode: "create" | "edit";
  program?: Program;
  athletes: Athlete[];
  presetAthleteId?: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<ProgramInput>(
    mode === "edit" && program
      ? {
          athleteId: program.athleteId,
          title: program.title,
          objective: program.objective,
          weeks: program.weeks,
          sessionsPerWeek: program.sessionsPerWeek,
          startsOn: program.startsOn ?? "",
          status: program.status,
        }
      : empty(presetAthleteId),
  );

  const set = (patch: Partial<ProgramInput>) => setForm((f) => ({ ...f, ...patch }));

  const submit = async () => {
    setBusy(true);
    setError(null);
    const res = mode === "create" ? await addProgram(form) : await editProgram(program!.id, form);
    setBusy(false);
    if (res.ok) {
      setOpen(false);
      if (mode === "create" && res.id) router.push(`/app/programs/${res.id}`);
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
          <Plus className="size-4" /> New block
        </button>
      ) : (
        <button
          onClick={() => setOpen(true)}
          aria-label="Edit block"
          className="flex size-8 items-center justify-center rounded-lg border border-line text-text-dim transition-colors hover:border-signal-line hover:text-signal-bright"
        >
          <Pencil className="size-3.5" />
        </button>
      )}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        eyebrow={mode === "create" ? "New block" : "Edit block"}
        title="Training block"
        footer={
          <div className="flex items-center gap-2">
            {mode === "edit" && program && <ConfirmDelete onConfirm={() => removeProgram(program.id)} />}
            <div className="flex-1">
              <SubmitRow
                onCancel={() => setOpen(false)}
                onSubmit={submit}
                busy={busy}
                label={mode === "create" ? "Create block" : "Save block"}
                disabled={!form.title.trim()}
              />
            </div>
          </div>
        }
      >
        <div className="grid grid-cols-2 gap-3">
          <Field label="Title" span>
            <TextInput
              value={form.title}
              onChange={(v) => set({ title: v })}
              placeholder="Acceleration block — 6 weeks"
            />
          </Field>
          <Field
            label="Objective"
            span
            hint="What this block is for. Sessions, progression and the retest are all built from it."
          >
            <TextArea
              value={form.objective}
              onChange={(v) => set({ objective: v })}
              rows={2}
              placeholder="Explosive separation over the first 5-10 metres"
            />
          </Field>
          <Field label="Athlete" span>
            <select
              value={form.athleteId ?? ""}
              onChange={(e) => set({ athleteId: e.target.value || null })}
              className="h-10 w-full rounded-lg border border-line bg-ink-850 px-3 text-sm text-text-hi focus:border-signal-line focus:outline-none"
            >
              <option value="">Unassigned — a template</option>
              {athletes.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                  {a.position ? ` · ${a.position}` : ""}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Weeks">
            <NumberInput value={form.weeks} onChange={(v) => set({ weeks: v ?? 6 })} placeholder="6" />
          </Field>
          <Field label="Sessions / week">
            <NumberInput
              value={form.sessionsPerWeek}
              onChange={(v) => set({ sessionsPerWeek: v ?? 2 })}
              placeholder="2"
            />
          </Field>
          <Field label="Starts on" span>
            <TextInput type="date" value={form.startsOn} onChange={(v) => set({ startsOn: v })} />
          </Field>
        </div>

        <div className="mt-3">
          <span className="label-tech mb-1 block">Status</span>
          <ChipPicker<ProgramStatus>
            value={form.status}
            onChange={(v) => set({ status: v })}
            options={PROGRAM_STATUS.map((s) => ({ value: s.value, label: s.label, color: s.color }))}
          />
        </div>

        <FormError error={error} />
      </Modal>
    </>
  );
}
