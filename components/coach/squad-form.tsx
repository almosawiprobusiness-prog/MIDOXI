"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil } from "lucide-react";
import { createPlayer, updatePlayer, removePlayer } from "@/app/app/squad/actions";
import { SQUAD_STATUS, type SquadPlayer, type SquadPlayerInput, type SquadStatus } from "@/lib/data/coach-types";
import { Modal, Field, TextInput, NumberInput, TextArea, ChipPicker, FormError, SubmitRow, ConfirmDelete } from "@/components/forms/ui";

const POSITIONS = ["GK", "RB", "RCB", "CB", "LCB", "LB", "RWB", "LWB", "6", "8", "10", "RW", "LW", "CF", "ST"];

function empty(): SquadPlayerInput {
  return { name: "", position: "", squadNumber: null, status: "active", focus: "" };
}

export function SquadForm({ mode, player }: { mode: "create" | "edit"; player?: SquadPlayer }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<SquadPlayerInput>(
    mode === "edit" && player
      ? {
          name: player.name,
          position: player.position,
          squadNumber: player.squadNumber,
          status: player.status,
          focus: player.focus ?? "",
        }
      : empty(),
  );

  const set = (patch: Partial<SquadPlayerInput>) => setForm((f) => ({ ...f, ...patch }));

  const submit = async () => {
    setBusy(true);
    setError(null);
    const res = mode === "create" ? await createPlayer(form) : await updatePlayer(player!.id, form);
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
          <Plus className="size-4" /> Add player
        </button>
      ) : (
        <button
          onClick={() => setOpen(true)}
          aria-label="Edit player"
          className="flex size-8 items-center justify-center rounded-lg border border-line text-text-dim transition-colors hover:border-signal-line hover:text-signal-bright"
        >
          <Pencil className="size-3.5" />
        </button>
      )}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        eyebrow={mode === "create" ? "New player" : "Edit player"}
        title="Squad"
        footer={
          <div className="flex items-center gap-2">
            {mode === "edit" && player && (
              <ConfirmDelete onConfirm={() => removePlayer(player.id)} label="Remove" />
            )}
            <div className="flex-1">
              <SubmitRow
                onCancel={() => setOpen(false)}
                onSubmit={submit}
                busy={busy}
                label={mode === "create" ? "Add to squad" : "Save player"}
                disabled={!form.name.trim()}
              />
            </div>
          </div>
        }
      >
        <div className="grid grid-cols-2 gap-3">
          <Field label="Name" span>
            <TextInput value={form.name} onChange={(v) => set({ name: v })} placeholder="Player name" />
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
          <Field label="Squad number">
            <NumberInput value={form.squadNumber} onChange={(v) => set({ squadNumber: v })} placeholder="—" />
          </Field>
        </div>

        <div className="mt-3">
          <span className="label-tech mb-1 block">Availability</span>
          <ChipPicker<SquadStatus>
            value={form.status}
            onChange={(v) => set({ status: v })}
            options={SQUAD_STATUS.map((s) => ({ value: s.value, label: s.label, color: s.color }))}
          />
        </div>

        <div className="mt-3">
          <Field label="Development focus" hint="The one thing you are reinforcing with this player right now.">
            <TextArea
              value={form.focus}
              onChange={(v) => set({ focus: v })}
              placeholder="e.g. Receiving on the half-turn under pressure"
              rows={2}
            />
          </Field>
        </div>

        <FormError error={error} />
      </Modal>
    </>
  );
}
