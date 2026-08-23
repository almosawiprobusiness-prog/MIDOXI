"use client";

import { useState, useTransition } from "react";
import { Plus, Loader2 } from "lucide-react";
import { newBoard } from "@/app/app/tactics/actions";
import { FORMATION_NAMES } from "@/lib/data/coach-types";
import { Modal, Field, TextInput, FormError, SubmitRow } from "@/components/forms/ui";
import { cn } from "@/lib/utils";

export function NewBoardButton() {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [formation, setFormation] = useState("4-3-3");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const create = () => {
    setError(null);
    start(async () => {
      const res = await newBoard(formation, title);
      // A successful create redirects; only failures come back.
      if (res && !res.ok) setError(res.error);
    });
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex h-9 items-center gap-2 rounded-lg bg-signal px-3.5 text-sm font-medium text-white transition-colors hover:bg-signal-deep"
      >
        <Plus className="size-4" /> New board
      </button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        eyebrow="New board"
        title="Tactical board"
        footer={
          <SubmitRow
            onCancel={() => setOpen(false)}
            onSubmit={create}
            busy={pending}
            label={pending ? "Creating…" : "Create board"}
          />
        }
      >
        <Field label="Title" span>
          <TextInput value={title} onChange={setTitle} placeholder="Build-up vs a 4-4-2 press" />
        </Field>

        <div className="mt-3">
          <span className="label-tech mb-1 block">Starting shape</span>
          <div className="flex flex-wrap gap-1.5">
            {FORMATION_NAMES.map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFormation(f)}
                className={cn(
                  "rounded-lg border px-3 py-2 text-sm transition-colors",
                  formation === f
                    ? "border-signal-line bg-signal/10 text-signal-bright"
                    : "border-line text-text-dim hover:border-line-strong hover:text-text",
                )}
              >
                {f}
              </button>
            ))}
          </div>
          <p className="mt-2 text-[11px] leading-relaxed text-text-faint">
            Your eleven start in this shape, with a back four and midfield pair to play against. Move
            anyone, add or remove players, and draw the idea.
          </p>
        </div>

        {pending && (
          <p className="mt-3 flex items-center gap-2 text-xs text-text-dim">
            <Loader2 className="size-3.5 animate-spin" /> Opening the board…
          </p>
        )}
        <FormError error={error} />
      </Modal>
    </>
  );
}
