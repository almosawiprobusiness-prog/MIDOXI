"use client";

import { useState } from "react";
import { Download, Share2, Loader2, ImageOff } from "lucide-react";
import {
  PUBLISH_TEMPLATES,
  PUBLISH_FORMATS,
  type PublishTemplate,
  type PublishFormat,
} from "@/lib/publish/types";

/*
  The Publish studio.

  The preview IS the artifact — the same route renders both, so what
  the player sees is byte-for-byte what leaves the app. There is no
  field picker because the templates cannot show private fields at all
  (the adapters whitelist; see lib/publish/data.ts) — the privacy
  control is that the artifact's whole vocabulary is public-safe.

  Download fetches the image and saves it; Share hands the file to the
  system share sheet where the browser has one. No posting
  integrations — the artifact matters more than the posting.
*/

export function PublishStudio({ available }: { available: Record<PublishTemplate, boolean> }) {
  const firstAvailable =
    PUBLISH_TEMPLATES.find((t) => available[t.key])?.key ?? PUBLISH_TEMPLATES[0]!.key;
  const [template, setTemplate] = useState<PublishTemplate>(firstAvailable);
  const [format, setFormat] = useState<PublishFormat>("square");
  const [busy, setBusy] = useState<"download" | "share" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  const src = `/app/publish/image?template=${template}&format=${format}`;
  const filename = `mido-xi-${template}-${format}.png`;

  const fetchBlob = async () => {
    const res = await fetch(src);
    if (!res.ok) throw new Error(await res.text());
    return res.blob();
  };

  const download = async () => {
    setBusy("download");
    setError(null);
    try {
      const blob = await fetchBlob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (e) {
      setError(e instanceof Error ? e.message : "The image could not be created.");
    }
    setBusy(null);
  };

  const share = async () => {
    setBusy("share");
    setError(null);
    try {
      const blob = await fetchBlob();
      const file = new File([blob], filename, { type: "image/png" });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file] });
      } else {
        // No share sheet on this browser — the download does the job.
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = filename;
        a.click();
        URL.revokeObjectURL(a.href);
      }
    } catch (e) {
      // An abandoned share sheet rejects — that is a choice, not an error.
      if (e instanceof Error && e.name !== "AbortError") {
        setError(e.message || "Sharing failed on this browser — download instead.");
      }
    }
    setBusy(null);
  };

  const dims = PUBLISH_FORMATS.find((f) => f.key === format)!;

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
      <div className="min-w-0">
        <div
          className="relative mx-auto overflow-hidden rounded-xl border border-line bg-ink-950"
          style={{ maxWidth: format === "story" ? 360 : 640, aspectRatio: `${dims.width} / ${dims.height}` }}
        >
          {!loaded && (
            <div className="absolute inset-0 grid place-items-center text-text-faint">
              <Loader2 className="size-5 animate-spin" />
            </div>
          )}
          {available[template] ? (
            // The artifact itself, not a mock of it.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={src}
              src={src}
              alt="Preview of the card exactly as it will be shared"
              className="h-full w-full object-contain"
              onLoad={() => setLoaded(true)}
              onError={() => {
                setLoaded(true);
                setError("This card could not be rendered.");
              }}
            />
          ) : (
            <div className="absolute inset-0 grid place-items-center p-6 text-center">
              <div className="flex flex-col items-center gap-2 text-text-dim">
                <ImageOff className="size-6" />
                <p className="text-sm">
                  Nothing on the record for this card yet —{" "}
                  {PUBLISH_TEMPLATES.find((t) => t.key === template)?.needs} first.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="min-w-0 space-y-4">
        <div>
          <div className="label-tech mb-2">Card</div>
          <div className="space-y-1.5">
            {PUBLISH_TEMPLATES.map((t) => (
              <button
                key={t.key}
                onClick={() => {
                  setTemplate(t.key);
                  setLoaded(false);
                  setError(null);
                }}
                aria-pressed={template === t.key}
                className={`flex h-10 w-full items-center justify-between rounded-lg border px-3 text-sm transition-colors ${
                  template === t.key
                    ? "border-signal-line bg-signal/10 text-signal-bright"
                    : "border-line text-text-dim hover:text-text"
                }`}
              >
                {t.label}
                {!available[t.key] && <span className="text-[10px] text-text-faint">needs {t.needs}</span>}
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="label-tech mb-2">Format</div>
          <div className="flex flex-wrap gap-1.5">
            {PUBLISH_FORMATS.map((f) => (
              <button
                key={f.key}
                onClick={() => {
                  setFormat(f.key);
                  setLoaded(false);
                }}
                aria-pressed={format === f.key}
                className={`h-8 rounded-md border px-2.5 text-xs transition-colors ${
                  format === f.key
                    ? "border-signal-line bg-signal/10 text-signal-bright"
                    : "border-line text-text-dim hover:text-text"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2 border-t border-line pt-4">
          <button
            onClick={download}
            disabled={busy !== null || !available[template]}
            className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-signal text-sm font-medium text-white transition-colors hover:bg-signal-deep disabled:opacity-50"
          >
            {busy === "download" ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
            Download image
          </button>
          <button
            onClick={share}
            disabled={busy !== null || !available[template]}
            className="flex h-11 w-full items-center justify-center gap-2 rounded-lg border border-line text-sm text-text transition-colors hover:border-signal-line hover:text-signal-bright disabled:opacity-50"
          >
            {busy === "share" ? <Loader2 className="size-4 animate-spin" /> : <Share2 className="size-4" />}
            Share
          </button>
          <p className="text-[11px] leading-relaxed text-text-faint">
            The preview is exactly what leaves MIDO — name, position, club and the numbers shown.
            Nothing else can appear on a card.
          </p>
        </div>

        {error && (
          <p className="rounded-lg border border-correction/30 bg-correction/10 px-3 py-2 text-xs text-correction">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
