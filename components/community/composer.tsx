"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { ImagePlus, Loader2, MonitorPlay, Send, X } from "lucide-react";
import { createPost } from "@/app/app/community/feed-actions";
import {
  CAPTION_MAX,
  PHOTO_PX,
  PHOTO_TYPES,
  mediaIssue,
  postIssue,
  youtubeId,
} from "@/lib/data/feed-types";
import { FormError } from "@/components/forms/ui";
import { cn } from "@/lib/utils";

/*
  Making a post.

  Media first, caption second — the opposite of the forum composer this
  replaces, which asked for a title before anything else and got a discussion
  board as a result.

  Photos are resized in the browser to 1440px on the long edge before they are
  sent. A phone photo is 4-5MB and 4000px wide; the same picture at 1440 is
  around 200KB and indistinguishable in a feed. Doing it here means the upload
  is instant on a bad connection and storage does not fill with originals.

  Video is NOT resized, because that needs transcoding the browser cannot do.
  So the limit is stated up front rather than discovered at the end of a long
  upload — and the honest advice is given with it: full match footage belongs
  in the film room, and a post is the moment.
*/

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

export function Composer() {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
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

  const post = () =>
    start(async () => {
      setError(null);
      const res = await createPost({
        caption,
        media: media?.dataUrl ?? null,
        mediaWidth: media?.w ?? null,
        mediaHeight: media?.h ?? null,
        youtubeUrl: yt ? youtube : null,
      });
      if (res.ok) {
        setCaption("");
        setMedia(null);
        setYoutube("");
        setShowYoutube(false);
        router.refresh();
      } else setError(res.error);
    });

  return (
    <div className="panel mb-6 p-4">
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
        placeholder="What happened? What did you see?"
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
