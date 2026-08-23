"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil } from "lucide-react";
import { addTeam, editTeam, removeTeam } from "@/app/app/teams/actions";
import type { ClubTeamRow, TeamInput } from "@/lib/data/club-types";
import { Modal, Field, TextInput, NumberInput, FormError, SubmitRow, ConfirmDelete } from "@/components/forms/ui";

const AGE_GROUPS = ["Senior", "U23", "U21", "U19", "U18", "U16", "U15", "U14", "U13", "U12"];

function empty(): TeamInput {
  return { name: "", ageGroup: "", level: "", season: "2026 / 27", squadSize: null };
}

export function TeamForm({ mode, team }: { mode: "create" | "edit"; team?: ClubTeamRow }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<TeamInput>(
    mode === "edit" && team
      ? {
          name: team.name,
          ageGroup: team.ageGroup,
          level: team.level,
          season: team.season,
          squadSize: team.squadSize,
        }
      : empty(),
  );

  const set = (patch: Partial<TeamInput>) => setForm((f) => ({ ...f, ...patch }));

  const submit = async () => {
    setBusy(true);
    setError(null);
    const res = mode === "create" ? await addTeam(form) : await editTeam(team!.id, form);
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
          <Plus className="size-4" /> Add team
        </button>
      ) : (
        <button
          onClick={() => setOpen(true)}
          aria-label="Edit team"
          className="flex size-8 items-center justify-center rounded-lg border border-line text-text-dim transition-colors hover:border-signal-line hover:text-signal-bright"
        >
          <Pencil className="size-3.5" />
        </button>
      )}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        eyebrow={mode === "create" ? "New team" : "Edit team"}
        title="Team"
        footer={
          <div className="flex items-center gap-2">
            {mode === "edit" && team && (
              <ConfirmDelete
                onConfirm={async () => {
                  await removeTeam(team.id);
                  setOpen(false);
                  router.refresh();
                }}
              />
            )}
            <div className="flex-1">
              <SubmitRow
                onCancel={() => setOpen(false)}
                onSubmit={submit}
                busy={busy}
                label={mode === "create" ? "Add team" : "Save team"}
                disabled={!form.name.trim()}
              />
            </div>
          </div>
        }
      >
        <div className="grid grid-cols-2 gap-3">
          <Field label="Name" span>
            <TextInput value={form.name} onChange={(v) => set({ name: v })} placeholder="U18" />
          </Field>
          <Field label="Age group">
            <select
              value={form.ageGroup}
              onChange={(e) => set({ ageGroup: e.target.value })}
              className="h-10 w-full rounded-lg border border-line bg-ink-850 px-3 text-sm text-text-hi focus:border-signal-line focus:outline-none"
            >
              <option value="">Select</option>
              {AGE_GROUPS.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Level">
            <TextInput value={form.level} onChange={(v) => set({ level: v })} placeholder="Academy" />
          </Field>
          <Field label="Season">
            <TextInput value={form.season} onChange={(v) => set({ season: v })} placeholder="2026 / 27" />
          </Field>
          <Field label="Squad size" hint="What the club records — MIDO never estimates it.">
            <NumberInput value={form.squadSize} onChange={(v) => set({ squadSize: v })} placeholder="20" />
          </Field>
        </div>

        <FormError error={error} />
      </Modal>
    </>
  );
}
