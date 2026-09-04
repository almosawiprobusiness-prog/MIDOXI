"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Copy, Check, Link2Off } from "lucide-react";
import { withdrawDeliverableLink } from "@/app/app/delivery/actions";
import type { LinkState } from "@/lib/data/deliverable-link-types";

/*
  The link the client actually reads, and the ability to take it back.

  Shown only once something has been delivered, because the link does not exist
  before then — it is minted by the same write that sets the status, so there
  is no "generate link" button to press and no way to have one without having
  delivered.

  Withdrawing does not undeliver. The work was sent; that is a fact about the
  past. Only the reader's access ends, and the copy says so rather than
  implying the delivery can be taken back.
*/

export function ClientLink({
  id,
  url,
  state,
  expiresAt,
}: {
  id: string;
  url: string;
  state: LinkState;
  expiresAt: string | null;
}) {
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, start] = useTransition();
  const router = useRouter();

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard can be refused. The link is on screen and selectable, so
      // this is a convenience failing, not the feature failing.
      setError("Could not copy — select the link and copy it by hand.");
    }
  };

  const withdraw = () => {
    setError(null);
    start(async () => {
      const res = await withdrawDeliverableLink(id);
      if (res.ok) router.refresh();
      else setError(res.error);
    });
  };

  const when = expiresAt
    ? new Date(expiresAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
    : null;

  if (state === "revoked" || state === "expired") {
    return (
      <p className="text-xs text-text-dim">
        The client&rsquo;s link {state === "revoked" ? "was withdrawn" : "has expired"}. The work was
        still delivered — send a new version if they need to read it again.
      </p>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <code className="min-w-0 flex-1 truncate rounded-lg border border-line bg-ink-900 px-2.5 py-1.5 font-mono text-xs text-text-dim">
          {url}
        </code>
        <button
          type="button"
          onClick={copy}
          className="flex h-8 items-center gap-1.5 rounded-lg border border-line px-2.5 text-xs text-text-dim transition-colors hover:border-signal-line hover:text-signal-bright"
        >
          {copied ? <Check className="size-3 text-positive" /> : <Copy className="size-3" />}
          {copied ? "Copied" : "Copy"}
        </button>
        <button
          type="button"
          onClick={withdraw}
          disabled={busy}
          className="flex h-8 items-center gap-1.5 rounded-lg border border-line px-2.5 text-xs text-text-dim transition-colors hover:border-correction/60 hover:text-correction disabled:opacity-50"
        >
          {busy ? <Loader2 className="size-3 animate-spin" /> : <Link2Off className="size-3" />}
          Withdraw
        </button>
      </div>

      {when && (
        <p className="mt-2 text-[11px] leading-relaxed text-text-faint">
          Works until {when}. Every link expires — withdrawing ends access sooner, but the work stays
          delivered.
        </p>
      )}
      {error && <p className="mt-2 text-xs text-correction">{error}</p>}
    </div>
  );
}
