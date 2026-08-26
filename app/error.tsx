"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, RotateCw } from "lucide-react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[root-error]", error.digest ?? "", error.message);
    // Relay to the server log — the browser console is invisible to us.
    fetch("/api/client-error", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        boundary: "root",
        path: window.location.pathname,
        digest: error.digest ?? "",
        message: error.message,
      }),
    }).catch(() => {});
  }, [error]);

  return (
    <div className="grid min-h-[70vh] place-items-center px-4">
      <div className="panel-raised max-w-md p-8 text-center">
        <span className="mx-auto grid size-12 place-items-center rounded-xl border border-review/30 bg-review/10 text-review">
          <AlertTriangle className="size-6" />
        </span>
        <h1 className="mt-4 font-display text-xl font-bold text-text-hi">Something broke on our side</h1>
        <p className="mt-2 text-sm text-text-dim">
          This screen hit an unexpected error. It’s been logged. Try again, or head back to the Locker.
        </p>
        {error.digest && <p className="data-mono mt-3 text-[11px] text-text-faint">ref {error.digest}</p>}
        <div className="mt-6 flex items-center justify-center gap-2">
          <button
            onClick={reset}
            className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-br from-signal to-signal-deep px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-95"
          >
            <RotateCw className="size-4" /> Try again
          </button>
          <Link
            href="/app"
            className="inline-flex items-center gap-2 rounded-lg border border-line bg-ink-850 px-4 py-2 text-sm font-medium text-text transition-colors hover:border-line-strong"
          >
            The Locker
          </Link>
        </div>
      </div>
    </div>
  );
}
