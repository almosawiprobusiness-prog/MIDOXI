"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Loader2 } from "lucide-react";
import { deleteCollection } from "@/app/app/film-room/collection-actions";

export function DeleteCollectionButton({ id }: { id: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const go = async () => {
    if (busy) return;
    setBusy(true);
    const res = await deleteCollection(id);
    if (res.ok) {
      router.push("/app/film-room");
      router.refresh();
    } else setBusy(false);
  };

  return (
    <button onClick={go} className="flex h-9 items-center gap-2 rounded-lg border border-line px-3 text-sm text-text-dim transition-colors hover:border-correction/40 hover:text-correction">
      {busy ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />} Delete collection
    </button>
  );
}
