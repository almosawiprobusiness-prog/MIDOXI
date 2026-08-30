"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Sparkles, Play, BookOpen, Loader2, Film, Target, Crown, Wand2 } from "lucide-react";
import { studyRecommendation, generateAiPicks } from "@/app/app/film-room/discover-actions";
import type { DiscoverResult, StudyRecommendation } from "@/lib/data/discover-types";

function fmtDur(s?: number) {
  if (!s) return null;
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, "0")}`;
}

export function DiscoverPanel({ result }: { result: DiscoverResult }) {
  const { context, youtubeEnabled, ai } = result;
  const [recs, setRecs] = useState<StudyRecommendation[]>(result.recommendations);
  const [mode, setMode] = useState<"heuristic" | "ai">("heuristic");
  const [remaining, setRemaining] = useState(ai.remaining);
  const [pending, start] = useTransition();
  const [notice, setNotice] = useState<string | null>(null);

  function generate() {
    setNotice(null);
    start(async () => {
      const res = await generateAiPicks();
      if (res.ok) {
        setRecs(res.recommendations);
        setMode("ai");
        setRemaining(res.remaining);
        return;
      }
      const map: Record<string, string> = {
        not_pro: "Upgrade to Pro to unlock AI study picks.",
        quota: "You’ve used all your AI study picks this month.",
        no_credits: "AI is warming up — try again shortly.",
        unavailable: "AI is temporarily unavailable.",
        empty: "No AI picks right now — try again later.",
      };
      setNotice(map[res.reason] ?? "Could not generate picks.");
    });
  }

  const canGenerate = ai.isPro && ai.reachable && remaining > 0;

  return (
    <div className="relative mb-8 overflow-hidden rounded-xl border border-signal-line bg-gradient-to-b from-signal/10 via-ink-900 to-ink-900 p-5">
      <div className="field-glow absolute inset-0" aria-hidden />
      <div className="relative">
        <div className="label-tech !text-signal-bright mb-3">Study engine / 01</div>
        <div className="flex flex-wrap items-center gap-4">
          <span className="grid size-11 place-items-center rounded-lg border border-signal-line bg-signal/10 text-signal-bright">
            <Sparkles className="size-5" />
          </span>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h2 className="font-display text-base font-bold uppercase tracking-tight text-text-hi">Discover — Study Engine</h2>
              {mode === "ai" ? <span className="chip chip-signal">AI · LIVE</span> : <span className="chip">SMART</span>}
            </div>
            <p className="mt-0.5 text-sm text-text-dim">
              {context.position
                ? `Film for a ${context.position}${context.goals.length ? ` working on ${context.goals.length} goal${context.goals.length > 1 ? "s" : ""}` : ""}.`
                : "Personalised film for your position and goals."}
            </p>
          </div>

          {/* AI action / upsell */}
          <div className="text-right">
            {ai.isPro ? (
              <button
                onClick={generate}
                disabled={pending || !canGenerate}
                className="inline-flex items-center gap-2 rounded-lg border border-signal-line bg-signal/10 px-3.5 py-2 text-sm font-medium text-signal-bright transition-colors hover:bg-signal/20 disabled:opacity-50"
                title={!ai.reachable ? "AI temporarily unavailable" : remaining <= 0 ? "Monthly limit reached" : ""}
              >
                {pending ? <Loader2 className="size-4 animate-spin" /> : <Wand2 className="size-4" />}
                {pending ? "Analysing…" : mode === "ai" ? "Regenerate" : "AI picks"}
              </button>
            ) : (
              <Link
                href="/app/membership"
                className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-br from-signal to-signal-deep px-3.5 py-2 text-sm font-semibold text-white shadow-lg shadow-signal/20 transition-opacity hover:opacity-95"
              >
                <Crown className="size-4" /> Unlock AI
              </Link>
            )}
            {ai.isPro && ai.limit > 0 && (
              <div className="label-tech mt-1">{remaining} / {ai.limit} AI picks left</div>
            )}
          </div>
        </div>

        {notice && (
          <p className="mt-3 rounded-lg border border-line bg-ink-850 px-3 py-2 text-xs text-text-dim">{notice}</p>
        )}

        {!youtubeEnabled ? (
          <p className="mt-4 rounded-lg border border-line bg-ink-850 px-3 py-2 text-xs text-text-dim">
            Connect a YouTube Data API key to surface study film here.
          </p>
        ) : recs.length === 0 ? (
          <p className="mt-4 rounded-lg border border-line bg-ink-850 px-3 py-2 text-xs text-text-dim">
            No picks yet — set a development goal and your position to sharpen recommendations.
          </p>
        ) : (
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {recs.map((rec) => (
              <RecCard key={rec.videoId} rec={rec} />
            ))}
          </div>
        )}

        {mode === "heuristic" && ai.isPro && (
          <p className="mt-3 text-[11px] text-text-faint">Smart-ranked from your profile. Tap “AI picks” for a personally-reasoned reel.</p>
        )}
      </div>
    </div>
  );
}

function RecCard({ rec }: { rec: StudyRecommendation }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const dur = fmtDur(rec.durationSeconds);

  function onStudy() {
    setErr(null);
    start(async () => {
      const res = await studyRecommendation({ title: rec.title, url: rec.url });
      if (!res.ok) {
        setErr(res.error);
        return;
      }
      if (res.studyId) router.push(`/app/film-room/study/${res.studyId}`);
      else if (res.videoId) router.push(`/app/film-room/${res.videoId}`);
      else router.refresh();
    });
  }

  return (
    <div className="group panel overflow-hidden">
      <a href={rec.url} target="_blank" rel="noopener noreferrer" className="relative block aspect-video overflow-hidden bg-ink-900">
        {rec.thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={rec.thumbnailUrl} alt="" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />
        ) : (
          <div className="flex h-full items-center justify-center"><Film className="size-8 text-text-faint" /></div>
        )}
        <span className="absolute inset-0 grid place-items-center bg-black/20 opacity-0 transition-opacity group-hover:opacity-100">
          <span className="grid size-11 place-items-center rounded-full bg-black/50 text-white"><Play className="size-5" fill="currentColor" /></span>
        </span>
        {dur && <span className="data-mono absolute bottom-2 right-2 rounded bg-black/70 px-1.5 py-0.5 text-[10px] text-text">{dur}</span>}
        <span className="absolute left-2 top-2 rounded bg-black/60 px-1.5 py-0.5 text-[9px] font-semibold tracking-wide text-text-dim">YT</span>
      </a>

      <div className="p-3">
        <h3 className="line-clamp-2 text-sm font-medium leading-snug text-text-hi">{rec.title}</h3>
        <div className="label-tech mt-1 truncate">{rec.channel}</div>
        <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-text-dim">{rec.reason}</p>

        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {rec.matchedGoal ? (
            <span className="chip chip-signal inline-flex items-center gap-1"><Target className="size-3" /> {rec.matchedGoal}</span>
          ) : (
            <span className="chip">{rec.theme}</span>
          )}
        </div>

        <button
          onClick={onStudy}
          disabled={pending}
          className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-signal-line bg-signal/10 px-3 py-1.5 text-xs font-medium text-signal-bright transition-colors hover:bg-signal/20 disabled:opacity-60"
        >
          {pending ? <Loader2 className="size-3.5 animate-spin" /> : <BookOpen className="size-3.5" />}
          {pending ? "Adding…" : "Add & study"}
        </button>
        {err && <p className="mt-1.5 text-[11px] text-review">{err}</p>}
      </div>
    </div>
  );
}
