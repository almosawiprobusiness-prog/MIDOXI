"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Loader2 } from "lucide-react";
import { deletePost } from "@/app/app/community/actions";

export function DeletePostButton({ id }: { id: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);

  const go = async () => {
    setBusy(true);
    const res = await deletePost(id);
    if (res.ok) { router.push("/app/community"); router.refresh(); }
    else setBusy(false);
  };

  if (!confirm) {
    return (
      <button onClick={() => setConfirm(true)} aria-label="Delete post" className="flex size-9 items-center justify-center rounded-lg border border-line text-text-dim transition-colors hover:border-correction/40 hover:text-correction">
        <Trash2 className="size-4" />
      </button>
    );
  }
  return (
    <button onClick={go} disabled={busy} className="flex h-9 items-center gap-1.5 rounded-lg border border-correction/40 px-3 text-sm text-correction transition-colors hover:bg-correction/10 disabled:opacity-60">
      {busy ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />} Confirm
    </button>
  );
}
