"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, Loader2, Check, Dumbbell, Target, Plus, AlertCircle } from "lucide-react";
import {
  personaliseStudy,
  takeIntoTraining,
  applyToMyGame,
  toggleModule,
  saveNote,
} from "@/app/app/study/actions";
import { cn } from "@/lib/utils";

/* Client controls for the study loop. Each one writes a real row. */

function useAction() {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const run = (fn: () => Promise<{ ok: true; message?: string } | { ok: false; error: string }>) => {
    setError(null);
    start(async () => {
      const res = await fn();
      if (res.ok) setDone(res.message ?? "Done");
      else setError(res.error);
    });
  };
  return { pending, error, done, run };
}

function Feedback({ error, done }: { error: string | null; done: string | null }) {
  if (error) {
    return (
      <p className="mt-2 flex items-start gap-1.5 text-xs leading-relaxed text-review">
        <AlertCircle className="mt-0.5 size-3.5 shrink-0" />
        {error}
      </p>
    );
  }
  if (done) {
    return (
      <p className="mt-2 flex items-center gap-1.5 text-xs text-positive">
        <Check className="size-3.5 shrink-0" />
        {done}
      </p>
    );
  }
  return null;
}

export function PersonaliseButton({ slug, enhanced }: { slug: string; enhanced: boolean }) {
  const { pending, error, done, run } = useAction();
  const router = useRouter();

  return (
    <div>
      <button
        onClick={() =>
          run(async () => {
            const res = await personaliseStudy(slug);
            if (res.ok) router.refresh();
            return res;
          })
        }
        disabled={pending}
        className={cn(
          "flex h-9 items-center gap-2 rounded-lg border px-3 text-sm font-medium transition-colors disabled:opacity-60",
          enhanced
            ? "border-line text-text-dim hover:border-signal-line hover:text-signal-bright"
            : "border-signal-line bg-signal/10 text-signal-bright hover:bg-signal/20",
        )}
      >
        {pending ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
        {enhanced ? "Regenerate" : "Personalise with MIDO"}
      </button>
      <Feedback error={error} done={done} />
    </div>
  );
}

export function TakeIntoTrainingButton({ slug }: { slug: string }) {
  const { pending, error, done, run } = useAction();
  return (
    <div>
      <button
        onClick={() => run(() => takeIntoTraining(slug))}
        disabled={pending}
        className="flex h-10 items-center gap-2 rounded-lg border border-signal-line bg-signal/10 px-4 text-sm font-medium text-signal-bright transition-colors hover:bg-signal/20 disabled:opacity-60"
      >
        {pending ? <Loader2 className="size-4 animate-spin" /> : <Dumbbell className="size-4" />}
        Add to my training
      </button>
      <Feedback error={error} done={done} />
    </div>
  );
}

export function ApplyToGameButton({ slug, goalTitle }: { slug: string; goalTitle: string }) {
  const { pending, error, done, run } = useAction();
  return (
    <div>
      <button
        onClick={() => run(() => applyToMyGame(slug))}
        disabled={pending}
        className="flex h-10 items-center gap-2 rounded-lg border border-signal-line bg-signal/10 px-4 text-sm font-medium text-signal-bright transition-colors hover:bg-signal/20 disabled:opacity-60"
      >
        {pending ? <Loader2 className="size-4 animate-spin" /> : <Target className="size-4" />}
        Make &ldquo;{goalTitle}&rdquo; a development goal
      </button>
      <Feedback error={error} done={done} />
    </div>
  );
}

export function ModuleToggle({
  slug,
  moduleKey,
  complete,
}: {
  slug: string;
  moduleKey: string;
  complete: boolean;
}) {
  const [on, setOn] = useState(complete);
  const [pending, start] = useTransition();

  return (
    <button
      onClick={() => {
        const next = !on;
        setOn(next);
        start(async () => {
          const res = await toggleModule(slug, moduleKey, next);
          if (!res.ok) setOn(!next);
        });
      }}
      disabled={pending}
      aria-pressed={on}
      className={cn(
        "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] transition-colors",
        on
          ? "border-positive/40 bg-positive/10 text-positive"
          : "border-line text-text-faint hover:border-line-strong hover:text-text-dim",
      )}
    >
      {pending ? <Loader2 className="size-3 animate-spin" /> : <Check className="size-3" />}
      {on ? "Studied" : "Mark studied"}
    </button>
  );
}

export function NoteBox({ slug }: { slug: string }) {
  const [body, setBody] = useState("");
  const { pending, error, done, run } = useAction();

  return (
    <div>
      <div className="flex gap-2">
        <input
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && body.trim()) {
              run(() => saveNote(slug, body));
              setBody("");
            }
          }}
          placeholder="What did you notice? Add your own observation…"
          className="h-10 flex-1 rounded-lg border border-line bg-ink-850 px-3 text-sm text-text-hi placeholder:text-text-faint focus:border-signal-line focus:outline-none"
        />
        <button
          onClick={() => {
            run(() => saveNote(slug, body));
            setBody("");
          }}
          disabled={pending || !body.trim()}
          className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-line text-text-dim transition-colors hover:border-signal-line hover:text-signal-bright disabled:opacity-40"
          aria-label="Save observation"
        >
          {pending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
        </button>
      </div>
      <Feedback error={error} done={done} />
    </div>
  );
}
