"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil } from "lucide-react";
import { addStaff, editStaff, removeStaff } from "@/app/app/teams/actions";
import {
  STAFF_ROLES,
  STAFF_STATUS,
  type ClubTeamRow,
  type StaffInput,
  type StaffMember,
  type StaffRole,
  type StaffStatus,
} from "@/lib/data/club-types";
import { Modal, Field, TextInput, TextArea, ChipPicker, FormError, SubmitRow, ConfirmDelete } from "@/components/forms/ui";

function empty(teamId: string | null): StaffInput {
  return { name: "", email: "", role: "coach", teamId, status: "recorded", notes: "" };
}

export function StaffForm({
  mode,
  staff,
  teams,
  presetTeamId = null,
}: {
  mode: "create" | "edit";
  staff?: StaffMember;
  teams: ClubTeamRow[];
  presetTeamId?: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<StaffInput>(
    mode === "edit" && staff
      ? {
          name: staff.name,
          email: staff.email,
          role: staff.role,
          teamId: staff.teamId,
          status: staff.status,
          notes: staff.notes,
        }
      : empty(presetTeamId),
  );

  const set = (patch: Partial<StaffInput>) => setForm((f) => ({ ...f, ...patch }));

  const submit = async () => {
    setBusy(true);
    setError(null);
    const res = mode === "create" ? await addStaff(form) : await editStaff(staff!.id, form);
    setBusy(false);
    if (res.ok) {
      setOpen(false);
      if (mode === "create") setForm(empty(presetTeamId));
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
          <Plus className="size-4" /> Add staff
        </button>
      ) : (
        <button
          onClick={() => setOpen(true)}
          aria-label="Edit staff member"
          className="flex size-8 items-center justify-center rounded-lg border border-line text-text-dim transition-colors hover:border-signal-line hover:text-signal-bright"
        >
          <Pencil className="size-3.5" />
        </button>
      )}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        eyebrow={mode === "create" ? "New staff member" : "Edit staff member"}
        title="Staff"
        footer={
          <div className="flex items-center gap-2">
            {mode === "edit" && staff && (
              <ConfirmDelete
                onConfirm={async () => {
                  await removeStaff(staff.id);
                  setOpen(false);
                  router.refresh();
                }}
                label="Remove"
              />
            )}
            <div className="flex-1">
              <SubmitRow
                onCancel={() => setOpen(false)}
                onSubmit={submit}
                busy={busy}
                label={mode === "create" ? "Add to the club" : "Save"}
                disabled={!form.name.trim()}
              />
            </div>
          </div>
        }
      >
        <div className="grid grid-cols-2 gap-3">
          <Field label="Name" span>
            <TextInput value={form.name} onChange={(v) => set({ name: v })} placeholder="A. Whitlock" />
          </Field>
          <Field label="Email" span hint="Used to link their MIDO XI account when invites arrive.">
            <TextInput value={form.email} onChange={(v) => set({ email: v })} placeholder="optional" />
          </Field>
          <Field label="Team" span>
            <select
              value={form.teamId ?? ""}
              onChange={(e) => set({ teamId: e.target.value || null })}
              className="h-10 w-full rounded-lg border border-line bg-ink-850 px-3 text-sm text-text-hi focus:border-signal-line focus:outline-none"
            >
              <option value="">Across the club</option>
              {teams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <div className="mt-3">
          <span className="label-tech mb-1 block">Role</span>
          <ChipPicker<StaffRole>
            value={form.role}
            onChange={(v) => set({ role: v })}
            options={STAFF_ROLES.map((r) => ({ value: r.value, label: r.label, color: r.color }))}
          />
        </div>

        <div className="mt-3">
          <span className="label-tech mb-1 block">Status</span>
          <ChipPicker<StaffStatus>
            value={form.status}
            onChange={(v) => set({ status: v })}
            options={STAFF_STATUS.map((s) => ({ value: s.value, label: s.label, color: s.color }))}
          />
          <p className="mt-1.5 text-[11px] leading-relaxed text-text-faint">
            &ldquo;Recorded&rdquo; is a person the club tracks. &ldquo;Active&rdquo; means they are working
            here. Account linking arrives with invites — this record works fully without it.
          </p>
        </div>

        <div className="mt-3">
          <Field label="Notes" span>
            <TextArea value={form.notes} onChange={(v) => set({ notes: v })} rows={2} placeholder="Responsibilities, availability…" />
          </Field>
        </div>

        <FormError error={error} />
      </Modal>
    </>
  );
}
