"use client";

import { useState, useTransition } from "react";
import { Check, Copy, Link2, Loader2, ShieldAlert, X } from "lucide-react";
import { shareReport } from "@/app/app/reports/share-actions";
import {
  DEFAULT_EXPIRY_DAYS,
  EXPIRY_CHOICES,
  shareDisclosure,
  type ShareKind,
} from "@/lib/reports/share-types";
import { REPORT_FIELDS, type ReportField } from "@/lib/reports/fields";
import { FormError } from "@/components/forms/ui";
import { cn } from "@/lib/utils";

/*
  Turning a report into a link somebody else can open.

  The whole panel is one screen of consent. Before the link exists the player
  is told, in words rather than field names, exactly what a stranger will see —
  and if any of it is personal, that is said first and in orange, because
  "field-level privacy control" means nothing to somebody about to send their
  kid's development report to a trial coach.

  There is no "never expires". Seven days is the default because that matches
  what people actually mean when they share something now.
*/

export function ShareButton({
  kind,
  refId,
  fields,
  periodLabel,
}: {
  kind: ShareKind;
  /** The period, or the video id. */
  refId: string;
  /** The privacy selection currently on screen — frozen into the link. */
  fields: ReportField[];
  periodLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const [days, setDays] = useState(DEFAULT_EXPIRY_DAYS);
  const [url, setUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const sensitive = REPORT_FIELDS.filter((f) => f.sensitive && fields.includes(f.id)).map(
    (f) => f.label,
  );

  const make = () =>
    start(async () => {
      setError(null);
      const res = await shareReport({ kind, ref: refId, fields, days });
      if (res.ok) setUrl(res.url);
      else setError(res.error);
    });

  const copy = async () => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Could not copy — select the link and copy it by hand.");
    }
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="no-print flex h-10 items-center gap-2 rounded-lg border border-line px-3 text-sm text-text transition-colors hover:border-signal-line hover:text-signal-bright"
      >
        <Link2 className="size-4" />
        Share
      </button>
    );
  }

  return (
    <div className="no-print panel absolute right-0 top-12 z-30 w-[min(24rem,calc(100vw-2rem))] p-4 shadow-xl shadow-black/40">
      <div className="flex items-center gap-2">
        <Link2 className="size-4 text-signal-bright" />
        <h3 className="text-sm font-medium text-text-hi">Share {periodLabel}</h3>
        <button
          onClick={() => {
            setOpen(false);
            setUrl(null);
          }}
          aria-label="Close"
          className="ml-auto text-text-faint transition-colors hover:text-text"
        >
          <X className="size-4" />
        </button>
      </div>

      {url ? (
        <>
          <p className="mt-3 text-xs leading-relaxed text-text-dim">
            Anyone with this link can open the report until it expires. You can withdraw it at any
            time from the reports page.
          </p>
          <div className="mt-3 flex items-center gap-2">
            <input
              readOnly
              value={url}
              onFocus={(e) => e.currentTarget.select()}
              className="h-9 min-w-0 flex-1 rounded-lg border border-line bg-ink-850 px-2.5 text-xs text-text-hi focus:border-signal-line focus:outline-none"
            />
            <button
              onClick={copy}
              className="flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-signal-line bg-signal/10 px-3 text-xs font-medium text-signal-bright transition-colors hover:bg-signal/20"
            >
              {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
        </>
      ) : (
        <>
          {/* What they will see, before it exists. */}
          <div
            className={cn(
              "mt-3 flex items-start gap-2.5 rounded-lg border p-3",
              sensitive.length > 0 ? "border-review/30 bg-review/5" : "border-line bg-ink-850",
            )}
          >
            <ShieldAlert
              className={cn(
                "mt-0.5 size-4 shrink-0",
                sensitive.length > 0 ? "text-review" : "text-text-faint",
              )}
            />
            <p className="text-xs leading-relaxed text-text-dim">
              {shareDisclosure(fields, sensitive)}
            </p>
          </div>

          <div className="mt-3">
            <span className="label-tech mb-1.5 block">Expires after</span>
            <div className="flex flex-wrap gap-1.5">
              {EXPIRY_CHOICES.map((c) => (
                <button
                  key={c.days}
                  onClick={() => setDays(c.days)}
                  title={c.hint}
                  className={cn(
                    "rounded-lg border px-2.5 py-1.5 text-xs transition-colors",
                    days === c.days
                      ? "border-signal-line bg-signal/10 text-signal-bright"
                      : "border-line text-text-dim hover:border-line-strong hover:text-text",
                  )}
                >
                  {c.label}
                </button>
              ))}
            </div>
            <p className="mt-1.5 text-[11px] leading-relaxed text-text-faint">
              Every link expires. There is no permanent one — a report about a young player should
              not stay open on the internet indefinitely.
            </p>
          </div>

          <button
            onClick={make}
            disabled={pending}
            className="mt-3 flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-signal-line bg-signal/10 text-sm font-medium text-signal-bright transition-colors hover:bg-signal/20 disabled:opacity-50"
          >
            {pending ? <Loader2 className="size-4 animate-spin" /> : <Link2 className="size-4" />}
            Create the link
          </button>
        </>
      )}

      <FormError error={error} />
    </div>
  );
}
