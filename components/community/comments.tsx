"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Send, Trash2 } from "lucide-react";
import { addComment, deleteComment } from "@/app/app/community/actions";
import { displayHandle, timeAgo } from "@/lib/data/feed-types";
import { Avatar } from "@/components/ui/avatar";
import { FormError } from "@/components/forms/ui";

/*
  Replies under a post.

  Flat, oldest first, no threading. A conversation about a clip is three or
  four exchanges; nesting turns that into a structure people have to navigate
  rather than read.

  Anybody may delete their own comment, and the post's author may delete any
  comment on their own post — the ordinary rule everywhere, and the one that
  lets somebody clean up their own thread without waiting for a moderator.
*/

export interface CommentRow {
  id: string;
  userId: string;
  name: string;
  handle: string | null;
  body: string;
  createdAt: string;
  mine: boolean;
}

export function Comments({
  postId,
  comments,
  canModerate,
}: {
  postId: string;
  comments: CommentRow[];
  /** True when the reader owns the post. */
  canModerate?: boolean;
}) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const send = () =>
    start(async () => {
      setError(null);
      const res = await addComment(postId, body);
      if (res.ok) {
        setBody("");
        router.refresh();
      } else setError(res.error);
    });

  return (
    <section className="pt-4">
      <h2 className="label-tech mb-3">
        {comments.length === 0
          ? "No replies yet"
          : `${comments.length} ${comments.length === 1 ? "reply" : "replies"}`}
      </h2>

      <div className="space-y-4">
        {comments.map((c) => (
          <div key={c.id} className="group flex gap-2.5">
            <Avatar url={null} name={c.name} size={28} />
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline gap-2">
                <span className="truncate text-sm font-medium text-text-hi">{c.name}</span>
                <span className="data-mono shrink-0 text-[10px] uppercase tracking-wider text-text-faint">
                  {displayHandle({ handle: c.handle, name: c.name })} · {timeAgo(c.createdAt)}
                </span>
              </div>
              <p className="mt-0.5 text-sm leading-relaxed text-text">{c.body}</p>
            </div>
            {(c.mine || canModerate) && (
              <button
                onClick={() =>
                  start(async () => {
                    await deleteComment(c.id, postId);
                    router.refresh();
                  })
                }
                aria-label="Delete reply"
                className="shrink-0 text-text-faint opacity-0 transition-all hover:text-correction group-hover:opacity-100"
              >
                <Trash2 className="size-3.5" />
              </button>
            )}
          </div>
        ))}
      </div>

      <div className="mt-4 flex items-end gap-2">
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={1}
          maxLength={500}
          placeholder="Add a reply"
          className="min-h-10 flex-1 resize-none rounded-lg border border-line bg-ink-850 px-3 py-2.5 text-sm text-text-hi placeholder:text-text-faint focus:border-signal-line focus:outline-none"
        />
        <button
          onClick={send}
          disabled={pending || !body.trim()}
          aria-label="Send reply"
          className="grid size-10 shrink-0 place-items-center rounded-lg border border-signal-line bg-signal/10 text-signal-bright transition-colors hover:bg-signal/20 disabled:opacity-50"
        >
          {pending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
        </button>
      </div>

      <FormError error={error} />
    </section>
  );
}
