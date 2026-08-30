"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowUpRight, Check, X, Loader2, Swords, HeartPulse, GraduationCap,
  Dumbbell, ClipboardList, Target, Film, Sparkles,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  markRecommendationDone,
  markRecommendationDismissed,
  trackRecommendationInteraction,
} from "@/app/app/recommendation-actions";
import type { SurfacedAction } from "@/lib/intelligence/next-actions";
import { describeSource } from "@/lib/intelligence/recommendation-types";
import type { ActionKind } from "@/lib/intelligence/next-best-action";
import { Spotlight } from "@/components/marketing/locker-live";

/*
  What to do next, at the top of the Locker.

  One thing prominently, two quietly. The ranking already returns more
  than that and the extras are deliberately not shown: a dashboard
  offering ten equally-weighted suggestions has not prioritised, it has
  delegated the prioritising back to the person it was meant to help.

  Nothing here is phrased by a model. The reason under each line is the
  scorer's own sentence, assembled from the rules that fired — so "why
  this?" answers with the actual cause rather than a plausible-sounding
  one written after the fact.
*/

const KIND: Record<ActionKind, { icon: LucideIcon; href: string; color: string }> = {
  review_match: { icon: ClipboardList, href: "/app/matches", color: "var(--signal-bright)" },
  recovery: { icon: HeartPulse, href: "/app/recovery", color: "var(--review)" },
  study: { icon: GraduationCap, href: "/app/study", color: "var(--signal-bright)" },
  training: { icon: Dumbbell, href: "/app/training", color: "var(--positive)" },
  match_prep: { icon: Swords, href: "/app/matches", color: "var(--signal-bright)" },
  checkin: { icon: HeartPulse, href: "/app/recovery", color: "var(--review)" },
  log_match: { icon: Swords, href: "/app/matches", color: "var(--text-dim)" },
  set_goal: { icon: Target, href: "/app/development", color: "var(--signal-bright)" },
};

const FALLBACK = { icon: Film, href: "/app", color: "var(--text-dim)" };

export function NextBestAction({
  items,
  informed,
}: {
  items: SurfacedAction[];
  informed: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [why, setWhy] = useState<string | null>(null);

  /*
    Two different kinds of nothing, said as two different things.

    Not knowing enough and having nothing left to say are opposite
    states, and collapsing them into one message would tell a player who
    has just worked through everything that MIDO knows nothing about
    them. This is also the place a dashboard is most tempted to INVENT —
    an empty hero looks unfinished — and inventing here is what would
    make every later recommendation untrustworthy.
  */
  if (!informed) {
    return (
      <div className="min-w-0 panel-raised overflow-hidden">
        <div className="flex items-baseline justify-between gap-3 border-b border-line px-5 py-3">
          <span className="label-tech">Next</span>
        </div>
        <div className="px-5 py-4">
          <p className="text-sm text-text">
            MIDO does not know enough about you yet to suggest what to do next.
          </p>
          <p className="mt-1 text-sm leading-relaxed text-text-dim">
            Set a development focus or log a match, and this becomes specific.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link href="/app/development" className="chip hover:border-signal-line hover:text-signal-bright">
              Set a focus
            </Link>
            <Link href="/app/matches" className="chip hover:border-signal-line hover:text-signal-bright">
              Log a match
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="min-w-0 panel-raised overflow-hidden">
        <div className="flex items-baseline justify-between gap-3 border-b border-line px-5 py-3">
          <span className="label-tech">Next</span>
          <span className="label-tech">Clear</span>
        </div>
        <div className="flex items-start gap-3 px-5 py-4">
          <Check className="mt-0.5 size-4 shrink-0 text-positive" aria-hidden />
          <div className="min-w-0">
            <p className="text-sm text-text-hi">You have answered everything for today.</p>
            <p className="mt-1 text-sm leading-relaxed text-text-dim">
              MIDO will look again tomorrow. What is below still stands.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const [primary, ...rest] = items;
  const secondary = rest.slice(0, 2);

  const act = (id: string, fn: (id: string) => Promise<unknown>) => {
    setBusyId(id);
    start(async () => {
      await fn(id);
      setBusyId(null);
      router.refresh();
    });
  };

  const meta = (kind: ActionKind) => KIND[kind] ?? FALLBACK;
  const PrimaryIcon = meta(primary.kind).icon;

  /*
    Only the sources that mean something to a person. A token with no
    plain-English reading is plumbing, and is dropped rather than shown
    as evidence it is not.
  */
  const whyLines = primary.sources
    .map(describeSource)
    .filter((l): l is string => Boolean(l));

  return (
    /*
      The command surface. The landing's "next best action" treatment,
      here on the real thing: signal border over a violet wash that
      settles back into ink, and a cursor-tracked glow. The one panel on
      the page allowed to speak in the elevated voice.
    */
    <Spotlight className="relative min-w-0 overflow-hidden rounded-xl border border-signal-line bg-gradient-to-b from-signal/10 via-ink-900 to-ink-900">
      <div className="flex items-baseline justify-between gap-3 border-b border-line px-5 py-3">
        <span className="label-tech !text-signal-bright">Next best action / 01</span>
        <span className="label-tech">MIDO suggests</span>
      </div>

      {/* ── the one thing ── */}
      <div className="px-5 py-4">
        <div className="flex items-start gap-3">
          <span
            className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-lg border border-line bg-ink-850"
            style={{ color: meta(primary.kind).color }}
          >
            <PrimaryIcon className="size-4" />
          </span>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-display text-2xl font-bold uppercase tracking-tight text-text-hi md:text-3xl">{primary.title}</h3>
              {primary.minutes ? <span className="chip">{primary.minutes} min</span> : null}
            </div>
            <p className="mt-1 text-sm leading-relaxed text-text-dim">{primary.reason}</p>

            {/*
              The player's own words, when they bear on this advice. Not
              a caveat added by a model — a memory they wrote, quoted
              back, so the recommendation reads as informed rather than
              deaf. The advice still stands; what changes is whether the
              player believes MIDO heard them.
            */}
            {primary.heard && (
              <div className="mt-3 rounded-lg border border-line bg-ink-950/60 px-3.5 py-2.5">
                <p className="label-tech">
                  {primary.heard.kind === "tried" ? "You told MIDO you tried this" : "Worth knowing — you told MIDO"}
                </p>
                <p className="mt-1 text-sm font-semibold leading-relaxed text-text-hi">
                  &ldquo;{primary.heard.body}&rdquo;
                </p>
              </div>
            )}

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Link
                href={meta(primary.kind).href}
                onClick={() => {
                  // Fire-and-forget: navigation must not wait on a metric.
                  void trackRecommendationInteraction("opened", primary.kind);
                }}
                className="inline-flex h-9 items-center gap-2 rounded-full bg-signal px-4 text-sm font-medium text-white transition-colors hover:bg-signal-deep"
              >
                Go <ArrowUpRight className="size-4" />
              </Link>
              <button
                onClick={() => act(primary.id, markRecommendationDone)}
                disabled={pending}
                className="inline-flex h-9 items-center gap-1.5 rounded-full border border-line px-3.5 text-sm text-text-dim transition-colors hover:border-positive hover:text-positive disabled:opacity-50"
              >
                {busyId === primary.id && pending ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Check className="size-3.5" />
                )}
                Done
              </button>
              <button
                onClick={() => act(primary.id, markRecommendationDismissed)}
                disabled={pending}
                className="inline-flex h-9 items-center gap-1.5 rounded-full border border-line px-3.5 text-sm text-text-faint transition-colors hover:border-line-strong hover:text-text-dim disabled:opacity-50"
              >
                <X className="size-3.5" /> Not now
              </button>

              {/*
                The sources, behind a disclosure rather than on the face
                of it. Somebody who trusts the suggestion should not have
                to read its workings; somebody who does not should be
                able to.
              */}
              {whyLines.length > 0 && (
                <button
                  onClick={() => {
                    // Counted on open only — a toggle closed is not a second look.
                    if (why !== primary.id) {
                      void trackRecommendationInteraction("why_viewed", primary.kind);
                    }
                    setWhy(why === primary.id ? null : primary.id);
                  }}
                  className="inline-flex h-9 items-center gap-1.5 px-1 text-xs text-text-faint transition-colors hover:text-signal-bright"
                >
                  <Sparkles className="size-3.5" />
                  Why this?
                </button>
              )}
            </div>

            {why === primary.id && whyLines.length > 0 && (
              <div className="mt-3 rounded-lg border border-line bg-ink-850 px-3 py-2">
                <p className="label-tech mb-1.5">What MIDO looked at</p>
                <ul className="space-y-1">
                  {whyLines.map((line, i) => (
                    <li key={i} className="flex gap-2 text-xs leading-relaxed text-text-dim">
                      <span className="mt-1.5 size-1 shrink-0 rounded-full bg-line-strong" />
                      <span className="min-w-0">{line}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── up next ── */}
      {secondary.length > 0 && (
        <>
          <div className="border-t border-line px-5 py-2">
            <span className="label-tech">Up next</span>
          </div>
          <ul className="divide-y divide-line">
            {secondary.map((r) => {
              const Icon = meta(r.kind).icon;
              return (
                <li key={r.id} className="flex items-start gap-3 px-5 py-3">
                  <Icon
                    className="mt-0.5 size-4 shrink-0"
                    style={{ color: meta(r.kind).color }}
                    aria-hidden
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-text-hi">{r.title}</p>
                    <p className="mt-0.5 text-sm leading-relaxed text-text-dim">{r.reason}</p>
                  </div>
                  <Link
                    href={meta(r.kind).href}
                    onClick={() => void trackRecommendationInteraction("opened", r.kind)}
                    className="mt-0.5 inline-flex shrink-0 items-center gap-1 text-xs text-text-faint transition-colors hover:text-signal-bright"
                  >
                    Open <ArrowUpRight className="size-3.5" />
                  </Link>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </Spotlight>
  );
}
