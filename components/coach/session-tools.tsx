"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, ChevronUp, ChevronDown, Loader2, Sparkles, Trash2 } from "lucide-react";
import { addBlock, editBlock, removeBlock, moveBlock, draftWithMido } from "@/app/app/sessions/actions";
import {
  SESSION_PHASES,
  type SessionBlock,
  type SessionBlockInput,
  type SessionPhase,
} from "@/lib/data/coach-types";
import { Modal, Field, TextInput, NumberInput, TextArea, ChipPicker, ListEditor, FormError, FormNote, SubmitRow } from "@/components/forms/ui";

function empty(): SessionBlockInput {
  return {
    phase: "technical",
    name: "",
    durationMin: 15,
    organisation: "",
    coachingPoints: [],
    progression: "",
    regression: "",
  };
}

export function BlockForm({
  planId,
  mode,
  block,
}: {
  planId: string;
  mode: "create" | "edit";
  block?: SessionBlock;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<SessionBlockInput>(
    mode === "edit" && block
      ? {
          phase: block.phase,
          name: block.name,
          durationMin: block.durationMin,
          organisation: block.organisation,
          coachingPoints: block.coachingPoints,
          progression: block.progression,
          regression: block.regression,
        }
      : empty(),
  );

  const set = (patch: Partial<SessionBlockInput>) => setForm((f) => ({ ...f, ...patch }));

  const submit = async () => {
    setBusy(true);
    setError(null);
    const res =
      mode === "create" ? await addBlock(planId, form) : await editBlock(planId, block!.id, form);
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
          className="flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-dashed border-line-strong text-sm text-text-dim transition-colors hover:border-signal-line hover:text-signal-bright"
        >
          <Plus className="size-4" /> Add a block
        </button>
      ) : (
        <button
          onClick={() => setOpen(true)}
          aria-label="Edit block"
          className="flex size-7 items-center justify-center rounded-md border border-line text-text-faint transition-colors hover:border-signal-line hover:text-signal-bright"
        >
          <Pencil className="size-3" />
        </button>
      )}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        wide
        eyebrow={mode === "create" ? "New block" : "Edit block"}
        title="Session block"
        footer={
          <SubmitRow
            onCancel={() => setOpen(false)}
            onSubmit={submit}
            busy={busy}
            label={mode === "create" ? "Add block" : "Save block"}
            disabled={!form.name.trim()}
          />
        }
      >
        <div>
          <span className="label-tech mb-1 block">Phase</span>
          <ChipPicker<SessionPhase>
            value={form.phase}
            onChange={(v) => set({ phase: v })}
            options={SESSION_PHASES.map((p) => ({ value: p.phase, label: p.label, color: p.color }))}
          />
        </div>

        <div className="mt-3 grid grid-cols-3 gap-3">
          <Field label="Name" span>
            <TextInput value={form.name} onChange={(v) => set({ name: v })} placeholder="Counter-press triggers" />
          </Field>
          <Field label="Minutes">
            <NumberInput value={form.durationMin} onChange={(v) => set({ durationMin: v })} placeholder="15" />
          </Field>
        </div>

        <div className="mt-3">
          <Field label="Organisation" hint="Area, numbers, rules, service — enough for an assistant to set it up.">
            <TextArea
              value={form.organisation}
              onChange={(v) => set({ organisation: v })}
              rows={2}
              placeholder="30x25m. Ball served to a target; the losing team has five seconds to win it back."
            />
          </Field>
        </div>

        <div className="mt-3">
          <span className="label-tech mb-1 block">Coaching points</span>
          <ListEditor
            items={form.coachingPoints}
            onChange={(v) => set({ coachingPoints: v })}
            placeholder="Short and shoutable — press the touch, not the pass"
          />
        </div>

        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <Field label="Progression">
            <TextInput value={form.progression} onChange={(v) => set({ progression: v })} placeholder="Harder" />
          </Field>
          <Field label="Regression">
            <TextInput value={form.regression} onChange={(v) => set({ regression: v })} placeholder="Easier" />
          </Field>
        </div>

        <FormError error={error} />
      </Modal>
    </>
  );
}

export function BlockControls({
  planId,
  blockId,
  first,
  last,
}: {
  planId: string;
  blockId: string;
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
        onClick={() => run(() => moveBlock(planId, blockId, -1))}
        disabled={first || pending}
        aria-label="Move up"
        className="flex size-7 items-center justify-center rounded-md border border-line text-text-faint transition-colors hover:border-signal-line hover:text-signal-bright disabled:opacity-30"
      >
        <ChevronUp className="size-3" />
      </button>
      <button
        onClick={() => run(() => moveBlock(planId, blockId, 1))}
        disabled={last || pending}
        aria-label="Move down"
        className="flex size-7 items-center justify-center rounded-md border border-line text-text-faint transition-colors hover:border-signal-line hover:text-signal-bright disabled:opacity-30"
      >
        <ChevronDown className="size-3" />
      </button>
      <button
        onClick={() => run(() => removeBlock(planId, blockId))}
        disabled={pending}
        aria-label="Delete block"
        className="flex size-7 items-center justify-center rounded-md border border-line text-text-faint transition-colors hover:border-correction/40 hover:text-correction disabled:opacity-30"
      >
        {pending ? <Loader2 className="size-3 animate-spin" /> : <Trash2 className="size-3" />}
      </button>
    </div>
  );
}

/** MIDO drafts the whole session from the objective. The coach then edits it. */
export function DraftButton({ planId, hasBlocks }: { planId: string; hasBlocks: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [armed, setArmed] = useState(false);

  const draft = () => {
    setError(null);
    setNote(null);
    setArmed(false);
    start(async () => {
      const res = await draftWithMido(planId);
      if (res.ok) {
        setNote(res.message ?? null);
        router.refresh();
      } else {
        setError(res.error);
      }
    });
  };

  return (
    <div>
      {hasBlocks && armed ? (
        <div className="flex items-center gap-2">
          <button
            onClick={draft}
            className="flex h-9 items-center gap-2 rounded-lg border border-correction/40 bg-correction/10 px-3 text-sm text-correction transition-colors hover:bg-correction/20"
          >
            Replace {hasBlocks ? "existing blocks" : ""}
          </button>
          <button
            onClick={() => setArmed(false)}
            className="h-9 rounded-lg border border-line px-3 text-sm text-text-dim transition-colors hover:text-text"
          >
            Cancel
          </button>
        </div>
      ) : (
        <button
          onClick={() => (hasBlocks ? setArmed(true) : draft())}
          disabled={pending}
          className="flex h-9 items-center gap-2 rounded-lg border border-signal-line bg-signal/10 px-3 text-sm font-medium text-signal-bright transition-colors hover:bg-signal/20 disabled:opacity-60"
        >
          {pending ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
          Draft with MIDO
        </button>
      )}
      <FormError error={error} />
      <FormNote message={note} />
    </div>
  );
}
