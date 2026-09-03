import { Crown, Sparkles, Zap } from "lucide-react";
import { env, features, isDemoMode } from "@/lib/env";
import { getMembershipOverview } from "@/lib/billing/membership";
import { tierOf, tierLabel } from "@/lib/billing/plans";
import { SectionHeader } from "@/components/ui/primitives";
import { PlanCards } from "@/components/membership/plan-cards";
import { UsageMeters } from "@/components/membership/usage-meters";
import { ManageButton } from "@/components/membership/manage-button";
import { WhatMidoBuilds } from "@/components/membership/what-mido-builds";
import { getCurrentUser } from "@/lib/auth/session";
import { sanitizeCheckoutAttribution, isUuid } from "@/lib/billing/attribution";
import {
  REFERRAL_ATTRIBUTION_MESSAGE,
  isReferralAttributionReason,
} from "@/lib/data/referral-types";
import { track } from "@/lib/analytics/track";
import { redirect } from "next/navigation";
import Link from "next/link";

export const metadata = { title: "Membership — MIDO XI" };

function fmtDate(iso: string | null): string | null {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

export default async function MembershipPage({
  searchParams,
}: {
  searchParams: Promise<{
    checkout?: string;
    src?: string;
    capture?: string;
    train_capture?: string;
    referral?: string;
  }>;
}) {
  const { checkout, src, capture, train_capture, referral } = await searchParams;
  const [{ membership, usage }, user] = await Promise.all([
    getMembershipOverview(),
    getCurrentUser(),
  ]);

  /*
    The Capture → Training arrival. `src`/`capture` come off the URL the
    extension opened, so they are sanitized before anything reads them —
    and only a source enum plus a UUID survive.
  */
  const attribution = sanitizeCheckoutAttribution({ source: src, captureId: capture });
  if (attribution && !membership.isPro) {
    await track("capture_training_upgrade_viewed", { surface: "membership" });
  }

  /*
    The purchase return. The player paid to turn a saved lesson into a
    session — when the webhook has already landed the entitlement, take
    them straight to that outcome rather than leaving them on a banner.
    When it hasn't yet, the banner below carries the same link, so the
    lesson is one click away either way and nothing is lost to timing.
  */
  const trainCapture = isUuid(train_capture) ? train_capture.toLowerCase() : null;
  const buildUrl = trainCapture
    ? `/app/training?focus=${encodeURIComponent(`capture:${trainCapture}`)}&src=post_checkout`
    : null;
  if (checkout === "success" && buildUrl && membership.isPro) {
    redirect(buildUrl);
  }
  const renew = fmtDate(membership.currentPeriodEnd);
  const tier = tierOf(membership.planId);
  const isTopTier = tier === "club";
  const interval = membership.planId.endsWith("annual") ? "Annual" : "Monthly";

  return (
    <div className="mx-auto max-w-[1000px] px-4 py-8 md:px-6">
      <div className="mb-6 flex items-center gap-3">
        <span className="grid size-11 place-items-center rounded-lg border border-line bg-ink-850 text-signal-bright">
          <Crown className="size-5" />
        </span>
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-text-hi">Membership</h1>
          <p className="text-sm text-text-dim">Your plan, your AI allowances.</p>
        </div>
        {membership.isPro && (
          <span
            className={`ml-auto inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium ${
              isTopTier ? "border-review/40 bg-review/10 text-review" : "border-signal-line bg-signal/10 text-signal-bright"
            }`}
          >
            {isTopTier ? <Zap className="size-4" /> : <Sparkles className="size-4" />} {tierLabel(tier)}
          </span>
        )}
      </div>

      {/* A referral link followed while already signed in — attached on the
          way here by /join/[code], reported here so the outcome is never
          silent. Copy comes from the shared table, so the database, the
          route and this page cannot drift. */}
      {isReferralAttributionReason(referral) && (
        <p
          className={`mb-6 rounded-lg border px-3 py-2 text-sm ${
            REFERRAL_ATTRIBUTION_MESSAGE[referral].tone === "positive"
              ? "border-positive/30 bg-positive/10 text-positive"
              : "border-line bg-ink-850 text-text-dim"
          }`}
        >
          {REFERRAL_ATTRIBUTION_MESSAGE[referral].text}
        </p>
      )}

      {checkout === "success" && (
        <div className="mb-6 rounded-lg border border-positive/30 bg-positive/10 px-3 py-2 text-sm text-positive">
          <p>Welcome aboard — your AI analyst is now live. It can take a moment to activate.</p>
          {buildUrl && (
            <Link
              href={buildUrl}
              className="mt-2 inline-flex h-9 items-center gap-2 rounded-lg bg-signal px-3.5 text-sm font-medium text-white transition-colors hover:bg-signal-deep"
            >
              Build the session from your saved lesson →
            </Link>
          )}
        </div>
      )}
      {checkout === "cancelled" && (
        <p className="mb-6 rounded-lg border border-line bg-ink-850 px-3 py-2 text-sm text-text-dim">
          Checkout cancelled — no charge was made.
        </p>
      )}

      {/* Current status */}
      {membership.isPro && (
        <div className="mb-8 panel-raised flex flex-wrap items-center gap-4 p-5">
          <div className="flex-1">
            <div className="label-tech">Current plan</div>
            <div className="mt-0.5 font-display text-lg font-semibold text-text-hi">
              MIDO XI {tierLabel(tier)} · {interval}
            </div>
            <p className="mt-1 text-sm text-text-dim">
              {membership.comped
                ? `Earned by referring people — runs until ${renew ?? "it expires"}, then returns to free.`
                : membership.cancelAtPeriodEnd
                  ? `Cancels on ${renew ?? "period end"}.`
                  : renew
                    ? `Renews ${renew}.`
                    : "Active."}
            </p>
          </div>
          <ManageButton />
        </div>
      )}

      {/* Usage */}
      <section className="mb-8">
        <SectionHeader label={membership.isPro ? "This month’s usage" : "What Pro unlocks"} />
        <UsageMeters usage={usage} locked={!membership.isPro} />
      </section>

      {/* What the AI actually builds — read from the capability registry, so it
          cannot drift away from what the software does. */}
      <section className="mb-8">
        <SectionHeader label="What MIDO builds for you" />
        <WhatMidoBuilds role={user?.role ?? "player"} isPro={membership.isPro} />
      </section>

      {/* Plans */}
      <section>
        <SectionHeader label={membership.isPro ? "Change plan" : "Plans"} />
        <PlanCards
          currentPlan={membership.planId}
          billingConfigured={features.billing}
          quoteUrl={env.managedQuoteUrl || null}
          attribution={attribution}
        />
      </section>

      {isDemoMode && (
        <p className="mt-6 text-center text-[11px] text-text-faint">
          Demo mode — billing is disabled. Connect Supabase and Stripe to enable Pro.
        </p>
      )}
    </div>
  );
}
