"use client";

import { useState } from "react";
import { Check, Copy, Share2 } from "lucide-react";

/*
  The link, and the two ways football people actually pass one on: copied into
  a group chat, or shared straight from a phone. The code is shown separately
  and large because it also gets read out in a dressing room, which is why the
  alphabet has no O/0 or I/1 in it.
*/

export function ShareLink({ code, url }: { code: string; url: string }) {
  const [copied, setCopied] = useState<"code" | "link" | null>(null);

  const copy = async (what: "code" | "link", value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(what);
      setTimeout(() => setCopied(null), 1800);
    } catch {
      // Clipboard is blocked in some embedded browsers; the value is on screen
      // and selectable either way.
    }
  };

  const share = async () => {
    if (typeof navigator !== "undefined" && "share" in navigator) {
      try {
        await navigator.share({
          title: "MIDO XI",
          text: "This is the football system I use. Study, prepare, train, review.",
          url,
        });
        return;
      } catch {
        // Cancelled, or unsupported — fall through to copying.
      }
    }
    void copy("link", url);
  };

  return (
    <div className="panel-raised overflow-hidden">
      <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
        <div className="min-w-0 flex-1">
          <div className="label-tech mb-1">Your code</div>
          <div className="font-display text-3xl font-bold tracking-[0.12em] text-text-hi">
            {code}
          </div>
        </div>
        <div className="flex shrink-0 gap-2">
          <button
            onClick={() => copy("code", code)}
            className="flex h-10 items-center gap-2 rounded-lg border border-line-strong px-3.5 text-sm text-text-dim transition-colors hover:border-signal-line hover:text-text-hi"
          >
            {copied === "code" ? <Check className="size-4 text-positive" /> : <Copy className="size-4" />}
            {copied === "code" ? "Copied" : "Copy code"}
          </button>
          <button
            onClick={share}
            className="flex h-10 items-center gap-2 rounded-lg bg-signal px-3.5 text-sm font-medium text-white transition-colors hover:bg-signal-deep"
          >
            <Share2 className="size-4" />
            Share
          </button>
        </div>
      </div>

      <div className="flex items-center gap-3 border-t border-line bg-ink-900 px-5 py-3">
        <code className="min-w-0 flex-1 truncate font-mono text-xs text-text-dim">{url}</code>
        <button
          onClick={() => copy("link", url)}
          className="shrink-0 text-xs text-signal-bright transition-colors hover:text-text-hi"
        >
          {copied === "link" ? "Copied" : "Copy link"}
        </button>
      </div>
    </div>
  );
}
