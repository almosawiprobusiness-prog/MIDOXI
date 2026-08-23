import Link from "next/link";
import { Compass } from "lucide-react";

export default function NotFound() {
  return (
    <div className="grid min-h-[70vh] place-items-center px-4">
      <div className="panel-raised max-w-md p-8 text-center">
        <span className="mx-auto grid size-12 place-items-center rounded-xl border border-line bg-ink-850 text-signal-bright">
          <Compass className="size-6" />
        </span>
        <div className="data-mono mt-4 text-sm text-text-faint">404</div>
        <h1 className="mt-1 font-display text-xl font-bold text-text-hi">Off the pitch</h1>
        <p className="mt-2 text-sm text-text-dim">This page doesn’t exist — or moved. Let’s get you back.</p>
        <div className="mt-6 flex items-center justify-center gap-2">
          <Link
            href="/app"
            className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-br from-signal to-signal-deep px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-95"
          >
            The Locker
          </Link>
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-lg border border-line bg-ink-850 px-4 py-2 text-sm font-medium text-text transition-colors hover:border-line-strong"
          >
            Home
          </Link>
        </div>
      </div>
    </div>
  );
}
