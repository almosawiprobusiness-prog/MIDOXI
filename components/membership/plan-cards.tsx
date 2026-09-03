"use client";

import { useState, useTransition } from "react";
import { Check, Loader2, Sparkles, Crown, User, Users, Clock, ClipboardList, Dumbbell } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { startCheckout } from "@/app/app/membership/actions";
import {
  TIER_CARDS,
  annualSaving,
  formatPrice,
  tierOf,
  type PlanId,
  type Tier,
} from "@/lib/billing/plans";

/*
  The tiers.

  Plans are shaped by who you are rather than by feature bundles, so each card
  leads with the systems it opens — that is the actual difference between them,
  and it is the product's whole thesis.

  The annual saving is computed from the two real prices rather than written as
  copy. A hardcoded "save 26%" is a claim that goes stale the moment a price
  moves; this one cannot disagree with what the customer is charged.
*/

const TIER_ICON: Record<Tier, LucideIcon> = {
  free: User,
  xi: Sparkles,
  managed: Crown,
  player: Sparkles,
  touchline: Users,
  touchline_coach: ClipboardList,
  touchline_trainer: Dumbbell,
  club: Crown,
};

/*
  Ordering so "your plan" and "upgrade" read correctly.

  The two Touchline tiers share rank 2 deliberately: they cost the same and
  neither contains the other, so moving between them is a sideways switch
  rather than an upgrade or a downgrade. `club` sits above both, and the
  retired `touchline` bundle keeps its old rank so a grandfathered subscriber
  still sees Club as the only step up.
*/
const RANK: Record<Tier, number> = {
  free: 0,
  player: 1,
  touchline: 2,
  touchline_coach: 2,
  touchline_trainer: 2,
  xi: 2,
  club: 3,
  managed: 3,
};

export function PlanCards({
  currentPlan,
  billingConfigured,
  quoteUrl,
  attribution,
}: {
  currentPlan: PlanId;
  billingConfigured: boolean;
  /**
   * Where "Request a quote" goes for the Managed tier. Null when the quote
   * route has not been connected yet, and the card says so rather than
   * offering a button that goes nowhere — the same honesty
   * `billingConfigured` already buys for checkout.
   */
  quoteUrl?: string | null;
  /**
   * Conversion-source breadcrumb (e.g. Capture → Training) already
   * validated by the page; passed through to checkout untouched so the
   * purchase can be attributed and the return can deliver the outcome.
   */
  attribution?: { source: string; captureId?: string } | null;
}) {
  const [interval, setInterval] = useState<"month" | "year">("month");
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<PlanId | null>(null);

  const currentTier = tierOf(currentPlan);

  function upgrade(planId: PlanId) {
    setErr(null);
    setPendingId(planId);
    start(async () => {
      const res = await startCheckout(planId, attribution ?? undefined);
      if (!res.ok) {
        setErr(res.error);
        setPendingId(null);
        return;
      }
      window.location.href = res.url;
    });
  }

  return (
    <div>
      {/* interval toggle */}
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="inline-flex rounded-lg border border-line bg-ink-850 p-1 text-xs">
          {(["month", "year"] as const).map((i) => (
            <button
              key={i}
              onClick={() => setInterval(i)}
              className={`rounded-md px-3 py-1.5 transition-colors ${
                interval === i ? "bg-signal text-white" : "text-text-dim hover:text-text"
              }`}
            >
              {i === "month" ? "Monthly" : "Annual"}
            </button>
          ))}
        </div>
        {interval === "year" && <span className="chip chip-signal">Two months free on every tier</span>}
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {TIER_CARDS.map((card) => {
          const Icon = TIER_ICON[card.tier];
          const isCurrent = card.tier === currentTier;
          const planId = interval === "month" ? card.monthlyId : card.annualId;
          const cents = interval === "month" ? card.monthlyCents : card.annualCents;
          const saving = annualSaving(card.monthlyCents, card.annualCents);
          const isDowngrade = RANK[card.tier] < RANK[currentTier];
          // Same rank, different tier — Coach ⇄ Trainer. Neither party is
          // moving up or down, so the button must not claim they are.
          const isLateral = RANK[card.tier] === RANK[currentTier] && card.tier !== currentTier;

          return (
            <div
              key={card.tier}
              className={`min-w-0 panel relative flex flex-col p-5 ${
                card.popular ? "border-signal-line" : ""
              } ${isCurrent ? "ring-1 ring-signal/40" : ""}`}
            >
              {card.popular && !isCurrent && (
                <span className="chip chip-signal absolute -top-2.5 left-5">Most popular</span>
              )}
              {isCurrent && <span className="chip absolute -top-2.5 left-5">Your plan</span>}

              <Icon className="size-5 text-signal-bright" />
              <h3 className="mt-3 font-display text-lg font-semibold text-text-hi">{card.name}</h3>

              {/* The systems it opens — the actual difference between tiers */}
              <div className="label-tech mt-1">{card.systems}</div>

              <div className="mt-3 flex items-baseline gap-1.5">
                <span className="font-display text-3xl font-bold text-text-hi">
                  {/* `formatPrice(0)` says "Free", which is true of the free
                      tier and a lie about Managed. */}
                  {card.quoted ? "Quoted" : formatPrice(cents)}
                </span>
                {!card.quoted && cents > 0 && (
                  <span className="text-sm text-text-dim">/{interval === "month" ? "mo" : "yr"}</span>
                )}
              </div>

              {card.quoted && (
                <div className="mt-0.5 text-xs text-text-dim">Priced to your squad, not to a plan</div>
              )}

              {interval === "year" && !card.quoted && cents > 0 && saving.pct > 0 && (
                <div className="mt-0.5 text-xs text-positive">
                  Save {saving.pct}% · {saving.monthsFree} months free
                </div>
              )}

              {card.trialDays && !isCurrent && (
                <div className="mt-1 flex items-center gap-1.5 text-xs text-text-dim">
                  <Clock className="size-3" /> {card.trialDays} days free first
                </div>
              )}

              <p className="mt-3 text-sm leading-relaxed text-text-dim">{card.tagline}</p>

              <ul className="mt-4 space-y-2">
                {card.perks.map((p) => (
                  <li key={p} className="flex items-start gap-2 text-sm text-text-dim">
                    <Check className="mt-0.5 size-3.5 shrink-0 text-positive" />
                    <span className="leading-relaxed">{p}</span>
                  </li>
                ))}
              </ul>

              <div className="mt-5 pt-1">
                {isCurrent ? (
                  <div className="flex h-11 items-center justify-center rounded-lg border border-line text-sm text-text-dim">
                    Current plan
                  </div>
                ) : card.tier === "free" ? (
                  <div className="flex h-11 items-center justify-center rounded-lg border border-line text-sm text-text-faint">
                    {isDowngrade ? "Cancel to return here" : "Where everyone starts"}
                  </div>
                ) : card.quoted ? (
                  quoteUrl ? (
                    <a
                      href={quoteUrl}
                      className="flex h-11 w-full items-center justify-center gap-2 rounded-lg border border-line-strong text-sm font-medium text-text-hi transition-colors hover:border-signal-line"
                    >
                      {card.quotedCta ?? "Request a quote"}
                    </a>
                  ) : (
                    <div className="flex h-11 items-center justify-center rounded-lg border border-line px-3 text-center text-xs text-text-faint">
                      Quotes not connected yet
                    </div>
                  )
                ) : !billingConfigured ? (
                  <div className="flex h-11 items-center justify-center rounded-lg border border-line px-3 text-center text-xs text-text-faint">
                    Billing not connected yet
                  </div>
                ) : (
                  <button
                    onClick={() => planId && upgrade(planId)}
                    disabled={pending || !planId}
                    className={`flex h-11 w-full items-center justify-center gap-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-60 ${
                      card.popular
                        ? "bg-signal text-white hover:bg-signal-deep"
                        : "border border-line-strong text-text-hi hover:border-signal-line"
                    }`}
                  >
                    {pendingId === planId ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : isDowngrade || isLateral ? (
                      "Switch to this"
                    ) : card.trialDays ? (
                      `Start ${card.trialDays} days free`
                    ) : (
                      `Get ${card.name}`
                    )}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {err && (
        <p className="mt-4 rounded-lg border border-correction/30 bg-correction/10 px-3 py-2 text-sm text-correction">
          {err}
        </p>
      )}

      <p className="mt-4 text-xs leading-relaxed text-text-faint">
        Free is one operating system of your choosing, and it stays free — not a trial. MIDO XI
        adds the AI analyst and every system you work in. Managed is us doing the work and handing
        it back in your colours. Cancel any time; your football record is yours either way and
        exports in one click.
      </p>
    </div>
  );
}
