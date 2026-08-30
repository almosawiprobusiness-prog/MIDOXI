import { Wallet, ShieldCheck, TrendingDown, CircleDollarSign } from "lucide-react";
import { features, isDemoMode } from "@/lib/env";
import {
  getTrainerAccount,
  refreshTrainerAccount,
  listTrainerProducts,
  listTrainerPurchases,
  activeAthleteCount,
} from "@/lib/billing/connect";
import {
  CONNECT_FEE_TIERS,
  connectFeeBps,
  feePercentLabel,
  nextTierHint,
} from "@/lib/billing/connect-fee";
import { getTrainerPractice } from "@/lib/data/roles";
import { PageHeader } from "@/components/ui/kit";
import { SectionHeader } from "@/components/ui/primitives";
import { OnboardingButton, ProductForm, ProductRow } from "@/components/trainer/payments-panel";

export const metadata = { title: "Payments — MIDO XI" };

const money = (cents: number) => `$${(cents / 100).toFixed(2).replace(/\.00$/, "")}`;

export default async function PaymentsPage() {
  const [account, products, purchases, athletes, practice] = await Promise.all([
    // Refresh mirrors Stripe's answer when an account exists; harmless when not.
    isDemoMode ? Promise.resolve(null) : refreshTrainerAccount().catch(() => getTrainerAccount()),
    listTrainerProducts(),
    listTrainerPurchases(),
    activeAthleteCount(),
    getTrainerPractice(),
  ]);

  const feeBps = connectFeeBps(athletes);
  const hint = nextTierHint(athletes);
  const canCharge = Boolean(account?.chargesEnabled);
  const paid = purchases.filter((p) => p.status === "paid");
  const collectedCents = paid.reduce((a, p) => a + p.amountCents, 0);

  return (
    <div className="mx-auto max-w-[900px] px-4 py-8 md:px-6">
      <PageHeader
        icon={Wallet}
        title="Payments"
        tagline={`${practice} bills through the Lab — every charge is a Stripe object with a Stripe receipt.`}
        photo="floodlights"
        kicker="The Lab, paid properly"
      />

      {/*
        The fee schedule, stated where the money happens. Growth is
        rewarded: the fee steps DOWN with roster size, computed from
        the live active-athlete count and frozen into each link.
      */}
      <section className="mb-6 relative min-w-0 overflow-hidden rounded-xl border border-signal-line bg-gradient-to-b from-signal/10 via-ink-900 to-ink-900 p-5">
        <div className="mb-2 flex items-baseline justify-between gap-3">
          <span className="label-tech !text-signal-bright">Your platform fee / 01</span>
          <span className="label-tech">{athletes} active athlete{athletes === 1 ? "" : "s"}</span>
        </div>
        <div className="flex items-end gap-3">
          <span className="stat-figure text-4xl">{feePercentLabel(athletes)}</span>
          <span className="mb-1 text-sm text-text-dim">per payment, on top of Stripe&rsquo;s processing fee</span>
        </div>
        {hint && (
          <p className="mt-2 flex items-center gap-1.5 text-sm text-positive">
            <TrendingDown className="size-4" /> {hint}
          </p>
        )}
        <div className="mt-4 flex flex-wrap gap-2 border-t border-line pt-3">
          {[...CONNECT_FEE_TIERS].reverse().map((t) => (
            <span
              key={t.minAthletes}
              className="chip"
              style={t.bps === feeBps ? { color: "var(--signal-bright)", borderColor: "var(--signal-line)" } : undefined}
            >
              {t.label}
            </span>
          ))}
        </div>
      </section>

      {isDemoMode ? (
        <div className="panel p-5">
          <div className="label-tech mb-1 text-review">Simulated — demo mode never touches Stripe</div>
          <p className="text-sm leading-relaxed text-text-dim">
            On a real account this page onboards you to Stripe Express (identity and bank details stay
            with Stripe — MIDO XI never sees them), lets you define what you sell, and turns each
            product into a payment link your clients pay by card. The products below are examples.
          </p>
        </div>
      ) : !features.billing ? (
        <div className="panel p-5">
          <div className="label-tech mb-1 text-review">Payments are not configured on this deployment</div>
          <p className="text-sm leading-relaxed text-text-dim">
            Stripe keys are missing, so nothing here can run. Once they are set, this page onboards
            you to Stripe Express and issues payment links.
          </p>
        </div>
      ) : !account ? (
        <div className="panel p-5">
          <div className="mb-2 flex items-center gap-2">
            <ShieldCheck className="size-4 text-signal-bright" />
            <span className="label-tech">Get paid through the Lab</span>
          </div>
          <p className="mb-4 max-w-xl text-sm leading-relaxed text-text-dim">
            Stripe Express handles identity and bank details on Stripe&rsquo;s own pages — MIDO XI never
            sees either. Once verified, you define what you sell and send payment links; money settles
            straight to your bank.
          </p>
          <OnboardingButton />
        </div>
      ) : !canCharge ? (
        <div className="panel p-5">
          <div className="label-tech mb-1 text-review">Stripe setup is not finished</div>
          <p className="mb-4 text-sm leading-relaxed text-text-dim">
            Your account exists but charges are not enabled yet — usually an unfinished verification
            step. Pick up where you left off; Stripe shows exactly what is missing.
          </p>
          <OnboardingButton resume />
        </div>
      ) : null}

      {(isDemoMode || canCharge) && (
        <>
          <section className="mt-8">
            <SectionHeader label="What you sell" />
            {!isDemoMode && <div className="mb-3"><ProductForm /></div>}
            {products.length > 0 ? (
              <div className="space-y-2">
                {products.map((p) => (
                  <ProductRow key={p.id} product={p} canCharge={canCharge && !isDemoMode} />
                ))}
              </div>
            ) : (
              <p className="panel p-4 text-sm text-text-dim">
                e.g. &ldquo;1-to-1 session — $60&rdquo; or &ldquo;6-session block — $300&rdquo;. Add the first one above;
                each becomes a payment link you send.
              </p>
            )}
          </section>

          {purchases.length > 0 && (
            <section className="mt-8">
              <SectionHeader label={`Payments · ${paid.length} paid · ${money(collectedCents)} collected`} />
              <div className="space-y-2">
                {purchases.map((p) => (
                  <div key={p.id} className="panel flex flex-wrap items-center gap-3 p-3.5 text-sm">
                    <CircleDollarSign className="size-4 shrink-0 text-text-faint" />
                    <span className="min-w-0 flex-1 truncate text-text-hi">{p.productTitle ?? "Product removed"}</span>
                    <span className="data-mono text-text">{money(p.amountCents)}</span>
                    <span className="data-mono text-xs text-text-faint">fee {money(p.feeCents)} ({p.feeBps / 100}%)</span>
                    <span
                      className="chip"
                      style={
                        p.status === "paid"
                          ? { color: "var(--positive)", borderColor: "var(--positive)" }
                          : p.status === "pending"
                            ? { color: "var(--review)", borderColor: "var(--review)" }
                            : undefined
                      }
                    >
                      {p.status}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
