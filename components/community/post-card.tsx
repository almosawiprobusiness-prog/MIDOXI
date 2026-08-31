"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Avatar } from "@/components/ui/avatar";
import {
  MoreHorizontal,
  Flag,
  Trash2,
  UserX,
  Loader2,
  Pencil,
} from "lucide-react";
import {
  blockUser,
  deletePost,
  reportPost,
  toggleLike,
  toggleSave,
  updatePost,
} from "@/app/app/community/feed-actions";
import {
  CAPTION_MAX,
  REPORT_REASONS,
  aspectOf,
  compactCount,
  displayHandle,
  kindLabel,
  timeAgo,
  type Post,
} from "@/lib/data/feed-types";
import { fmtTime } from "@/lib/data/film-types";
import { cn } from "@/lib/utils";

/*
  One post in the feed — the Framer-designed anatomy.

  Identity in a single mono-caps line, then the media LARGE (the post
  is the image), then a native data kicker in the display voice — FILM
  REVIEW / 6:14 / CLOSED BODY — because MIDO-generated facts should
  read as part of the post, not as an embedded dashboard widget. A
  study post with no media becomes a quote card: the insight IS the
  media. The action row is words, not icon soup: APPRECIATE · COMMENT
  · SAVE · SHARE.

  Three details that are easy to skip and would each be felt:

  · The aspect ratio is reserved BEFORE the image loads, so nothing
    below jumps when a picture lands.
  · Appreciate and Save are optimistic — a control that waits for a
    round trip feels broken, and the failure case costs nothing.
  · Report and block are on every post, one tap from the corner, for
    anybody. Not buried in settings.
*/

/** The kicker's colour follows the football, not decoration. */
function kickerClass(kind: Post["kind"]): string {
  if (kind === "match") return "text-positive";
  if (kind === "study") return "text-signal-bright";
  return "text-text-hi";
}

export function PostCard({ post }: { post: Post }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [liked, setLiked] = useState(post.likedByMe);
  const [likes, setLikes] = useState(post.likes);
  const [saved, setSaved] = useState(post.savedByMe);
  const [menu, setMenu] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(post.caption);
  const [done, setDone] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);

  const like = () => {
    // Optimistic: the word moves now, the server catches up.
    const next = !liked;
    setLiked(next);
    setLikes((n) => n + (next ? 1 : -1));
    start(async () => {
      const res = await toggleLike(post.id);
      if (!res.ok) {
        setLiked(!next);
        setLikes((n) => n + (next ? -1 : 1));
      }
    });
  };

  const save = () => {
    const next = !saved;
    setSaved(next);
    start(async () => {
      const res = await toggleSave(post.id);
      if (!res.ok) setSaved(!next);
    });
  };

  const share = async () => {
    const url = `${window.location.origin}/app/community/posts/${post.id}`;
    try {
      if (navigator.share) await navigator.share({ url });
      else {
        await navigator.clipboard.writeText(url);
        setDone("Link copied.");
      }
    } catch {
      /* an abandoned share sheet is a choice, not an error */
    }
  };

  const saveEdit = () =>
    start(async () => {
      const res = await updatePost(post.id, draft);
      if (res.ok) {
        setEditing(false);
        setFailed(null);
        router.refresh();
      } else setFailed(res.error);
    });

  const profileHref = post.author.handle
    ? `/app/community/${post.author.handle}`
    : `/app/community/players/${post.author.userId}`;

  // A study insight with no picture is a quote card — the words are the media.
  const asQuote = post.kind === "study" && !post.media && post.caption;

  return (
    <article className="border-b border-line pb-5">
      {/* Identity — one line, mono caps, the way the rest of MIDO speaks. */}
      <header className="flex items-center gap-2.5 px-1 py-3">
        <Link href={profileHref} className="shrink-0">
          <Avatar url={post.author.avatar} name={post.author.name} size={36} />
        </Link>
        <div className="min-w-0 flex-1">
          <Link href={profileHref} className="block truncate text-sm font-medium text-text-hi hover:underline">
            {post.author.name}
          </Link>
          <span className="data-mono block truncate text-[10px] uppercase tracking-wider text-text-faint">
            {[post.author.position, displayHandle(post.author)].filter(Boolean).join(" · ")}
            {" · "}
            {timeAgo(post.createdAt)}
          </span>
        </div>

        <div className="relative shrink-0">
          <button
            onClick={() => setMenu((m) => !m)}
            aria-label="Post options"
            className="text-text-faint transition-colors hover:text-text"
          >
            <MoreHorizontal className="size-4" />
          </button>
          {menu && (
            <>
              {/* Invisible backdrop: tap anywhere else to close, same as the role switcher. */}
              <button
                aria-hidden
                tabIndex={-1}
                onClick={() => setMenu(false)}
                className="fixed inset-0 z-10 cursor-default"
              />
            <div className="absolute right-0 top-6 z-20 w-52 overflow-hidden rounded-lg border border-line bg-ink-900 shadow-xl shadow-black/40">
              {post.mine ? (
                <>
                  <button
                    onClick={() => {
                      setEditing(true);
                      setDraft(post.caption);
                      setMenu(false);
                    }}
                    className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-text transition-colors hover:bg-ink-850"
                  >
                    <Pencil className="size-3.5" /> Edit caption
                  </button>
                  <button
                    onClick={() =>
                      start(async () => {
                        const res = await deletePost(post.id);
                        setMenu(false);
                        if (!res.ok) {
                          setFailed(res.error);
                          return;
                        }
                        router.refresh();
                      })
                    }
                    className="flex w-full items-center gap-2 border-t border-line px-3 py-2.5 text-left text-sm text-correction transition-colors hover:bg-ink-850"
                  >
                    <Trash2 className="size-3.5" /> Delete post
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => {
                      setReporting(true);
                      setMenu(false);
                    }}
                    className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-text transition-colors hover:bg-ink-850"
                  >
                    <Flag className="size-3.5" /> Report this post
                  </button>
                  <button
                    onClick={() =>
                      start(async () => {
                        const res = await blockUser(post.author.userId);
                        setMenu(false);
                        if (!res.ok) {
                          setFailed(res.error);
                          return;
                        }
                        router.refresh();
                      })
                    }
                    className="flex w-full min-w-0 items-center gap-2 border-t border-line px-3 py-2.5 text-left text-sm text-correction transition-colors hover:bg-ink-850"
                  >
                    <UserX className="size-3.5 shrink-0" /> <span className="truncate">Block {post.author.name}</span>
                  </button>
                </>
              )}
            </div>
            </>
          )}
        </div>
      </header>

      {/* Media — the post itself. */}
      {post.media && (
        <div
          className="relative w-full overflow-hidden rounded-lg border border-line bg-ink-850"
          // Reserved before it loads, so nothing below jumps.
          style={{ aspectRatio: aspectOf(post.media) }}
        >
          {post.media.kind === "youtube" ? (
            <iframe
              src={`https://www.youtube.com/embed/${post.media.url}`}
              title="Clip"
              allow="accelerometer; clipboard-write; encrypted-media; picture-in-picture"
              allowFullScreen
              className="absolute inset-0 size-full"
            />
          ) : post.media.kind === "video" ? (
            <video
              src={post.media.url}
              controls
              playsInline
              preload="metadata"
              className="absolute inset-0 size-full object-cover"
            />
          ) : (
            <Image
              src={post.media.url}
              alt=""
              fill
              unoptimized
              sizes="(max-width: 640px) 100vw, 640px"
              className="object-cover"
            />
          )}
        </div>
      )}

      {/* The quote card — a study insight where the words are the media. */}
      {asQuote && (
        <blockquote className="rounded-lg border border-signal-line bg-signal-wash px-5 py-6">
          <p className="font-display text-2xl font-bold uppercase leading-tight text-text-hi">
            “{post.caption}”
          </p>
        </blockquote>
      )}

      {/*
        The kicker — MIDO's facts, set in the display voice, native to
        the post. FILM REVIEW / 6:14 / CLOSED BODY.
      */}
      {(post.kind || post.clip) && !asQuote && (
        <div
          className={cn(
            "font-display px-1 pt-3 text-lg font-bold uppercase leading-none tracking-wide",
            kickerClass(post.kind),
          )}
        >
          {[
            post.kind === "film" && post.clip ? "Film review" : kindLabel(post.kind),
            post.clip ? fmtTime(post.clip.start) : null,
            post.clip?.title ?? post.tags[0] ?? null,
          ]
            .filter(Boolean)
            .join(" / ")}
        </div>
      )}

      {/* Actions — words, quietly. */}
      <div className="data-mono flex items-center gap-4 px-1 pt-3 text-[11px] uppercase tracking-wider">
        <button
          onClick={like}
          aria-pressed={liked}
          className={cn("transition-colors", liked ? "text-signal-bright" : "text-text-dim hover:text-text")}
        >
          Appreciate{likes > 0 ? ` ${compactCount(likes)}` : ""}
        </button>
        <Link
          href={`/app/community/posts/${post.id}`}
          className="text-text-dim transition-colors hover:text-text"
        >
          Comment{post.comments > 0 ? ` ${compactCount(post.comments)}` : ""}
        </Link>
        <button
          onClick={save}
          aria-pressed={saved}
          className={cn("transition-colors", saved ? "text-signal-bright" : "text-text-dim hover:text-text")}
        >
          {saved ? "Saved" : "Save"}
        </button>
        <button onClick={share} className="text-text-dim transition-colors hover:text-text">
          Share
        </button>
      </div>

      {/* Caption */}
      {editing ? (
        <div className="px-1 pt-2">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value.slice(0, CAPTION_MAX))}
            rows={3}
            autoFocus
            className="w-full resize-none rounded-lg border border-signal-line bg-ink-850 px-3 py-2 text-sm text-text-hi focus:outline-none"
          />
          <div className="mt-2 flex items-center gap-2">
            <button
              onClick={saveEdit}
              disabled={pending}
              className="h-8 rounded-lg border border-signal-line bg-signal/10 px-3 text-xs font-medium text-signal-bright disabled:opacity-50"
            >
              Save
            </button>
            <button
              onClick={() => setEditing(false)}
              className="h-8 rounded-lg border border-line px-3 text-xs text-text-dim"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        post.caption &&
        !asQuote && (
          <p className="whitespace-pre-line px-1 pt-2 text-sm leading-relaxed text-text">
            {post.caption}
          </p>
        )
      )}

      {post.tags.length > 0 && !asQuote && (
        <div className="flex flex-wrap gap-1.5 px-1 pt-2">
          {post.tags.map((t) => (
            <span key={t} className="chip">
              {t}
            </span>
          ))}
        </div>
      )}

      {reporting && (
        <ReportDialog
          postId={post.id}
          onClose={() => setReporting(false)}
          onDone={() => {
            setReporting(false);
            setDone("Reported. Somebody will look at it.");
          }}
        />
      )}
      {done && <p className="px-1 pt-2 text-xs text-positive">{done}</p>}
      {failed && <p className="px-1 pt-2 text-xs text-correction">{failed}</p>}
      {pending && <span className="sr-only">Working…</span>}
    </article>
  );
}

function ReportDialog({
  postId,
  onClose,
  onDone,
}: {
  postId: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const [reason, setReason] = useState(REPORT_REASONS[0].value);
  const [detail, setDetail] = useState("");
  const [failed, setFailed] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <div className="mt-3 rounded-lg border border-line bg-ink-850 p-4">
      <h3 className="text-sm font-medium text-text-hi">What is wrong with this post?</h3>
      <p className="mt-1 text-xs leading-relaxed text-text-faint">
        A person will read this. Nothing is deleted automatically, and the poster is not told who
        reported them.
      </p>
      <div className="mt-3 space-y-1.5">
        {REPORT_REASONS.map((r) => (
          <label key={r.value} className="flex items-center gap-2 text-sm text-text">
            <input
              type="radio"
              name={`reason-${postId}`}
              value={r.value}
              checked={reason === r.value}
              onChange={() => setReason(r.value)}
              className="accent-[var(--signal)]"
            />
            {r.label}
          </label>
        ))}
      </div>
      <textarea
        value={detail}
        onChange={(e) => setDetail(e.target.value)}
        rows={2}
        placeholder="Anything else worth knowing (optional)"
        className="mt-3 w-full resize-none rounded-lg border border-line bg-ink-900 px-3 py-2 text-sm text-text-hi placeholder:text-text-faint focus:border-signal-line focus:outline-none"
      />
      {failed && <p className="mt-2 text-xs text-correction">{failed}</p>}
      <div className="mt-3 flex items-center gap-2">
        <button
          onClick={() => start(async () => {
            const res = await reportPost(postId, reason, detail);
            if (!res.ok) {
              setFailed(res.error);
              return;
            }
            onDone();
          })}
          disabled={pending}
          className="flex h-9 items-center gap-2 rounded-lg border border-correction/40 bg-correction/10 px-3 text-sm font-medium text-correction disabled:opacity-50"
        >
          {pending ? <Loader2 className="size-4 animate-spin" /> : <Flag className="size-4" />}
          Send report
        </button>
        <button onClick={onClose} className="h-9 rounded-lg border border-line px-3 text-sm text-text-dim">
          Cancel
        </button>
      </div>
    </div>
  );
}

// The avatar became a shared primitive; re-exported so existing imports keep working.
export { Avatar } from "@/components/ui/avatar";
