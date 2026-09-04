"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Loader2, PackageCheck, Check } from "lucide-react";
import { prepareForClient } from "@/app/app/delivery/actions";
import type { DeliverableKind } from "@/lib/data/deliverable-types";

/*
  Send a piece of work into the review queue.

  It lives ON the work rather than as a "new deliverable" form, because that
  is the order the job actually happens in: you write the session, then you
  decide it is ready for the client. A blank form would ask the operator to
  retype what they just made, and would let a deliverable exist that points
  at nothing.

  It creates a DRAFT, never anything further along. Preparing something is
  not the same as approving it, and the one thing this queue exists to
  guarantee is that a person reads it before the client does.
*/

export function PrepareForClient({
  title,
  kind,
  entityType,
  entityId,
  aiDrafted = false,
}: {
  title: string;
  kind: DeliverableKind;
  entityType: string;
  entityId: string;
  /** True when MIDO drafted this, so the queue can say who wrote it. */
  aiDrafted?: boolean;
}) {
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, start] = useTransition();

  const go = () => {
    setError(null);
    start(async () => {
      const res = await prepareForClient({ title, kind, entityType, entityId, aiDrafted });
      if (res.ok) setDone(true);
      else setError(res.error);
    });
  };

  if (done) {
    return (
      <div className="flex flex-wrap items-center gap-2 text-xs text-positive">
        <Check className="size-3.5" />
        In the delivery queue as a draft.
        <Link href="/app/delivery" className="text-signal-bright underline underline-offset-2">
          Open it
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={go}
        disabled={busy}
        className="flex h-8 items-center gap-1.5 rounded-lg border border-line px-2.5 text-xs text-text-dim transition-colors hover:border-signal-line hover:text-signal-bright disabled:opacity-50"
      >
        {busy ? <Loader2 className="size-3 animate-spin" /> : <PackageCheck className="size-3" />}
        Prepare for the client
      </button>
      {error && <span className="text-xs text-correction">{error}</span>}
    </div>
  );
}
