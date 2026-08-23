"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil } from "lucide-react";
import { addAthlete, editAthlete, removeAthlete } from "@/app/app/athletes/actions";
import {
  ATHLETE_STATUS,
  type Athlete,
  type AthleteInput,
  type AthleteStatus,
} from "@/lib/data/trainer-types";
import { Modal, Field, TextInput, TextArea, ChipPicker, FormError, SubmitRow, ConfirmDelete } from "@/components/forms/ui";

const POSITIONS = ["GK", "RB", "RCB", "CB", "LCB", "LB", "RWB", "LWB", "6", "8", "10", "RW", "LW", "CF", "ST"];

function empty(): AthleteInput {
  return { name: "", position: "", dateOfBirth: "", objective: "", limitations: "", status: "active" };
}

export function AthleteForm({ mode, athlete }: { mode: "create" | "edit"; athlete?: Athlete }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<AthleteInput>(
    mode === "edit" && athlete
      ? {
          name: athlete.name,
          position: athlete.position,
          dateOfBirth: athlete.dateOfBirth ?? "",
          objective: athlete.objective ?? "",
          limitations: athlete.limitations ?? "",
          status: athlete.status,
        }
      : empty(),
  );

  const set = (patch: Partial<AthleteInput>) => setForm((f) => ({ ...f, ...patch }));

  const submit = async () => {
    setBusy(true);
    setError(null);
    const res = mode === "create" ? await addAthlete(form) : await editAthlete(athlete!.id, form);
    setBusy(false);
    if (res.ok) {
      setOpen(false);
      if (mode === "create") setForm(empty());
      router.refresh();
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
          <Plus className="size-4" /> Add athlete
        </button>
      ) : (
        <button
          onClick={() => setOpen(true)}
          aria-label="Edit athlete"
          className="flex size-8 items-center justify-center rounded-lg border border-line text-text-dim transition-colors hover:border-signal-line hover:text-signal-bright"
        >
          <Pencil className="size-3.5" />
        </button>
      )}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        eyebrow={mode === "create" ? "New athlete" : "Edit athlete"}
        title="Athlete"
        footer={
          <div className="flex items-center gap-2">
            {mode === "edit" && athlete && <ConfirmDelete onConfirm={() => removeAthlete(athlete.id)} label="Remove" />}
            <div className="flex-1">
              <SubmitRow
                onCancel={() => setOpen(false)}
                onSubmit={submit}
                busy={busy}
                label={mode === "create" ? "Add athlete" : "Save athlete"}
                disabled={!form.name.trim()}
              />
            </div>
          </div>
        }
      >
        <div className="grid grid-cols-2 gap-3">
          <Field label="Name" span>
            <TextInput value={form.name} onChange={(v) => set({ name: v })} placeholder="Athlete name" />
          </Field>
          <Field label="Position">
            <select
              value={form.position}
              onChange={(e) => set({ position: e.target.value })}
              className="h-10 w-full rounded-lg border border-line bg-ink-850 px-3 text-sm text-text-hi focus:border-signal-line focus:outline-none"
            >
              <option value="">Select</option>
              {POSITIONS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Date of birth">
            <TextInput type="date" value={form.dateOfBirth} onChange={(v) => set({ dateOfBirth: v })} />
          </Field>
        </div>

        <div className="mt-3">
          <Field
            label="Football objective"
            hint="What the physical work is for. Every block should trace back to this."
          >
            <TextArea
              value={form.objective}
              onChange={(v) => set({ objective: v })}
              rows={2}
              placeholder="e.g. Explosive separation over the first 5-10 metres"
            />
          </Field>
        </div>

        <div className="mt-3">
          <Field label="Limitations" hint="Injuries, restrictions, anything a session must respect.">
            <TextArea
              value={form.limitations}
              onChange={(v) => set({ limitations: v })}
              rows={2}
              placeholder="e.g. Left ankle — no deep dorsiflexion loading this block"
            />
          </Field>
        </div>

        <div className="mt-3">
          <span className="label-tech mb-1 block">Status</span>
          <ChipPicker<AthleteStatus>
            value={form.status}
            onChange={(v) => set({ status: v })}
            options={ATHLETE_STATUS.map((s) => ({ value: s.value, label: s.label, color: s.color }))}
          />
        </div>

        <FormError error={error} />
      </Modal>
    </>
  );
}
