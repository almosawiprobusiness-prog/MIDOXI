import { Users, Info, ArrowRight, Wallet } from "lucide-react";
import Link from "next/link";
import { getReferralOverview } from "@/lib/data/referrals";
import {
  PAYOUT_GAP,
  REWARD,
  REWARD_LADDER,
  REFERRAL_STATUS_META,
  funnel,
  nextRung,
  referralUrl,
} from "@/lib/data/referral-types";
import { env, isDemoMode } from "@/lib/env";
import { PageHeader, StatBand } from "@/components/ui/kit";
import { SectionHeader } from "@/components/ui/primitives";
import { DemoNote } from "@/components/dashboards/shared";
import { ShareLink } from "@/components/referrals/share-link";
import { RedeemCard } from "@/components/referrals/redeem-card";

export const metadata = { title: "Refer — MIDO XI" };

/*
  The affiliate programme, as a page.

  The whole design rests on one decision: the reward is months of Pro, not
  money. That is a reward MIDO XI can hand over by itself, today, with no payout
  rail and no tax form in the way — so nothing on this page is a promise the
  software cannot keep. What it genuinely cannot do (cash) is stated at the
  bottom rather than implied away.

  The funnel is shown as counts, never rates. A dashboard with four visits on it
  has no business claiming a conversion percentage.
*/

function dateLabel(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export default async function ReferralsPage() {
  const { code, stats, referrals, rewards } = await getReferralOverview();
  const url = code ? referralUrl(code.code, env.appUrl) : null;
  const rung = nextRung(stats.conversions);
  const spent = rewards.filter((r) => r.status === "applied").reduce((n, r) => n + r.months, 0);

  return (
    <div className="mx-auto max-w-[900px] px-4 py-8 md:px-6">
      <PageHeader
        icon={Users}
        title="Refer"
        tagline="Every person who starts paying earns you a free month of Pro."
      />

      {isDemoMode && (
        <div className="mb-6">
          <DemoNote>
            These referrals are seeded so the ledger has something in it. Connect Supabase and the
            same page reads real conversions from the Stripe webhook.
          </DemoNote>
        </div>
      )}

      {code && url ? (
        <section className="mb-8">
          <ShareLink code={code.code} url={url} />
        </section>
      ) : (
        <section className="mb-8">
          <div className="panel p-5">
            <p className="text-sm leading-relaxed text-text-dim">
              Your referral link appears here once you are signed in to a real account.
            </p>
          </div>
        </section>
      )}

      {/* ---- the ledger ---- */}
      <section className="mb-8">
        <SectionHeader label="Where you stand" />
        <StatBand
          cols={4}
          stats={[
            { label: "Link opened", value: stats.visits, hint: "Counted without identifying anyone" },
            { label: "Signed up", value: stats.signups },
            { label: "Started paying", value: stats.conversions },
            { label: "Months earned", value: stats.monthsEarned },
          ]}
        />

        <RedeemCard available={stats.monthsAvailable} />

        {spent > 0 && (
          <p className="mt-3 text-sm text-text-dim">
            You have already used <span className="text-text-hi">{spent}</span>{" "}
            {spent === 1 ? "month" : "months"} —{" "}
            <Link href="/app/membership" className="text-signal-bright hover:underline">
              see it on your membership
            </Link>
            .
          </p>
        )}
      </section>

      {/* ---- the funnel, as counts ---- */}
      <section className="mb-8">
        <SectionHeader label="What happens to the people you send" />
        <div className="panel divide-y divide-line">
          {funnel(stats).map((step) => (
            <div key={step.label} className="flex items-center gap-4 p-4">
              <div className="stat-figure w-14 shrink-0 text-2xl">{step.value}</div>
              <div className="min-w-0">
                <div className="text-sm text-text-hi">{step.label}</div>
                <div className="text-xs text-text-dim">{step.hint}</div>
              </div>
            </div>
          ))}
        </div>
        <p className="mt-2 text-xs leading-relaxed text-text-faint">
          Counts, not rates. A percentage calculated on a handful of visits says more about the
          handful than about your link.
        </p>
      </section>

      {/* ---- who came in ---- */}
      <section className="mb-8">
        <SectionHeader label={`Your referrals · ${referrals.length}`} />
        {referrals.length ? (
          <div className="panel divide-y divide-line">
            {referrals.map((r) => {
              const meta = REFERRAL_STATUS_META[r.status];
              return (
                <div key={r.id} className="flex items-center gap-4 p-4">
                  <span
                    className={`size-2 shrink-0 rounded-full ${
                      meta.tone === "positive" ? "bg-positive" : "bg-ink-600"
                    }`}
                    aria-hidden
                  />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm text-text-hi">{meta.label}</div>
                    <div className="text-xs text-text-dim">{meta.hint}</div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="label-tech">{dateLabel(r.joinedAt)}</div>
                    {r.tier && <div className="chip mt-1">{r.tier}</div>}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="panel p-5">
            <p className="text-sm leading-relaxed text-text-dim">
              Nobody has used your link yet. It works best sent to one person with a reason —
              a team-mate who keeps asking how you prepare, or a coach who plans sessions in a
              notebook.
            </p>
          </div>
        )}
        <p className="mt-2 text-xs leading-relaxed text-text-faint">
          You are told that someone joined and whether they started paying. You are never told who
          they are — a referral programme is not a way to find out who your friends are.
        </p>
      </section>

      {/* ---- the ladder ---- */}
      <section className="mb-8">
        <SectionHeader label="What it adds up to" />
        <div className="panel divide-y divide-line">
          {REWARD_LADDER.map((step) => {
            const reached = stats.conversions >= step.at;
            const isNext = rung?.at === step.at;
            return (
              <div
                key={step.at}
                className={`flex items-start gap-4 p-4 ${isNext ? "bg-signal/5" : ""}`}
              >
                <div
                  className={`stat-figure w-8 shrink-0 text-xl ${
                    reached ? "text-positive" : "text-text-faint"
                  }`}
                >
                  {step.at}
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`text-sm ${reached ? "text-text-hi" : "text-text-dim"}`}>
                      {step.label}
                    </span>
                    {reached && <span className="chip">reached</span>}
                    {isNext && <span className="chip">next</span>}
                  </div>
                  <p className="text-xs leading-relaxed text-text-dim">{step.detail}</p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ---- the rules ---- */}
      <section className="mb-8">
        <SectionHeader label="The rules, in full" />
        <div className="panel overflow-hidden">
          <div className="flex items-start gap-3 border-b border-line p-5">
            <Info className="mt-0.5 size-4 shrink-0 text-info" />
            <p className="text-sm leading-relaxed text-text-dim">
              A conversion counts <span className="text-text-hi">{REWARD.holdDays} days</span> after
              someone starts paying, not the moment they do. That is what keeps a refund from
              becoming a reward — and it is why a new referral shows as &ldquo;paying&rdquo; before the
              month appears.
            </p>
          </div>
          <ul className="divide-y divide-line text-sm">
            {[
              `Each conversion earns ${REWARD.monthsPerConversion} month of MIDO XI Pro.`,
              `The person who joins gets ${REWARD.monthsForJoiner} free month too, credited to their next invoice — this is not a one-way deal.`,
              "A code applies any time before that person's first subscription — an account that has been on the free OS for months still counts.",
              "Your own code on your own account is refused by the database, not just hidden in the interface.",
              "A refund or chargeback reverses the referral, and takes back the month if you have not spent it.",
              "Months stack on top of any Pro time you already have, rather than replacing it.",
            ].map((rule) => (
              <li key={rule} className="flex items-start gap-3 p-4 text-text-dim">
                <ArrowRight className="mt-0.5 size-3.5 shrink-0 text-text-faint" />
                <span className="leading-relaxed">{rule}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ---- what this is not ---- */}
      <section>
        <SectionHeader label="What this is not" />
        <div className="panel p-5">
          <div className="flex items-start gap-3">
            <Wallet className="mt-0.5 size-4 shrink-0 text-review" />
            <div className="min-w-0">
              <p className="text-sm leading-relaxed text-text-hi">{PAYOUT_GAP.describes}</p>
              <p className="mt-2 text-sm leading-relaxed text-text-dim">{PAYOUT_GAP.needs}</p>
              <ul className="mt-3 space-y-1.5">
                {PAYOUT_GAP.wouldAdd.map((w) => (
                  <li key={w} className="flex items-start gap-2 text-sm text-text-dim">
                    <span className="mt-1.5 size-1 shrink-0 rounded-full bg-ink-600" aria-hidden />
                    <span className="leading-relaxed">{w}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
