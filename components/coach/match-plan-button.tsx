"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Sparkles } from "lucide-react";
import { buildMatchPlan } from "@/app/app/opposition/actions";
import { FormError, FormNote } from "@/components/forms/ui";

/**
 * Builds the match plan from the coach's recorded observations. With nothing
 * recorded the action refuses — and says so, rather than inventing scouting.
 */
export function MatchPlanButton({ reportId, hasPlan }: { reportId: string; hasPlan: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  return (
    <div>
      <button
        onClick={() => {
          setError(null);
          setNote(null);
          start(async () => {
            const res = await buildMatchPlan(reportId);
            if (res.ok) {
              setNote(res.message ?? null);
              router.refresh();
            } else {
              setError(res.error);
            }
          });
        }}
        disabled={pending}
        className="flex h-10 items-center gap-2 rounded-lg border border-signal-line bg-signal/10 px-4 text-sm font-medium text-signal-bright transition-colors hover:bg-signal/20 disabled:opacity-60"
      >
        {pending ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
        {hasPlan ? "Rebuild the match plan" : "Build the match plan"}
      </button>
      <FormError error={error} />
      <FormNote message={note} />
    </div>
  );
}
