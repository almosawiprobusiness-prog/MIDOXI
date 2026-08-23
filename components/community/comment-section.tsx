"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Send, Trash2 } from "lucide-react";
import { addComment, deleteComment } from "@/app/app/community/actions";
import { timeAgo, type PostComment } from "@/lib/data/community-types";
import { Avatar } from "./feed-post";

export function CommentSection({ postId, comments, currentUserId }: { postId: string; comments: PostComment[]; currentUserId: string | null }) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);

  const post = async () => {
    if (!body.trim()) return;
    setBusy(true);
    await addComment(postId, body);
    setBusy(false);
    setBody("");
    router.refresh();
  };

  const remove = async (id: string) => {
    await deleteComment(id, postId);
    router.refresh();
  };

  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <span className="label-tech">Discussion · {comments.length}</span>
      </div>

      <div className="flex gap-2">
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={2}
          placeholder="Add to the analysis…"
          className="min-h-11 flex-1 resize-y rounded-lg border border-line bg-ink-850 px-3 py-2 text-sm text-text-hi placeholder:text-text-faint focus:border-signal-line focus:outline-none"
        />
        <button onClick={post} disabled={busy || !body.trim()} className="flex h-11 shrink-0 items-center gap-2 self-start rounded-lg bg-signal px-3.5 text-sm font-medium text-white transition-colors hover:bg-signal-deep disabled:opacity-50">
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
        </button>
      </div>

      <div className="mt-4 space-y-3">
        {comments.length === 0 && <p className="text-sm text-text-dim">No replies yet. Start the conversation.</p>}
        {comments.map((c) => (
          <div key={c.id} className="group flex gap-2.5">
            <Avatar name={c.authorName} position={null} />
            <div className="min-w-0 flex-1 rounded-lg border border-line bg-ink-900 px-3 py-2">
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-medium text-text-hi">{c.authorName}</span>
                {c.authorHandle && <span className="text-xs text-text-faint">@{c.authorHandle}</span>}
                <span className="text-[11px] text-text-faint">· {timeAgo(c.createdAt)}</span>
                {currentUserId && c.userId === currentUserId && (
                  <button onClick={() => remove(c.id)} aria-label="Delete comment" className="ml-auto text-text-faint opacity-0 transition-opacity hover:text-correction group-hover:opacity-100">
                    <Trash2 className="size-3.5" />
                  </button>
                )}
              </div>
              <p className="mt-1 text-sm text-text">{c.body}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
