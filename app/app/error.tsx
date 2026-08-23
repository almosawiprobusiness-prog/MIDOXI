"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, RotateCw } from "lucide-react";

/*
  An error boundary *inside* the workspace.

  Without this, a failure on any one page bubbles to the root boundary and takes
  the entire shell with it — sidebar, command bar and all — so a broken
  Assessments page looks like a broken product. This one keeps the shell
  mounted: navigation still works, and the user can walk away from the page that
  failed instead of reloading the app.
*/
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[workspace-error]", error.digest ?? "", error.message);
  }, [error]);

  return (
    <div className="mx-auto max-w-[700px] px-4 py-12 md:px-6">
      <div className="panel-raised p-8">
        <span className="grid size-11 place-items-center rounded-lg border border-review/30 bg-review/10 text-review">
          <AlertTriangle className="size-5" />
        </span>
        <h1 className="mt-4 font-display text-xl font-bold text-text-hi">
          This section could not load
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-text-dim">
          Something went wrong fetching this page. The rest of MIDO XI is still working — use the
          navigation to carry on, or try this screen again.
        </p>
        {error.digest && (
          <p className="data-mono mt-3 text-[11px] text-text-faint">ref {error.digest}</p>
        )}
        <div className="mt-6 flex flex-wrap items-center gap-2">
          <button
            onClick={reset}
            className="inline-flex items-center gap-2 rounded-lg bg-signal px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-signal-deep"
          >
            <RotateCw className="size-4" /> Try again
          </button>
          <Link
            href="/app"
            className="inline-flex items-center gap-2 rounded-lg border border-line bg-ink-850 px-4 py-2 text-sm font-medium text-text transition-colors hover:border-line-strong"
          >
            Back to the start
          </Link>
        </div>
      </div>
    </div>
  );
}
