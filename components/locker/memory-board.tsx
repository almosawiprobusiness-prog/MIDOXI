"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, Pencil, Plus, Sparkles, Trash2, X } from "lucide-react";
import { createMemory, editMemory, forgetMemory } from "@/app/app/memory/actions";
import {
  MEMORY_KINDS,
  MEMORY_MAX,
  memoryIssue,
  memoryMeta,
  type Memory,
  type MemoryKind,
} from "@/lib/data/memory-types";
import type { MemoryProposal } from "@/lib/data/memory";
import { FormError } from "@/components/forms/ui";
import { cn } from "@/lib/utils";

/*
  What MIDO remembers, in the player's hands.

  The design rule is that nothing here is read-only. Every fact can be edited,
  every fact can be deleted, and a suggestion is a suggestion until it is
  accepted. A memory is injected into every future prompt, so one the player
  cannot argue with would quietly steer every answer they ever get.

  Suggestions carry their arithmetic — "4 pieces of evidence since April" —
  because a proposal that cannot show its working is indistinguishable from a
  guess, and this product does not make those.
*/

export function MemoryBoard({
  memories,
  proposals,
}: {
  memories: Memory[];
  proposals: MemoryProposal[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState<MemoryKind | null>(null);
  const [draft, setDraft] = useState("");
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  const save = (kind: MemoryKind, body: string, extra?: { because?: string; concept?: string | null }) =>
    start(async () => {
      setError(null);
      const res = await createMemory({
        kind,
        body,
        because: extra?.because ?? null,
        concept: extra?.concept ?? null,
        fromProposal: Boolean(extra?.because),
      });
      if (res.ok) {
        setAdding(null);
        setDraft("");
        router.refresh();
      } else setError(res.error);
    });

  const open = proposals.filter((p) => !dismissed.has(p.body));

  return (
    <div className="space-y-8">
      {/* ── what MIDO could remember ── */}
      {open.length > 0 && (
        <section>
          <div className="mb-3 flex items-center gap-2">
            <Sparkles className="size-4 text-signal-bright" />
            <h2 className="label-tech">Worth remembering</h2>
          </div>
          <p className="mb-3 text-xs leading-relaxed text-text-faint">
            Counted from your own record, not guessed. Each one says what it is based on — you can
            go and check it. Nothing is remembered until you say so.
          </p>
          <div className="min-w-0 panel divide-y divide-line">
            {open.map((p) => {
              const meta = memoryMeta(p.kind);
              return (
                <div key={p.body} className="flex flex-wrap items-start gap-3 p-4">
                  <meta.icon className="mt-0.5 size-4 shrink-0" style={{ color: meta.color }} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm leading-relaxed text-text-hi">{p.body}</p>
                    <p className="mt-1 text-xs leading-relaxed text-text-faint">{p.because}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <button
                      onClick={() => save(p.kind, p.body, { because: p.because, concept: p.concept })}
                      disabled={pending}
                      className="flex h-8 items-center gap-1.5 rounded-lg border border-signal-line bg-signal/10 px-2.5 text-xs font-medium text-signal-bright transition-colors hover:bg-signal/20 disabled:opacity-50"
                    >
                      <Check className="size-3.5" /> Remember
                    </button>
                    <button
                      onClick={() => setDismissed((d) => new Set(d).add(p.body))}
                      aria-label="Not this one"
                      className="text-text-faint transition-colors hover:text-text"
                    >
                      <X className="size-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* ── the kinds ── */}
      {MEMORY_KINDS.map((meta) => {
        const items = memories.filter((m) => m.kind === meta.kind);
        const isAdding = adding === meta.kind;
        return (
          <section key={meta.kind}>
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <meta.icon className="size-4" style={{ color: meta.color }} />
              <h2 className="label-tech">{meta.label}</h2>
              <span className="text-xs text-text-faint">{meta.effect}</span>
              <button
                onClick={() => {
                  setAdding(isAdding ? null : meta.kind);
                  setDraft("");
                  setError(null);
                }}
                className="ml-auto flex items-center gap-1 text-xs text-text-dim transition-colors hover:text-signal-bright"
              >
                <Plus className="size-3.5" />
                Add
              </button>
            </div>

            <div className="min-w-0 panel divide-y divide-line">
              {items.length === 0 && !isAdding && (
                <p className="px-4 py-3 text-sm text-text-faint">Nothing yet.</p>
              )}

              {items.map((m) => (
                <MemoryRow key={m.id} memory={m} onError={setError} />
              ))}

              {isAdding && (
                <div className="p-4">
                  <textarea
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    placeholder={meta.example}
                    rows={2}
                    maxLength={MEMORY_MAX}
                    autoFocus
                    className="w-full resize-none rounded-lg border border-line bg-ink-850 px-3 py-2 text-sm text-text-hi placeholder:text-text-faint focus:border-signal-line focus:outline-none"
                  />
                  <div className="mt-2 flex items-center gap-2">
                    <button
                      onClick={() => save(meta.kind, draft)}
                      disabled={pending || Boolean(memoryIssue(draft))}
                      className="flex h-8 items-center gap-1.5 rounded-lg border border-signal-line bg-signal/10 px-2.5 text-xs font-medium text-signal-bright transition-colors hover:bg-signal/20 disabled:opacity-50"
                    >
                      {pending ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
                      Remember
                    </button>
                    <button
                      onClick={() => setAdding(null)}
                      className="h-8 rounded-lg border border-line px-2.5 text-xs text-text-dim transition-colors hover:text-text"
                    >
                      Cancel
                    </button>
                    <span className="ml-auto data-mono text-[10px] text-text-faint">
                      {draft.length}/{MEMORY_MAX}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </section>
        );
      })}

      <FormError error={error} />
    </div>
  );
}

function MemoryRow({ memory, onError }: { memory: Memory; onError: (e: string) => void }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(memory.body);

  const commit = () =>
    start(async () => {
      const res = await editMemory(memory.id, draft);
      if (res.ok) {
        setEditing(false);
        router.refresh();
      } else onError(res.error);
    });

  const forget = () =>
    start(async () => {
      const res = await forgetMemory(memory.id);
      if (res.ok) router.refresh();
      else onError(res.error);
    });

  if (editing) {
    return (
      <div className="p-4">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={2}
          maxLength={MEMORY_MAX}
          autoFocus
          className="w-full resize-none rounded-lg border border-line bg-ink-850 px-3 py-2 text-sm text-text-hi focus:border-signal-line focus:outline-none"
        />
        <div className="mt-2 flex items-center gap-2">
          <button
            onClick={commit}
            disabled={pending || Boolean(memoryIssue(draft))}
            className="flex h-8 items-center gap-1.5 rounded-lg border border-signal-line bg-signal/10 px-2.5 text-xs font-medium text-signal-bright disabled:opacity-50"
          >
            {pending ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
            Save
          </button>
          <button
            onClick={() => {
              setDraft(memory.body);
              setEditing(false);
            }}
            className="h-8 rounded-lg border border-line px-2.5 text-xs text-text-dim"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="group flex items-start gap-3 p-4">
      <div className="min-w-0 flex-1">
        <p className="text-sm leading-relaxed text-text">{memory.body}</p>
        {memory.because && (
          <p className="mt-1 text-xs leading-relaxed text-text-faint">{memory.because}</p>
        )}
      </div>
      <div className={cn("flex shrink-0 items-center gap-2 transition-opacity", pending && "opacity-50")}>
        <button
          onClick={() => setEditing(true)}
          aria-label="Edit"
          className="text-text-faint transition-colors hover:text-text"
        >
          <Pencil className="size-3.5" />
        </button>
        <button
          onClick={forget}
          disabled={pending}
          aria-label="Forget this"
          className="text-text-faint transition-colors hover:text-correction"
        >
          <Trash2 className="size-3.5" />
        </button>
      </div>
    </div>
  );
}
