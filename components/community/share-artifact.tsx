"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { X, Loader2, Share2, Users, Globe } from "lucide-react";
import { createPost } from "@/app/app/community/feed-actions";
import type { Visibility } from "@/lib/data/feed-types";

/*
  Sharing a loop artifact — the community made of the football the
  player is already logging, nothing more.

  Opt-in per item, always: the draft is pre-filled from the artifact
  (a completed study, a goal being worked), and NOTHING posts until
  the player has read it, edited it, chosen who sees it, and pressed
  Share. The record stays private by default; this is the one door
  out, and the player holds it.
*/

export function ShareArtifact({
  label,
  draft,
  tag,
}: {
  /** Button copy — "Share this study", "Share this milestone". */
  label: string;
  /** Pre-filled caption, from the artifact's own real data. */
  draft: string;
  /** One tag naming the artifact kind, e.g. "study" | "goal". */
  tag: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [caption, setCaption] = useState(draft);
  const [visibility, setVisibility] = useState<Visibility>("followers");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const share = async () => {
    setBusy(true);
    setError(null);
    const res = await createPost({ caption, tags: [tag], visibility });
    if (res.ok) {
      setDone(true);
      setBusy(false);
      setTimeout(() => setOpen(false), 900);
      router.refresh();
    } else {
      setError(res.error);
      setBusy(false);
    }
  };

  return (
    <>
      <button
        onClick={() => {
          setCaption(draft);
          setDone(false);
          setOpen(true);
        }}
        className="inline-flex h-9 items-center gap-2 rounded-lg border border-line px-3.5 text-sm text-text-dim transition-colors hover:border-signal-line hover:text-signal-bright"
      >
        <Share2 className="size-4" /> {label}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 py-[10vh]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setOpen(false)} />
            <motion.div role="dialog" aria-modal="true" aria-label={label} className="panel-raised relative w-full max-w-md p-5 shadow-2xl shadow-black/50" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 12 }} transition={{ duration: 0.18, ease: [0.2, 0.8, 0.2, 1] }}>
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <div className="label-tech">Your words, your call</div>
                  <h3 className="font-display text-lg font-semibold uppercase text-text-hi">Share</h3>
                </div>
                <button onClick={() => setOpen(false)} className="text-text-faint hover:text-text" aria-label="Close"><X className="size-5" /></button>
              </div>

              <textarea
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                rows={5}
                maxLength={600}
                className="w-full resize-y rounded-lg border border-line bg-ink-850 p-3 text-sm text-text-hi placeholder:text-text-faint focus:border-signal-line focus:outline-none"
              />

              <div className="mt-3 flex gap-1.5">
                {(
                  [
                    { v: "followers" as const, icon: Users, label: "People who follow you" },
                    { v: "public" as const, icon: Globe, label: "Everyone" },
                  ]
                ).map(({ v, icon: Icon, label: vLabel }) => (
                  <button
                    key={v}
                    onClick={() => setVisibility(v)}
                    className="flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg border px-2 text-xs transition-colors"
                    style={
                      visibility === v
                        ? { borderColor: "var(--signal-line)", color: "var(--signal-bright)", background: "var(--signal-wash)" }
                        : { borderColor: "var(--line-strong)", color: "var(--text-dim)" }
                    }
                  >
                    <Icon className="size-3.5" /> {vLabel}
                  </button>
                ))}
              </div>

              {error && <p className="mt-3 rounded-lg border border-correction/30 bg-correction/10 px-3 py-2 text-sm text-correction">{error}</p>}

              <button
                onClick={share}
                disabled={busy || !caption.trim() || done}
                className="mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-signal font-medium text-white transition-colors hover:bg-signal-deep disabled:opacity-50"
              >
                {busy ? <Loader2 className="size-4 animate-spin" /> : done ? "Shared" : <><Share2 className="size-4" /> Share</>}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
