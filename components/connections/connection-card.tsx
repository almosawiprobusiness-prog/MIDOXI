"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Unlink, ChevronDown } from "lucide-react";
import { changeScope } from "@/app/app/connections/actions";
import {
  LINK_KINDS,
  SHARE_SCOPES,
  scopeMeta,
  type Connection,
  type ShareScope,
} from "@/lib/data/connection-types";
import { FormError, FormNote } from "@/components/forms/ui";
import { cn } from "@/lib/utils";

/*
  One connection, from the linked person's side.

  The control that matters is here, not on the coach's screen: change what is
  shared, or end it. Both go straight to the database, so revoking actually
  removes access rather than hiding a card.
*/
export function ConnectionCard({ connection }: { connection: Connection }) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [pending, start] = useTransition();

  const kind = LINK_KINDS[connection.kind];
  const meta = connection.scope ? scopeMeta(connection.scope) : null;

  const apply = (scope: ShareScope | "none") => {
    setError(null);
    setNote(null);
    setConfirming(false);
    start(async () => {
      const res = await changeScope(connection.kind, connection.id, scope);
      if (res.ok) {
        setNote(res.message ?? null);
        setExpanded(false);
        router.refresh();
      } else {
        setError(res.error);
      }
    });
  };

  return (
    <div className="panel overflow-hidden">
      <div className="flex flex-wrap items-center gap-3 p-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="chip chip-signal">{kind.label}</span>
            <span className="truncate text-sm font-medium text-text-hi">{connection.holder}</span>
          </div>
          <div className="mt-0.5 truncate text-xs text-text-dim">
            Recorded as {connection.label || "an unnamed record"}
          </div>
        </div>

        {meta ? (
          <button
            onClick={() => setExpanded((v) => !v)}
            className="flex items-center gap-1.5 rounded-lg border border-line px-2.5 py-1.5 text-xs transition-colors hover:border-line-strong"
            style={{ color: meta.color }}
          >
            {meta.label}
            <ChevronDown className={cn("size-3 transition-transform", expanded && "rotate-180")} />
          </button>
        ) : (
          <span className="chip">staff</span>
        )}
      </div>

      {expanded && meta && (
        <div className="border-t border-line p-4">
          <div className="label-tech mb-2">What they can see</div>
          <div className="space-y-2">
            {SHARE_SCOPES.map((s) => {
              const active = connection.scope === s.value;
              return (
                <button
                  key={s.value}
                  onClick={() => apply(s.value)}
                  disabled={pending}
                  className={cn(
                    "flex w-full items-start gap-3 rounded-lg border p-3 text-left transition-colors disabled:opacity-60",
                    active ? "border-signal-line bg-signal/10" : "border-line hover:border-line-strong",
                  )}
                >
                  <span
                    className={cn(
                      "mt-0.5 grid size-4 shrink-0 place-items-center rounded-full border",
                      active ? "border-signal-bright" : "border-line-strong",
                    )}
                  >
                    {active && <span className="size-2 rounded-full bg-signal-bright" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm text-text-hi">{s.label}</span>
                    <span className="mt-0.5 block text-xs leading-relaxed text-text-dim">{s.summary}</span>
                  </span>
                </button>
              );
            })}
          </div>

          <div className="mt-3 border-t border-line pt-3">
            {confirming ? (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-text-dim">
                  They keep their own notes, but lose access to everything of yours.
                </span>
                <button
                  onClick={() => apply("none")}
                  disabled={pending}
                  className="flex h-9 items-center gap-1.5 rounded-lg border border-correction/40 bg-correction/10 px-3 text-sm text-correction transition-colors hover:bg-correction/20"
                >
                  {pending ? <Loader2 className="size-3.5 animate-spin" /> : <Unlink className="size-3.5" />}
                  Disconnect
                </button>
                <button
                  onClick={() => setConfirming(false)}
                  className="h-9 rounded-lg border border-line px-3 text-sm text-text-dim transition-colors hover:text-text"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirming(true)}
                className="flex h-9 items-center gap-1.5 rounded-lg border border-line px-3 text-sm text-text-dim transition-colors hover:border-correction/40 hover:text-correction"
              >
                <Unlink className="size-3.5" /> Disconnect
              </button>
            )}
          </div>
        </div>
      )}

      {(error || note) && (
        <div className="border-t border-line px-4 pb-3">
          <FormError error={error} />
          <FormNote message={note} />
        </div>
      )}
    </div>
  );
}
