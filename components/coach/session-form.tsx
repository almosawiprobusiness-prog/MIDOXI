"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil } from "lucide-react";
import { createPlan, updatePlan, removePlan } from "@/app/app/sessions/actions";
import type { SessionPlan, SessionPlanInput, SessionStatus } from "@/lib/data/coach-types";
import { Modal, Field, TextInput, NumberInput, TextArea, ChipPicker, FormError, SubmitRow, ConfirmDelete } from "@/components/forms/ui";

const STATUSES: { value: SessionStatus; label: string; color: string }[] = [
  { value: "draft", label: "Draft", color: "var(--text-dim)" },
  { value: "planned", label: "Planned", color: "var(--signal-bright)" },
  { value: "delivered", label: "Delivered", color: "var(--positive)" },
];

const INTENSITIES: { value: "low" | "moderate" | "high"; label: string; color: string }[] = [
  { value: "low", label: "Low", color: "var(--positive)" },
  { value: "moderate", label: "Moderate", color: "var(--review)" },
  { value: "high", label: "High", color: "var(--correction)" },
];

function tomorrowAt(hour: number): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(hour, 30, 0, 0);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

function empty(objective: string): SessionPlanInput {
  return {
    title: "",
    scheduledAt: tomorrowAt(10),
    durationMin: 75,
    objective,
    playersCount: null,
    pitch: "",
    intensity: "moderate",
    status: "draft",
  };
}

export function SessionForm({
  mode,
  plan,
  presetObjective = "",
}: {
  mode: "create" | "edit";
  plan?: SessionPlan;
  /** Pre-filled when arriving from a player's development focus. */
  presetObjective?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<SessionPlanInput>(
    mode === "edit" && plan
      ? {
          title: plan.title,
          scheduledAt: plan.scheduledAt ? plan.scheduledAt.slice(0, 16) : "",
          durationMin: plan.durationMin,
          objective: plan.objective,
          playersCount: plan.playersCount,
          pitch: plan.pitch,
          intensity: plan.intensity,
          status: plan.status,
        }
      : empty(presetObjective),
  );

  const set = (patch: Partial<SessionPlanInput>) => setForm((f) => ({ ...f, ...patch }));

  const submit = async () => {
    setBusy(true);
    setError(null);
    const res = mode === "create" ? await createPlan(form) : await updatePlan(plan!.id, form);
    setBusy(false);
    if (res.ok) {
      setOpen(false);
      if (mode === "create" && res.id) router.push(`/app/sessions/${res.id}`);
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
          <Plus className="size-4" /> New session
        </button>
      ) : (
        <button
          onClick={() => setOpen(true)}
          aria-label="Edit session"
          className="flex size-8 items-center justify-center rounded-lg border border-line text-text-dim transition-colors hover:border-signal-line hover:text-signal-bright"
        >
          <Pencil className="size-3.5" />
        </button>
      )}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        eyebrow={mode === "create" ? "New session" : "Edit session"}
        title="Session plan"
        footer={
          <div className="flex items-center gap-2">
            {mode === "edit" && plan && <ConfirmDelete onConfirm={() => removePlan(plan.id)} />}
            <div className="flex-1">
              <SubmitRow
                onCancel={() => setOpen(false)}
                onSubmit={submit}
                busy={busy}
                label={mode === "create" ? "Create session" : "Save session"}
                disabled={!form.title.trim()}
              />
            </div>
          </div>
        }
      >
        <div className="grid grid-cols-2 gap-3">
          <Field label="Title" span>
            <TextInput value={form.title} onChange={(v) => set({ title: v })} placeholder="MD-3 · Defending transitions" />
          </Field>
          <Field label="Objective" span hint="What should be different at the end of this session? MIDO drafts from this.">
            <TextArea
              value={form.objective}
              onChange={(v) => set({ objective: v })}
              rows={2}
              placeholder="React in the first five seconds after losing the ball…"
            />
          </Field>
          <Field label="Date & time">
            <TextInput type="datetime-local" value={form.scheduledAt} onChange={(v) => set({ scheduledAt: v })} />
          </Field>
          <Field label="Duration (min)">
            <NumberInput value={form.durationMin} onChange={(v) => set({ durationMin: v })} placeholder="75" />
          </Field>
          <Field label="Players">
            <NumberInput value={form.playersCount} onChange={(v) => set({ playersCount: v })} placeholder="18" />
          </Field>
          <Field label="Pitch">
            <TextInput value={form.pitch} onChange={(v) => set({ pitch: v })} placeholder="Two thirds" />
          </Field>
        </div>

        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div className="min-w-0">
            <span className="label-tech mb-1 block">Intensity</span>
            <ChipPicker
              value={form.intensity ?? "moderate"}
              onChange={(v) => set({ intensity: v })}
              options={INTENSITIES}
            />
          </div>
          <div>
            <span className="label-tech mb-1 block">Status</span>
            <ChipPicker value={form.status} onChange={(v) => set({ status: v })} options={STATUSES} />
          </div>
        </div>

        <FormError error={error} />
      </Modal>
    </>
  );
}
