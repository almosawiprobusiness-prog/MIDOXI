"use client";

import { useState, useTransition } from "react";
import { Loader2, Check } from "lucide-react";
import { saveBrand } from "@/app/app/delivery/actions";
import { INK, MIN_CONTRAST, contrast, hexIssue, normalizeHex, readableOn } from "@/lib/brand/identity";

/*
  The client's identity, edited.

  The preview does the explaining. A club types navy, sees that navy scores
  2.1 against the document ground, and sees the exact lighter navy their text
  will use — so the derivation in `readableOn` is visible rather than a
  surprise when the first document arrives. Composition is imported from the
  same pure module the server renders with, so what is previewed here is what
  is produced there.
*/

export function BrandPanel({
  initial,
}: {
  initial: { name: string; shortName: string; crestUrl: string; primary: string };
}) {
  const [form, setForm] = useState(initial);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, start] = useTransition();

  const set = (k: keyof typeof form, v: string) => {
    setForm((f) => ({ ...f, [k]: v }));
    setSaved(false);
  };

  const hex = normalizeHex(form.primary);
  const issue = hexIssue(form.primary);
  const ratio = hex ? contrast(hex, INK) : null;
  const derived = hex ? readableOn(hex) : null;
  const needsLift = ratio !== null && ratio < MIN_CONTRAST;

  const submit = () => {
    setError(null);
    start(async () => {
      const res = await saveBrand(form);
      if (res.ok) setSaved(true);
      else setError(res.error);
    });
  };

  const field = "mt-1.5 h-9 w-full rounded-lg border border-line bg-ink-900 px-3 text-sm text-text placeholder:text-text-faint focus:border-signal-line focus:outline-none";

  return (
    <div className="panel p-4">
      <div className="label-tech">Client identity</div>
      <p className="mt-1 text-xs leading-relaxed text-text-faint">
        What a delivered document looks like it came from. This is most of what Managed sells.
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="b-name" className="label-tech">Club name</label>
          <input id="b-name" value={form.name} onChange={(e) => set("name", e.target.value)}
                 className={field} placeholder="Northgate FC" />
        </div>
        <div>
          <label htmlFor="b-short" className="label-tech">Short name</label>
          <input id="b-short" value={form.shortName} onChange={(e) => set("shortName", e.target.value)}
                 className={field} placeholder="Northgate" />
        </div>
        <div>
          <label htmlFor="b-crest" className="label-tech">Crest URL</label>
          <input id="b-crest" value={form.crestUrl} onChange={(e) => set("crestUrl", e.target.value)}
                 className={field} placeholder="https://…" />
        </div>
        <div>
          <label htmlFor="b-colour" className="label-tech">Club colour</label>
          <div className="mt-1.5 flex items-center gap-2">
            <span
              aria-hidden
              className="size-9 shrink-0 rounded-lg border border-line"
              style={{ background: hex ?? "transparent" }}
            />
            <input
              id="b-colour"
              value={form.primary}
              onChange={(e) => set("primary", e.target.value)}
              className="h-9 w-full rounded-lg border border-line bg-ink-900 px-3 font-mono text-sm text-text placeholder:text-text-faint focus:border-signal-line focus:outline-none"
              placeholder="#1B3A6B"
            />
          </div>
        </div>
      </div>

      {issue && <p className="mt-2 text-xs text-correction">{issue}</p>}

      {/* The derivation, made visible. */}
      {hex && derived && ratio !== null && (
        <div className="mt-4 rounded-lg border border-line bg-ink-850 p-3">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
            <span className="text-text-faint">
              Contrast on the document ground:{" "}
              <span className="data-mono" style={{ color: needsLift ? "var(--caution)" : "var(--positive)" }}>
                {ratio.toFixed(1)}:1
              </span>
            </span>
            <span className="text-text-faint">
              Fills use <span className="data-mono" style={{ color: derived }}>{hex}</span>
            </span>
            {needsLift && (
              <span className="text-text-faint">
                Text uses <span className="data-mono" style={{ color: derived }}>{derived}</span>
              </span>
            )}
          </div>
          <p className="mt-2 text-[11px] leading-relaxed text-text-faint">
            {needsLift
              ? `Below ${MIN_CONTRAST}:1 nobody can read it, so text is lifted just far enough to be legible. The colour on rules and the crest stays exactly as you set it.`
              : "Readable as-is — used unchanged everywhere."}
          </p>
        </div>
      )}

      <div className="mt-4 flex items-center gap-3">
        <button
          type="button"
          onClick={submit}
          disabled={busy || !form.name.trim()}
          className="flex h-9 items-center gap-2 rounded-lg bg-signal px-3.5 text-sm font-medium text-white transition-colors hover:bg-signal-deep disabled:opacity-60"
        >
          {busy && <Loader2 className="size-3.5 animate-spin" />}
          Save identity
        </button>
        {saved && (
          <span className="flex items-center gap-1.5 text-xs text-positive">
            <Check className="size-3.5" /> Saved
          </span>
        )}
        {error && <span className="text-xs text-correction">{error}</span>}
      </div>
    </div>
  );
}
