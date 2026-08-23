"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Camera, Loader2, Trash2, User } from "lucide-react";
import { updateAvatar, removeAvatar } from "@/app/app/settings/actions";
import { AVATAR_PX, avatarIssue } from "@/lib/data/clubs-types";
import { FormError, FormNote } from "@/components/forms/ui";

/*
  A face for the profile, and for the report a coach reads.

  The image is squared and resized HERE, before it is sent. A modern phone
  photo is 3-5MB and 4000px wide; a 512px WebP of the same picture is about
  30KB. Doing that in the browser means the upload is instant on a bad
  connection, the server never has to decode an image, and storage does not
  fill with originals nobody will ever look at.

  Cropped from the centre rather than squashed. A player's profile picture is
  usually a portrait, and a squashed face is worse than a cropped one.
*/

async function squareWebp(file: File, size = AVATAR_PX): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const sx = (bitmap.width - side) / 2;
  const sy = (bitmap.height - side) / 2;

  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("This browser cannot resize images.");
  ctx.drawImage(bitmap, sx, sy, side, side, 0, 0, size, size);
  bitmap.close();

  // WebP at 0.85 is visually indistinguishable here and about a third the size
  // of the equivalent JPEG.
  return canvas.toDataURL("image/webp", 0.85);
}

export function AvatarUpload({ url, name }: { url: string; name: string }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState(url);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [working, setWorking] = useState(false);

  const pick = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    setNote(null);

    const issue = avatarIssue(file);
    if (issue) {
      setError(issue);
      return;
    }

    setWorking(true);
    let dataUrl: string;
    try {
      dataUrl = await squareWebp(file);
    } catch (e) {
      setWorking(false);
      setError(e instanceof Error ? e.message : "That image could not be read.");
      return;
    }
    setWorking(false);
    setPreview(dataUrl);

    start(async () => {
      const res = await updateAvatar(dataUrl);
      if (res.ok) {
        if (res.url) setPreview(res.url);
        setNote(res.demo ? "Saved (demo — not persisted)" : "Saved");
        router.refresh();
      } else {
        setPreview(url);
        setError(res.error);
      }
    });
  };

  const clear = () =>
    start(async () => {
      const res = await removeAvatar();
      if (res.ok) {
        setPreview("");
        setNote("Removed");
        router.refresh();
      } else setError(res.error);
    });

  const busy = working || pending;
  const initials =
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase())
      .join("") || "";

  return (
    <div className="panel p-5">
      <div className="flex items-center gap-4">
        <div className="relative size-20 shrink-0 overflow-hidden rounded-full border border-line bg-ink-850">
          {preview ? (
            <Image
              src={preview}
              alt=""
              width={AVATAR_PX}
              height={AVATAR_PX}
              className="size-full object-cover"
              unoptimized
            />
          ) : (
            <span className="grid size-full place-items-center font-display text-xl font-bold text-text-faint">
              {initials || <User className="size-7" />}
            </span>
          )}
          {busy && (
            <span className="absolute inset-0 grid place-items-center bg-ink-950/60">
              <Loader2 className="size-5 animate-spin text-signal-bright" />
            </span>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-medium text-text-hi">Profile picture</h3>
          <p className="mt-0.5 text-xs leading-relaxed text-text-dim">
            Appears on your profile and at the top of any report you print. Squared and shrunk in
            your browser before it is sent — nothing large leaves this page.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              onClick={() => input.current?.click()}
              disabled={busy}
              className="flex h-9 items-center gap-2 rounded-lg border border-line px-3 text-sm text-text transition-colors hover:border-signal-line hover:text-signal-bright disabled:opacity-60"
            >
              <Camera className="size-4" />
              {preview ? "Change" : "Add a picture"}
            </button>
            {preview && (
              <button
                onClick={clear}
                disabled={busy}
                className="flex h-9 items-center gap-2 rounded-lg border border-line px-3 text-sm text-text-dim transition-colors hover:border-correction/40 hover:text-correction disabled:opacity-60"
              >
                <Trash2 className="size-3.5" />
                Remove
              </button>
            )}
          </div>
        </div>
      </div>

      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        onChange={(e) => {
          void pick(e.target.files?.[0]);
          // Let the same file be chosen twice in a row after a failure.
          e.target.value = "";
        }}
      />

      <FormError error={error} />
      <FormNote message={note} />
    </div>
  );
}
