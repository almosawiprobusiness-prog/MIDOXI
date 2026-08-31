"use client";

import { drawShapes } from "./telestration";
import type { Shape } from "@/lib/data/annotation-types";
import { atLabel } from "@/lib/data/annotation-types";
export { boardFilename } from "@/lib/data/annotation-types";

/*
  Getting a picture out of the film room.

  Two callers now share this: the frame reader, which samples twelve
  stills to send to a model, and the board export, which saves one
  annotated frame to disk. They had the same hard part — reading pixels
  out of a video the browser is allowed to play but not always allowed
  to LOOK at — so it lives here once.

  THE TAINT RULE, which decides what is possible at all:

  A canvas that has had cross-origin pixels drawn onto it is "tainted",
  and every method that reads it back — toBlob, toDataURL, getImageData
  — throws. Playing is permitted; reading is not. The browser does this
  so a page cannot use a video as a way to look at content it could not
  otherwise fetch.

  A separate element with `crossOrigin = "anonymous"` asks properly, and
  if the host sends CORS headers the canvas stays clean. Supabase
  storage does, so uploads work. Many video hosts do not, and there is
  nothing this code can do about that except say so plainly.

  YouTube is not on that spectrum at all: the picture is inside an
  iframe belonging to another origin, and no page can read those pixels
  by any means. Callers check that before they get here.
*/

/**
 * A video element whose frames can actually be read back.
 *
 * Separate from the one on screen deliberately. The visible player has
 * no `crossOrigin` attribute — adding one would change how it requests
 * the file and could break playback of sources that work today — and a
 * request not made in CORS mode taints the canvas even when the server
 * would have allowed it.
 */
export function loadCapturableVideo(url: string): Promise<HTMLVideoElement> {
  return new Promise((resolve, reject) => {
    const el = document.createElement("video");
    el.crossOrigin = "anonymous";
    el.preload = "auto";
    el.muted = true;
    el.playsInline = true;

    const timer = setTimeout(() => {
      cleanup();
      reject(new Error("The film took too long to load for reading."));
    }, 20000);

    const cleanup = () => {
      clearTimeout(timer);
      el.removeEventListener("loadeddata", onReady);
      el.removeEventListener("error", onError);
    };
    const onReady = () => {
      cleanup();
      resolve(el);
    };
    const onError = () => {
      cleanup();
      reject(
        new Error(
          "This film is hosted somewhere that does not allow its frames to be read. Upload it to MIDO XI and analysis works on it.",
        ),
      );
    };

    el.addEventListener("loadeddata", onReady);
    el.addEventListener("error", onError);
    el.src = url;
    el.load();
  });
}

/** Seek and wait for the frame to actually be there. */
function seekTo(video: HTMLVideoElement, at: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const done = () => {
      video.removeEventListener("seeked", done);
      video.removeEventListener("error", fail);
      resolve();
    };
    const fail = () => {
      video.removeEventListener("seeked", done);
      video.removeEventListener("error", fail);
      reject(new Error("The film could not be read at that point."));
    };
    video.addEventListener("seeked", done);
    video.addEventListener("error", fail);
    video.currentTime = at;
  });
}

/** Word-wrap for canvas, which has no such thing built in. */
function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";

  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width <= maxWidth) {
      line = next;
      continue;
    }
    if (line) lines.push(line);
    line = word;
    if (lines.length === maxLines) break;
  }
  if (line && lines.length < maxLines) lines.push(line);

  // Anything that did not fit is marked, rather than silently cut.
  if (lines.length === maxLines) {
    const joined = lines.join(" ");
    if (joined.length < text.length) {
      let last = lines[maxLines - 1];
      while (last && ctx.measureText(`${last}…`).width > maxWidth) last = last.slice(0, -1);
      lines[maxLines - 1] = `${last}…`;
    }
  }
  return lines;
}

export interface BoardExport {
  videoUrl: string;
  title: string;
  atSeconds: number;
  shapes: Shape[];
  note?: string | null;
}

/**
 * The frame, the drawing on it, and a strip saying what it is.
 *
 * Returns a PNG blob. The caption is part of the image rather than
 * something the sender types alongside it, because the moment this
 * leaves the app it is on its own — in a chat thread, in a slide, on
 * somebody's phone six weeks later — and a picture of a pitch with an
 * arrow on it and no timestamp is an unanswerable question.
 */
export async function exportBoard(input: BoardExport): Promise<Blob> {
  const video = await loadCapturableVideo(input.videoUrl);
  try {
    await seekTo(video, input.atSeconds);

    /*
      Capped rather than native. Match footage can arrive at 4K, and a
      12MB PNG of one frame is not a thing anybody wants to send. 1600
      is well past what a phone shows and small enough to attach.
    */
    const width = Math.min(video.videoWidth || 1280, 1600);
    const ratio =
      video.videoWidth && video.videoHeight ? video.videoHeight / video.videoWidth : 0.5625;
    const frameHeight = Math.round(width * ratio);

    const pad = Math.round(width * 0.022);
    const noteSize = Math.round(width * 0.026);
    const metaSize = Math.round(width * 0.019);
    const hasNote = Boolean(input.note?.trim());

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("This browser cannot export images.");

    // Measure the caption before sizing the canvas, so a two-line note
    // is not clipped by a height guessed in advance.
    canvas.width = width;
    canvas.height = frameHeight;
    ctx.font = `500 ${noteSize}px ui-sans-serif, system-ui, -apple-system, sans-serif`;
    const noteLines = hasNote ? wrap(ctx, input.note!.trim(), width - pad * 2, 2) : [];

    const captionHeight =
      pad * 2 + metaSize + (noteLines.length ? pad * 0.6 + noteLines.length * noteSize * 1.35 : 0);

    canvas.width = width;
    canvas.height = frameHeight + Math.round(captionHeight);

    // The frame. This is the line that throws if the source tainted it.
    ctx.drawImage(video, 0, 0, width, frameHeight);

    // The drawing, scaled from normalised coordinates to whatever size
    // this export happens to be — the same call the on-screen canvas
    // makes, which is why the two always agree.
    if (input.shapes.length) {
      drawShapes(ctx, input.shapes, width, frameHeight, document.body);
    }

    // The caption strip.
    ctx.fillStyle = "#0a0a0f";
    ctx.fillRect(0, frameHeight, canvas.width, canvas.height - frameHeight);
    ctx.fillStyle = "#2a2a37";
    ctx.fillRect(0, frameHeight, canvas.width, Math.max(1, Math.round(width * 0.0015)));

    let y = frameHeight + pad + metaSize;

    ctx.font = `600 ${metaSize}px ui-monospace, SFMono-Regular, Menlo, monospace`;
    ctx.fillStyle = "#9d88ff";
    const stamp = atLabel(input.atSeconds);
    ctx.fillText(stamp, pad, y);

    ctx.font = `500 ${metaSize}px ui-sans-serif, system-ui, -apple-system, sans-serif`;
    ctx.fillStyle = "#8a8a99";
    const stampWidth = ctx.measureText(`${stamp}   `).width;
    const titleMax = width - pad * 2 - stampWidth - ctx.measureText("MIDO XI").width - pad;
    ctx.fillText(wrap(ctx, input.title, titleMax, 1)[0] ?? "", pad + stampWidth, y);

    ctx.textAlign = "right";
    ctx.fillStyle = "#4a4a5a";
    ctx.fillText("MIDO XI", width - pad, y);
    ctx.textAlign = "left";

    if (noteLines.length) {
      y += pad * 0.6;
      ctx.font = `500 ${noteSize}px ui-sans-serif, system-ui, -apple-system, sans-serif`;
      ctx.fillStyle = "#f4f3f8";
      for (const line of noteLines) {
        y += noteSize * 1.15;
        ctx.fillText(line, pad, y);
      }
    }

    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error("The image could not be encoded."));
      }, "image/png");
    });
  } finally {
    // Release the download whether or not the export worked.
    video.src = "";
  }
}

/**
 * The MIDO frame — the same annotated frame, dressed as an artifact.
 *
 * 1080×1350 portrait (the social feed's native shape): ink canvas,
 * FILM ROOM header with the timestamp, the frame large in the middle,
 * the focus line under it in the display voice, mido11.com in the
 * corner. Branding never covers the football — the frame is letterboxed
 * whole, not cropped under a logo.
 *
 * Same taint rules as `exportBoard`; callers refuse YouTube first.
 */
export async function exportMidoFrame(input: BoardExport & { playerName?: string | null }): Promise<Blob> {
  const video = await loadCapturableVideo(input.videoUrl);
  try {
    await seekTo(video, input.atSeconds);

    const W = 1080;
    const H = 1350;
    const pad = 64;

    const canvas = document.createElement("canvas");
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("This browser cannot export images.");

    // Ground.
    ctx.fillStyle = "#08090b";
    ctx.fillRect(0, 0, W, H);

    // Header — the room and the moment.
    const display = '700 44px "Big Shoulders", "Arial Narrow", sans-serif';
    ctx.font = display;
    ctx.fillStyle = "#f3f5f8";
    ctx.fillText("FILM ROOM", pad, pad + 40);
    ctx.font = '600 26px ui-monospace, SFMono-Regular, Menlo, monospace';
    ctx.fillStyle = "#9d88ff";
    const stamp = atLabel(input.atSeconds);
    ctx.textAlign = "right";
    ctx.fillText(stamp, W - pad, pad + 36);
    ctx.textAlign = "left";
    ctx.font = "500 20px ui-sans-serif, system-ui, sans-serif";
    ctx.fillStyle = "#838d99";
    ctx.fillText(wrap(ctx, input.title.toUpperCase(), W - pad * 2, 1)[0] ?? "", pad, pad + 76);

    // The frame — whole, centered, as large as the middle band allows.
    const bandTop = pad + 116;
    const bandBottom = H - 300;
    const ratio =
      video.videoWidth && video.videoHeight ? video.videoHeight / video.videoWidth : 0.5625;
    let fw = W - pad * 2;
    let fh = Math.round(fw * ratio);
    if (fh > bandBottom - bandTop) {
      fh = bandBottom - bandTop;
      fw = Math.round(fh / ratio);
    }
    const fx = Math.round((W - fw) / 2);
    const fy = Math.round(bandTop + (bandBottom - bandTop - fh) / 2);

    ctx.drawImage(video, fx, fy, fw, fh);
    if (input.shapes.length) {
      ctx.save();
      ctx.translate(fx, fy);
      drawShapes(ctx, input.shapes, fw, fh, document.body);
      ctx.restore();
    }
    // A hairline so the frame reads as placed, not floating.
    ctx.strokeStyle = "rgba(255,255,255,0.11)";
    ctx.lineWidth = 2;
    ctx.strokeRect(fx - 1, fy - 1, fw + 2, fh + 2);

    // The focus — what this frame is teaching.
    let y = bandBottom + 72;
    if (input.playerName?.trim()) {
      ctx.font = "600 22px ui-monospace, SFMono-Regular, Menlo, monospace";
      ctx.fillStyle = "#838d99";
      ctx.fillText(input.playerName.trim().toUpperCase(), pad, y);
      y += 46;
    }
    if (input.note?.trim()) {
      ctx.font = '700 40px "Big Shoulders", "Arial Narrow", sans-serif';
      ctx.fillStyle = "#f3f5f8";
      for (const line of wrap(ctx, input.note.trim().toUpperCase(), W - pad * 2, 2)) {
        ctx.fillText(line, pad, y);
        y += 50;
      }
    }

    // Footer — MIDO's quiet signature.
    ctx.strokeStyle = "rgba(255,255,255,0.11)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(pad, H - 92);
    ctx.lineTo(W - pad, H - 92);
    ctx.stroke();
    ctx.font = '700 26px "Big Shoulders", "Arial Narrow", sans-serif';
    ctx.fillStyle = "#838d99";
    ctx.fillText("MIDO XI", pad, H - 48);
    ctx.font = "500 20px ui-sans-serif, system-ui, sans-serif";
    ctx.textAlign = "right";
    ctx.fillText("mido11.com", W - pad, H - 50);
    ctx.textAlign = "left";

    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error("The image could not be encoded."));
      }, "image/png");
    });
  } finally {
    video.src = "";
  }
}

/** Hand a blob to the browser as a file. */
export function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Revoked on the next tick: revoking synchronously can cancel the
  // download in some browsers before it has started reading.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
