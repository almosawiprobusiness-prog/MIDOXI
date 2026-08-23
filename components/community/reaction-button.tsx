"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Flame } from "lucide-react";
import { toggleReaction } from "@/app/app/community/actions";

export function ReactionButton({ postId, count, hasReacted }: { postId: string; count: number; hasReacted: boolean }) {
  const router = useRouter();
  const [on, setOn] = useState(hasReacted);
  const [n, setN] = useState(count);
  const [busy, setBusy] = useState(false);

  const click = async () => {
    if (busy) return;
    setBusy(true);
    const next = !on;
    setOn(next); setN((c) => c + (next ? 1 : -1));
    await toggleReaction(postId);
    setBusy(false);
    router.refresh();
  };

  return (
    <button
      onClick={click}
      aria-pressed={on}
      className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs transition-colors ${on ? "border-signal-line bg-signal/10 text-signal-bright" : "border-line text-text-dim hover:text-text"}`}
    >
      <Flame className="size-3.5" fill={on ? "currentColor" : "none"} />
      {n}
    </button>
  );
}
