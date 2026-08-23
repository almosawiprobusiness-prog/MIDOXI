"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, UserPlus } from "lucide-react";
import { toggleFollow } from "@/app/app/community/feed-actions";
import { cn } from "@/lib/utils";

/*
  Follow, and unfollow without a confirmation dialog.

  Optimistic, because a button that waits for a round trip before changing
  feels broken — and the failure case is that it flips back, which is
  self-explanatory.

  Unfollowing asks nothing. A confirm step on unfollow exists to make leaving
  feel costly, which is the sort of thing this product should not do.
*/

export function FollowButton({
  targetId,
  following: initial,
}: {
  targetId: string;
  following: boolean;
}) {
  const router = useRouter();
  const [following, setFollowing] = useState(initial);
  const [pending, start] = useTransition();

  const click = () => {
    const next = !following;
    setFollowing(next);
    start(async () => {
      const res = await toggleFollow(targetId);
      if (!res.ok) setFollowing(!next);
      else router.refresh();
    });
  };

  return (
    <button
      onClick={click}
      disabled={pending}
      className={cn(
        "flex h-9 items-center gap-1.5 rounded-lg border px-3 text-sm font-medium transition-colors disabled:opacity-60",
        following
          ? "border-line text-text-dim hover:border-correction/40 hover:text-correction"
          : "border-signal-line bg-signal/10 text-signal-bright hover:bg-signal/20",
      )}
    >
      {pending ? (
        <Loader2 className="size-4 animate-spin" />
      ) : following ? (
        <Check className="size-4" />
      ) : (
        <UserPlus className="size-4" />
      )}
      {following ? "Following" : "Follow"}
    </button>
  );
}
