"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Check } from "lucide-react";
import { saveMatchStats } from "@/app/app/matches/actions";
import { STAT_FIELDS, type MatchStatsInput } from "@/lib/data/match-types";

export function StatsForm({
  matchId,
  initial,
}: {
  matchId: string;
  initial: MatchStatsInput | null;
}) {
  const router = useRouter();
  const [values, setValues] = useState<MatchStatsInput>(initial ?? {});
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (key: keyof MatchStatsInput, v: string) =>
    setValues((prev) => ({ ...prev, [key]: v === "" ? null : Number(v) }));

  const save = async () => {
    setBusy(true);
    setError(null);
    const res = await saveMatchStats(matchId, values);
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
      <div className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3 lg:grid-cols-4">
        {STAT_FIELDS.map((f) => (
          <label key={f.key}>
            <span className="label-tech mb-1 block">{f.label}</span>
            <input
              type="number"
              step={f.key === "passPct" ? "0.1" : "1"}
              value={values[f.key] ?? ""}
              onChange={(e) => set(f.key, e.target.value)}
              placeholder="—"
              className="h-9 w-full rounded-lg border border-line bg-ink-850 px-2.5 text-sm text-text-hi placeholder:text-text-faint focus:border-signal-line focus:outline-none"
            />
          </label>
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
          Save stats
        </button>
        {saved && <span className="text-sm text-positive">Saved</span>}
      </div>
    </div>
  );
}
