"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, ChevronUp, ChevronDown, Trash2, Loader2 } from "lucide-react";
import { addSection, editSection, removeSection, reorderSection } from "@/app/app/methodology/actions";
import {
  docMeta,
  type MethodologyDoc,
  type MethodologySection,
  type MethodologySectionInput,
} from "@/lib/data/club-types";
import { Modal, Field, TextInput, TextArea, ListEditor, FormError, SubmitRow, ConfirmDelete } from "@/components/forms/ui";

/*
  The methodology editor.

  Principles are the unit that matters: they are what MIDO reads when a coach in
  this club asks for a session. Everything else is context for the humans.
*/

function empty(doc: MethodologyDoc): MethodologySectionInput {
  return { doc, section: "", principles: [], detail: "", ageGroup: "" };
}

export function SectionForm({
  doc,
  mode,
  section,
  suggested,
}: {
  doc: MethodologyDoc;
  mode: "create" | "edit";
  section?: MethodologySection;
  suggested?: string[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<MethodologySectionInput>(
    mode === "edit" && section
      ? {
          doc: section.doc,
          section: section.section,
          principles: section.principles,
          detail: section.detail,
          ageGroup: section.ageGroup,
        }
      : empty(doc),
  );

  const set = (patch: Partial<MethodologySectionInput>) => setForm((f) => ({ ...f, ...patch }));
  const meta = docMeta(doc);

  const submit = async () => {
    setBusy(true);
    setError(null);
    const res = mode === "create" ? await addSection(form) : await editSection(section!.id, form);
    setBusy(false);
    if (res.ok) {
      setOpen(false);
      if (mode === "create") setForm(empty(doc));
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
          className="flex h-9 items-center gap-2 rounded-lg border border-signal-line bg-signal/10 px-3 text-sm font-medium text-signal-bright transition-colors hover:bg-signal/20"
        >
          <Plus className="size-4" /> Add a section
        </button>
      ) : (
        <button
          onClick={() => setOpen(true)}
          aria-label="Edit section"
          className="flex size-7 items-center justify-center rounded-md border border-line text-text-faint transition-colors hover:border-signal-line hover:text-signal-bright"
        >
          <Pencil className="size-3" />
        </button>
      )}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        wide
        eyebrow={meta.title}
        title={mode === "create" ? "New section" : "Edit section"}
        footer={
          <div className="flex items-center gap-2">
            {mode === "edit" && section && (
              <ConfirmDelete
                onConfirm={async () => {
                  await removeSection(section.id);
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
                label={mode === "create" ? "Add section" : "Save section"}
                disabled={!form.section.trim() || form.principles.length === 0}
              />
            </div>
          </div>
        }
      >
        <Field label="Section" span>
          <TextInput value={form.section} onChange={(v) => set({ section: v })} placeholder="Build-up" />
        </Field>

        {mode === "create" && suggested && suggested.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {suggested.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => set({ section: s })}
                className="chip chip-prose transition-colors hover:border-signal-line hover:text-signal-bright"
              >
                {s}
              </button>
            ))}
          </div>
        )}

        <div className="mt-4">
          <span className="label-tech mb-1 block" style={{ color: meta.color }}>
            Principles
          </span>
          <p className="mb-2 text-[11px] leading-relaxed text-text-faint">
            One per line, in your own words. These are what MIDO answers inside when a coach in this
            club asks for a session — nothing else in this form is read by the AI.
          </p>
          <ListEditor
            items={form.principles}
            onChange={(v) => set({ principles: v })}
            placeholder="Press the touch, not the pass"
            color={meta.color}
          />
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {doc === "develop" && (
            <Field label="Age group" hint="Leave blank when it applies across the club.">
              <TextInput value={form.ageGroup} onChange={(v) => set({ ageGroup: v })} placeholder="U15-U16" />
            </Field>
          )}
          <Field label="Detail" span={doc !== "develop"}>
            <TextArea
              value={form.detail}
              onChange={(v) => set({ detail: v })}
              rows={3}
              placeholder="Context for your staff — why this matters, and what it looks like."
            />
          </Field>
        </div>

        <FormError error={error} />
      </Modal>
    </>
  );
}

export function SectionControls({
  id,
  first,
  last,
}: {
  id: string;
  first: boolean;
  last: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  const run = (fn: () => Promise<unknown>) =>
    start(async () => {
      await fn();
      router.refresh();
    });

  return (
    <div className="flex items-center gap-1">
      <button
        onClick={() => run(() => reorderSection(id, -1))}
        disabled={first || pending}
        aria-label="Move up"
        className="flex size-7 items-center justify-center rounded-md border border-line text-text-faint transition-colors hover:border-signal-line hover:text-signal-bright disabled:opacity-30"
      >
        <ChevronUp className="size-3" />
      </button>
      <button
        onClick={() => run(() => reorderSection(id, 1))}
        disabled={last || pending}
        aria-label="Move down"
        className="flex size-7 items-center justify-center rounded-md border border-line text-text-faint transition-colors hover:border-signal-line hover:text-signal-bright disabled:opacity-30"
      >
        <ChevronDown className="size-3" />
      </button>
      <button
        onClick={() => run(() => removeSection(id))}
        disabled={pending}
        aria-label="Delete section"
        className="flex size-7 items-center justify-center rounded-md border border-line text-text-faint transition-colors hover:border-correction/40 hover:text-correction disabled:opacity-30"
      >
        {pending ? <Loader2 className="size-3 animate-spin" /> : <Trash2 className="size-3" />}
      </button>
    </div>
  );
}
