"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Check, Film } from "lucide-react";
import { saveMatchReview } from "@/app/app/matches/actions";
import { REVIEW_PROMPTS, type MatchReviewInput } from "@/lib/data/match-types";

const RATINGS: { key: keyof MatchReviewInput; label: string; max: number }[] = [
  { key: "selfRating", label: "Overall", max: 10 },
  { key: "confidence", label: "Confidence", max: 10 },
  { key: "physicalFeel", label: "Physical", max: 5 },
  { key: "mentalFeel", label: "Mental", max: 5 },
];

export function ReviewForm({
  matchId,
  initial,
}: {
  matchId: string;
  initial: MatchReviewInput | null;
  momentIntoFilm?: boolean;
}) {
  const router = useRouter();
  const [values, setValues] = useState<MatchReviewInput>(initial ?? {});
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setText = (key: keyof MatchReviewInput, v: string) =>
    setValues((prev) => ({ ...prev, [key]: v }));
  const setNum = (key: keyof MatchReviewInput, v: number) =>
    setValues((prev) => ({ ...prev, [key]: v }));

  const save = async () => {
    setBusy(true);
    setError(null);
    const res = await saveMatchReview(matchId, values);
    setBusy(false);
    if (res.ok) {
      setSaved(true);
      router.refresh();
      setTimeout(() => setSaved(false), 2000);
    } else {
      setError(res.error);
    }
  };

  return (
    <div className="panel p-5">
      <div className="grid gap-4 md:grid-cols-2">
        {REVIEW_PROMPTS.map((p) => (
          <label key={p.key} className={p.key === "momentToStudy" || p.key === "intoTraining" ? "md:col-span-1" : ""}>
            <span className="flex items-center gap-2 text-sm text-text-hi">
              {p.label}
              {p.key === "momentToStudy" && <Film className="size-3.5 text-signal-bright" />}
            </span>
            {p.hint && <span className="label-tech mb-1.5 block">{p.hint}</span>}
            <textarea
              value={(values[p.key] as string) ?? ""}
              onChange={(e) => setText(p.key, e.target.value)}
              rows={2}
              placeholder="…"
              className="mt-1 w-full resize-y rounded-lg border border-line bg-ink-850 px-3 py-2 text-sm text-text-hi placeholder:text-text-faint focus:border-signal-line focus:outline-none"
            />
          </label>
        ))}
      </div>

      {/* Ratings */}
      <div className="mt-5 grid gap-4 border-t border-line pt-5 sm:grid-cols-2 lg:grid-cols-4">
        {RATINGS.map((r) => (
          <div key={r.key}>
            <div className="mb-1.5 flex items-baseline justify-between">
              <span className="text-sm text-text-hi">{r.label}</span>
              <span className="data-mono text-sm text-signal-bright">
                {(values[r.key] as number) ?? "—"}
                <span className="text-text-faint">/{r.max}</span>
              </span>
            </div>
            <input
              type="range"
              min={1}
              max={r.max}
              value={(values[r.key] as number) ?? Math.round(r.max / 2)}
              onChange={(e) => setNum(r.key, Number(e.target.value))}
              className="mido-range w-full"
              aria-label={r.label}
            />
          </div>
        ))}
      </div>

      {error && (
        <p className="mt-4 rounded-lg border border-correction/30 bg-correction/10 px-3 py-2 text-sm text-correction">
          {error}
        </p>
      )}

      <div className="mt-5 flex items-center gap-3">
        <button
          onClick={save}
          disabled={busy}
          className="flex h-10 items-center gap-2 rounded-lg bg-signal px-4 text-sm font-medium text-white transition-colors hover:bg-signal-deep disabled:opacity-60"
        >
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
          Save review
        </button>
        {saved && <span className="text-sm text-positive">Saved</span>}
      </div>
    </div>
  );
}
