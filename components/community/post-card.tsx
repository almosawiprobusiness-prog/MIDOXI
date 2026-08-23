"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import {
  Heart,
  MessageCircle,
  MoreHorizontal,
  Flag,
  Trash2,
  UserX,
  Loader2,
} from "lucide-react";
import { blockUser, deletePost, reportPost, toggleLike } from "@/app/app/community/feed-actions";
import {
  REPORT_REASONS,
  aspectOf,
  compactCount,
  displayHandle,
  timeAgo,
  type Post,
} from "@/lib/data/feed-types";
import { cn } from "@/lib/utils";

/*
  One post in the feed.

  The media is the post and the words go underneath — which is the whole
  difference between this and the forum it replaces, where a title came first
  and a clip was an attachment.

  Three details that are easy to skip and would each be felt:

  · The aspect ratio is reserved BEFORE the image loads. Without it every
    picture that lands shoves the rest of the feed down, and on a phone that
    means tapping the wrong post.

  · The like is optimistic. A heart that waits for a round trip feels broken,
    and the failure case — the count is briefly wrong — costs nothing.

  · Report and block are on every post, one tap from the corner, for anybody.
    Not buried in settings, and not something you have to be an admin to reach.
*/

export function PostCard({ post }: { post: Post }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [liked, setLiked] = useState(post.likedByMe);
  const [likes, setLikes] = useState(post.likes);
  const [menu, setMenu] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [done, setDone] = useState<string | null>(null);

  const like = () => {
    // Optimistic: the heart moves now, the server catches up.
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

  const profileHref = post.author.handle
    ? `/app/community/${post.author.handle}`
    : `/app/community/${post.author.userId}`;

  return (
    <article className="border-b border-line pb-4">
      {/* Author */}
      <header className="flex items-center gap-2.5 px-1 py-3">
        <Link href={profileHref} className="shrink-0">
          <Avatar url={post.author.avatar} name={post.author.name} size={34} />
        </Link>
        <div className="min-w-0 flex-1">
          <Link href={profileHref} className="block truncate text-sm font-medium text-text-hi hover:underline">
            {post.author.name}
          </Link>
          <span className="block truncate text-xs text-text-faint">
            {displayHandle(post.author)}
            {post.author.position ? ` · ${post.author.position}` : ""}
          </span>
        </div>
        <span className="shrink-0 text-xs text-text-faint">{timeAgo(post.createdAt)}</span>

        <div className="relative shrink-0">
          <button
            onClick={() => setMenu((m) => !m)}
            aria-label="Post options"
            className="text-text-faint transition-colors hover:text-text"
          >
            <MoreHorizontal className="size-4" />
          </button>
          {menu && (
            <div className="absolute right-0 top-6 z-20 w-52 overflow-hidden rounded-lg border border-line bg-ink-900 shadow-xl shadow-black/40">
              {post.mine ? (
                <button
                  onClick={() =>
                    start(async () => {
                      await deletePost(post.id);
                      setMenu(false);
                      router.refresh();
                    })
                  }
                  className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-correction transition-colors hover:bg-ink-850"
                >
                  <Trash2 className="size-3.5" /> Delete post
                </button>
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
                        await blockUser(post.author.userId);
                        setMenu(false);
                        router.refresh();
                      })
                    }
                    className="flex w-full items-center gap-2 border-t border-line px-3 py-2.5 text-left text-sm text-correction transition-colors hover:bg-ink-850"
                  >
                    <UserX className="size-3.5" /> Block {post.author.name}
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </header>

      {/* Media */}
      {post.media && (
        <div
          className="relative w-full overflow-hidden bg-ink-850"
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
              sizes="(max-width: 640px) 100vw, 560px"
              className="object-cover"
            />
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-4 px-1 pt-3">
        <button
          onClick={like}
          aria-label={liked ? "Unlike" : "Like"}
          aria-pressed={liked}
          className={cn(
            "flex items-center gap-1.5 text-sm transition-colors",
            liked ? "text-correction" : "text-text-dim hover:text-text",
          )}
        >
          <Heart className={cn("size-5", liked && "fill-current")} />
          {likes > 0 && <span className="data-mono text-xs">{compactCount(likes)}</span>}
        </button>
        <Link
          href={`/app/community/posts/${post.id}`}
          className="flex items-center gap-1.5 text-sm text-text-dim transition-colors hover:text-text"
        >
          <MessageCircle className="size-5" />
          {post.comments > 0 && (
            <span className="data-mono text-xs">{compactCount(post.comments)}</span>
          )}
        </Link>
      </div>

      {/* Caption */}
      {post.caption && (
        <p className="whitespace-pre-line px-1 pt-2 text-sm leading-relaxed text-text">
          <Link href={profileHref} className="font-medium text-text-hi hover:underline">
            {displayHandle(post.author)}
          </Link>{" "}
          {post.caption}
        </p>
      )}

      {post.tags.length > 0 && (
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
      <div className="mt-3 flex items-center gap-2">
        <button
          onClick={() => start(async () => {
            await reportPost(postId, reason, detail);
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

export function Avatar({
  url,
  name,
  size = 34,
}: {
  url: string | null;
  name: string;
  size?: number;
}) {
  const initials =
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase())
      .join("") || "?";

  return url ? (
    <Image
      src={url}
      alt=""
      width={size}
      height={size}
      unoptimized
      className="shrink-0 rounded-full border border-line object-cover"
      style={{ width: size, height: size }}
    />
  ) : (
    <span
      className="grid shrink-0 place-items-center rounded-full border border-line bg-ink-850 font-display font-bold text-text-faint"
      style={{ width: size, height: size, fontSize: size * 0.36 }}
    >
      {initials}
    </span>
  );
}
