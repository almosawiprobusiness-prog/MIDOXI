"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import { ImagePlus, Loader2, MonitorPlay, Plus, Send, X } from "lucide-react";
import { createPost } from "@/app/app/community/feed-actions";
import {
  CAPTION_MAX,
  PHOTO_PX,
  PHOTO_TYPES,
  POST_KINDS,
  mediaIssue,
  postIssue,
  youtubeId,
  type PostKind,
} from "@/lib/data/feed-types";
import { FormError } from "@/components/forms/ui";
import { cn } from "@/lib/utils";

/*
  Making a post — the Framer-designed flow.

  WHAT ARE YOU SHARING? → six quiet chips → if it is something MIDO
  already knows about, a FROM MIDO strip offers the player's own recent
  record and pre-fills the facts (duration, focus, opponent) so nothing
  MIDO knows is ever re-typed → media → ADD A THOUGHT → post.

  Photos are resized in the browser to 1440px on the long edge before
  they are sent — a phone photo is 4-5MB and 4000px wide; the same
  picture at 1440 is ~200KB and indistinguishable in a feed. Video is
  NOT resized (that needs transcoding a browser cannot do), so its
  limit is stated up front rather than discovered after a long upload.
*/

/** One thing MIDO already knows, offered to the composer. */
export interface FromMido {
  kind: PostKind;
  /** "TRAINING · 42 MIN" — the strip line. */
  label: string;
  /** "Blindside movement" — what it was about. */
  detail: string;
  /** The caption the facts pre-fill. The player's thought goes after it. */
  caption: string;
}

async function shrink(file: File, px = PHOTO_PX): Promise<{ dataUrl: string; w: number; h: number }> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, px / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("This browser cannot resize images.");
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();

  return { dataUrl: canvas.toDataURL("image/webp", 0.85), w, h };
}

const readAsDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onloadend = () => resolve(String(r.result ?? ""));
    r.onerror = () => reject(new Error("That file could not be read."));
    r.readAsDataURL(file);
  });

export function Composer({
  fromMido = [],
  onPosted,
  autoFocus = false,
}: {
  fromMido?: FromMido[];
  onPosted?: () => void;
  autoFocus?: boolean;
}) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [kind, setKind] = useState<PostKind | null>(null);
  const [caption, setCaption] = useState("");
  const [media, setMedia] = useState<{ dataUrl: string; w: number | null; h: number | null; isVideo: boolean } | null>(null);
  const [youtube, setYoutube] = useState("");
  const [showYoutube, setShowYoutube] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const [pending, start] = useTransition();

  const pick = async (file: File | undefined) => {
    if (!file) return;
    setError(null);

    const issue = mediaIssue(file);
    if (issue) {
      setError(issue);
      return;
    }

    setWorking(true);
    try {
      if (PHOTO_TYPES.includes(file.type)) {
        const { dataUrl, w, h } = await shrink(file);
        setMedia({ dataUrl, w, h, isVideo: false });
      } else {
        // Sent as-is: the browser cannot transcode, and pretending otherwise
        // would mean a spinner that never finishes.
        setMedia({ dataUrl: await readAsDataUrl(file), w: null, h: null, isVideo: true });
      }
      setShowYoutube(false);
      setYoutube("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "That file could not be read.");
    }
    setWorking(false);
  };

  const yt = youtube ? youtubeId(youtube) : null;
  const issue = postIssue({ caption, hasMedia: Boolean(media || yt) });
  const busy = working || pending;

  const offered = kind ? fromMido.filter((f) => f.kind === kind) : [];

  const post = () =>
    start(async () => {
      setError(null);
      const res = await createPost({
        caption,
        media: media?.dataUrl ?? null,
        mediaWidth: media?.w ?? null,
        mediaHeight: media?.h ?? null,
        youtubeUrl: yt ? youtube : null,
        kind,
      });
      if (res.ok) {
        setKind(null);
        setCaption("");
        setMedia(null);
        setYoutube("");
        setShowYoutube(false);
        onPosted?.();
        router.refresh();
      } else setError(res.error);
    });

  return (
    <div className="panel p-4">
      {/* WHAT ARE YOU SHARING? — the six quiet chips. */}
      <div className="mb-3">
        <div className="label-tech mb-2">What are you sharing?</div>
        <div className="flex flex-wrap gap-1.5">
          {POST_KINDS.map((k) => (
            <button
              key={k.value}
              onClick={() => setKind((cur) => (cur === k.value ? null : k.value))}
              aria-pressed={kind === k.value}
              className={cn(
                "data-mono h-7 rounded-md border px-2.5 text-[11px] uppercase tracking-wider transition-colors",
                kind === k.value
                  ? "border-signal-line bg-signal/10 text-signal-bright"
                  : "border-line text-text-dim hover:border-signal-line hover:text-text",
              )}
            >
              {k.label}
            </button>
          ))}
        </div>
      </div>

      {/*
        FROM MIDO — the player's own recent record, one tap to pre-fill.
        The player never re-types a duration, focus or opponent MIDO
        already holds; they add the thought, which is the only part
        MIDO cannot write.
      */}
      {offered.length > 0 && (
        <div className="mb-3 space-y-1.5">
          <div className="label-tech">From MIDO</div>
          {offered.map((f, i) => (
            <button
              key={i}
              onClick={() => setCaption((c) => (c.trim() ? c : f.caption))}
              className="flex w-full items-baseline justify-between gap-3 rounded-lg border border-line bg-ink-850 px-3 py-2 text-left transition-colors hover:border-signal-line"
            >
              <span className="data-mono shrink-0 text-[11px] uppercase tracking-wider text-signal-bright">
                {f.label}
              </span>
              <span className="min-w-0 flex-1 truncate text-sm text-text">{f.detail}</span>
              <span className="data-mono shrink-0 text-[10px] text-text-faint">use</span>
            </button>
          ))}
        </div>
      )}

      {media ? (
        <div className="relative mb-3 overflow-hidden rounded-lg border border-line bg-ink-850">
          {media.isVideo ? (
            <video src={media.dataUrl} controls playsInline className="max-h-80 w-full object-contain" />
          ) : (
            <Image
              src={media.dataUrl}
              alt=""
              width={media.w ?? 800}
              height={media.h ?? 800}
              unoptimized
              className="max-h-80 w-full object-contain"
            />
          )}
          <button
            onClick={() => setMedia(null)}
            aria-label="Remove"
            className="absolute right-2 top-2 grid size-7 place-items-center rounded-full bg-ink-950/80 text-text transition-colors hover:text-correction"
          >
            <X className="size-4" />
          </button>
        </div>
      ) : yt ? (
        <div className="relative mb-3 aspect-video overflow-hidden rounded-lg border border-line">
          <iframe
            src={`https://www.youtube.com/embed/${yt}`}
            title="Clip"
            allowFullScreen
            className="size-full"
          />
          <button
            onClick={() => {
              setYoutube("");
              setShowYoutube(false);
            }}
            aria-label="Remove"
            className="absolute right-2 top-2 grid size-7 place-items-center rounded-full bg-ink-950/80 text-text transition-colors hover:text-correction"
          >
            <X className="size-4" />
          </button>
        </div>
      ) : null}

      {showYoutube && !yt && (
        <input
          value={youtube}
          onChange={(e) => setYoutube(e.target.value)}
          placeholder="Paste a YouTube link"
          autoFocus
          className="mb-3 h-10 w-full rounded-lg border border-line bg-ink-850 px-3 text-sm text-text-hi placeholder:text-text-faint focus:border-signal-line focus:outline-none"
        />
      )}

      <textarea
        value={caption}
        onChange={(e) => setCaption(e.target.value)}
        rows={media || yt ? 3 : 2}
        maxLength={CAPTION_MAX}
        autoFocus={autoFocus}
        placeholder="Add a thought — what happened? What did you see?"
        className="w-full resize-none rounded-lg border border-line bg-ink-850 px-3 py-2.5 text-sm text-text-hi placeholder:text-text-faint focus:border-signal-line focus:outline-none"
      />

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          onClick={() => input.current?.click()}
          disabled={busy}
          className="flex h-9 items-center gap-2 rounded-lg border border-line px-3 text-sm text-text-dim transition-colors hover:border-signal-line hover:text-signal-bright disabled:opacity-60"
        >
          {working ? <Loader2 className="size-4 animate-spin" /> : <ImagePlus className="size-4" />}
          Photo or clip
        </button>
        <button
          onClick={() => setShowYoutube((s) => !s)}
          disabled={busy || Boolean(media)}
          className={cn(
            "flex h-9 items-center gap-2 rounded-lg border px-3 text-sm transition-colors disabled:opacity-60",
            showYoutube
              ? "border-signal-line text-signal-bright"
              : "border-line text-text-dim hover:border-signal-line hover:text-signal-bright",
          )}
        >
          <MonitorPlay className="size-4" />
          YouTube
        </button>

        <span className="ml-auto data-mono text-[10px] text-text-faint">
          {caption.length}/{CAPTION_MAX}
        </span>
        <button
          onClick={post}
          disabled={busy || Boolean(issue)}
          className="flex h-9 items-center gap-2 rounded-lg border border-signal-line bg-signal/10 px-4 text-sm font-medium text-signal-bright transition-colors hover:bg-signal/20 disabled:opacity-50"
        >
          {pending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
          Post
        </button>
      </div>

      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png,image/webp,video/mp4,video/webm"
        className="sr-only"
        onChange={(e) => {
          void pick(e.target.files?.[0]);
          e.target.value = "";
        }}
      />

      <FormError error={error} />
    </div>
  );
}

/*
  The CREATE doors — the header button on desktop and the pinned
  floating action on the phone, both opening the same composer as an
  overlay so the feed itself stays pure reading.

  `?compose=1` opens it too, which is how the empty state's editorial
  prompts land somebody directly in the right flow.
*/
export function CreateDoors({ fromMido = [] }: { fromMido?: FromMido[] }) {
  const params = useSearchParams();
  const composeParam = Boolean(params.get("compose"));
  const [open, setOpen] = useState(composeParam);
  /*
    `?compose=1` opens the overlay on client-side navigation too — the
    empty state's prompts link within this page. Adjusted during render
    (React's sanctioned derived-state form) rather than in an effect,
    which would set state synchronously after every params change.
  */
  const [lastParam, setLastParam] = useState(composeParam);
  if (composeParam !== lastParam) {
    setLastParam(composeParam);
    if (composeParam) setOpen(true);
  }

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="hidden h-9 items-center gap-2 rounded-lg bg-signal px-4 text-sm font-medium text-white transition-colors hover:bg-signal-deep sm:flex"
      >
        <Plus className="size-4" /> Create
      </button>

      {/* The phone's pinned door — quiet purple, always in thumb's reach. */}
      <button
        onClick={() => setOpen(true)}
        aria-label="Create a post"
        className="fixed bottom-20 right-4 z-30 grid size-12 place-items-center rounded-full bg-signal text-white shadow-lg shadow-black/40 transition-colors hover:bg-signal-deep sm:hidden"
      >
        <Plus className="size-5" />
      </button>

      {open && (
        <div
          className="fixed inset-0 z-40 flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-6"
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Create a post"
            className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-t-2xl border border-line bg-ink-925 sm:rounded-2xl"
          >
            <div className="flex items-center justify-between border-b border-line px-4 py-3">
              <span className="font-display text-lg font-bold uppercase tracking-wide text-text-hi">
                Create
              </span>
              <button
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="grid size-8 place-items-center rounded-lg text-text-dim transition-colors hover:text-text"
              >
                <X className="size-4" />
              </button>
            </div>
            <div className="p-2">
              <Composer fromMido={fromMido} autoFocus onPosted={() => setOpen(false)} />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
