"use client";

import { Printer } from "lucide-react";

/*
  Print, which on every modern browser also means "Save as PDF".

  There is no PDF library behind this and there does not need to be one. The
  document is a real page; `@media print` in globals.css flips the dark palette
  to light and removes the app chrome, and the browser produces a proper vector
  PDF with selectable text. Nothing is uploaded, nothing is rendered on a
  server, and no copy exists anywhere except on the person's own machine.

  That last part is worth saying out loud on a page about a young player.
*/

export function PrintButton({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="no-print mb-6 panel flex flex-wrap items-center gap-3 p-4">
      <div className="min-w-0 flex-1">
        <h2 className="text-sm font-medium text-text-hi">{title}</h2>
        <p className="text-xs leading-relaxed text-text-dim">{detail}</p>
      </div>
      <button
        onClick={() => window.print()}
        className="flex h-10 shrink-0 items-center gap-2 rounded-lg border border-signal-line bg-signal/10 px-4 text-sm font-medium text-signal-bright transition-colors hover:bg-signal/20"
      >
        <Printer className="size-4" />
        Print / save as PDF
      </button>
    </div>
  );
}
