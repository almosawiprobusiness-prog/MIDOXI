"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, FilePlus2 } from "lucide-react";
import { supersede } from "@/app/app/delivery/actions";

/*
  Replace work the client has already read.

  `delivered` is terminal, and the gate answers any attempt to edit it with
  "supersede it with a new version rather than editing it". This is that
  version. It is the only thing on the page for a delivered deliverable,
  because it is the only honest move left.

  IT ASKS FIRST. Superseding withdraws the client's link — if they are looking
  at the document right now, it stops working — so the consequence is stated
  before the button does anything, not after.
*/

export function SupersedeButton({ id }: { id: string }) {
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, start] = useTransition();
  const router = useRouter();

  const go = () => {
    setError(null);
    start(async () => {
      const res = await supersede(id);
      if (res.ok && res.newId) router.push(`/app/delivery/${res.newId}`);
      else if (!res.ok) setError(res.error);
    });
  };

  if (!confirming) {
    return (
      <div>
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="flex h-8 items-center gap-1.5 rounded-lg border border-line px-2.5 text-xs text-text-dim transition-colors hover:border-signal-line hover:text-signal-bright"
        >
          <FilePlus2 className="size-3" />
          Supersede with a new version
        </button>
        <p className="mt-2 text-[11px] leading-relaxed text-text-faint">
          This one stays on the record as sent. Correcting it means a new document, not a rewrite of
          the one they have.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-line bg-ink-850 p-3">
      <p className="text-xs leading-relaxed text-text">
        A new draft will be created from the same work, and{" "}
        <span className="text-text-hi">this version&rsquo;s link will stop working</span> — if the
        client has it open, it will go dead. The new draft goes through review like any other.
      </p>
      <div className="mt-3 flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={go}
          disabled={busy}
          className="flex h-8 items-center gap-1.5 rounded-lg bg-signal px-2.5 text-xs font-medium text-white transition-colors hover:bg-signal-deep disabled:opacity-50"
        >
          {busy && <Loader2 className="size-3 animate-spin" />}
          Create the new version
        </button>
        <button
          type="button"
          onClick={() => setConfirming(false)}
          disabled={busy}
          className="flex h-8 items-center rounded-lg border border-line px-2.5 text-xs text-text-dim transition-colors hover:text-text disabled:opacity-50"
        >
          Keep it as it is
        </button>
      </div>
      {error && <p className="mt-2 text-xs text-correction">{error}</p>}
    </div>
  );
}

/** Shown on a deliverable that has been replaced. */
export function SupersededNote({ newId }: { newId: string }) {
  return (
    <p className="text-xs leading-relaxed text-text-dim">
      This version was replaced.{" "}
      <Link
        href={`/app/delivery/${newId}`}
        className="text-signal-bright underline underline-offset-2"
      >
        Open the version that replaced it
      </Link>
      . Its link was withdrawn when the new one was created.
    </p>
  );
}
