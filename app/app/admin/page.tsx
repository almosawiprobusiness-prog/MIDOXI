import Link from "next/link";
import { notFound } from "next/navigation";
import { Activity, Users, CreditCard, Cpu, AlertTriangle, Database, ArrowUpRight } from "lucide-react";
import { getCurrentUser } from "@/lib/auth/session";
import { getAdminOverview } from "@/lib/data/admin";
import { features, isDemoMode, configIssues } from "@/lib/env";
import { FEATURE_LABELS } from "@/lib/billing/plans";
import { SectionHeader } from "@/components/ui/primitives";

/*
  The title is gated too, not only the body.

  Metadata resolves before the render stream opens, so a `notFound()`
  raised only in the component still lets the tab title go out — and
  this page's whole access rule is that a non-admin should not learn the
  route exists. A 404 that announces "Founding XI" has disclosed exactly
  what it was refusing to disclose.
*/
export async function generateMetadata() {
  const user = await getCurrentUser();
  if (!user?.isAdmin) notFound();
  return { title: "Admin — MIDO XI" };
}
export const dynamic = "force-dynamic";

const FEATURE_LABEL = Object.fromEntries(FEATURE_LABELS.map((f) => [f.key, f.label]));

function money(cents: number) {
  return `$${(cents / 100).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

export default async function AdminPage() {
  const user = await getCurrentUser();
  // Admin-only. In demo mode there are no admins; a non-admin gets a 404 so the
  // route's existence isn't even disclosed.
  if (!user || !user.isAdmin) notFound();

  const o = await getAdminOverview();
  const issues = configIssues();

  return (
    <div className="mx-auto max-w-[1000px] px-4 py-8 md:px-6">
      <div className="mb-6 flex items-center gap-3">
        <span className="grid size-11 place-items-center rounded-lg border border-line bg-ink-850 text-signal-bright">
          <Activity className="size-5" />
        </span>
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-text-hi">Operations</h1>
          <p className="text-sm text-text-dim">Usage, revenue and AI economics — last 30 days.</p>
        </div>
        <Link
          href="/app/admin/beta"
          className="group ml-auto inline-flex items-center gap-2 rounded-lg border border-line px-3.5 py-2 text-sm text-text-dim transition-colors hover:border-signal-line hover:text-signal-bright"
        >
          Founding XI
          <ArrowUpRight className="size-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
        </Link>
      </div>

      {!o.available && (
        <p className="mb-6 rounded-lg border border-review/30 bg-review/10 px-3 py-2 text-xs text-review">
          Admin metrics need a Supabase service-role key. {isDemoMode ? "Not available in demo mode." : "Set SUPABASE_SERVICE_ROLE_KEY."}
        </p>
      )}

      {/*
        Config that is dangerous rather than absent. A wrong NEXT_PUBLIC_APP_URL
        does not error — it silently points every referral link, Stripe return
        and confirmation email at the wrong host. This is where that surfaces.
      */}
      {issues.length > 0 && (
        <div className="mb-6 min-w-0 rounded-lg border border-correction/40 bg-correction/10 p-4">
          <div className="flex items-center gap-2 text-correction">
            <AlertTriangle className="size-4 shrink-0" />
            <span className="label-tech !text-correction">
              {issues.length} configuration {issues.length === 1 ? "problem" : "problems"}
            </span>
          </div>
          <ul className="mt-3 space-y-3">
            {issues.map((i) => (
              <li key={i.key + i.detail} className="min-w-0">
                <div className="data-mono text-sm text-text-hi">{i.key}</div>
                <p className="mt-0.5 text-sm leading-relaxed text-text-dim">{i.detail}</p>
                <p className="mt-1 text-xs text-text-faint">Breaks: {i.breaks.join(" · ")}</p>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* KPI row */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi icon={<Users className="size-4" />} label="Members" value={o.users.total.toLocaleString()} sub={`+${o.users.new7d} this week`} />
        <Kpi icon={<CreditCard className="size-4" />} label="Active Pro" value={o.subscriptions.activePro.toLocaleString()} sub={`${money(o.subscriptions.mrrCents)} MRR`} />
        <Kpi icon={<Cpu className="size-4" />} label="AI calls · 30d" value={o.ai.calls30d.toLocaleString()} sub={`${o.ai.cacheRate}% cached`} />
        <Kpi icon={<AlertTriangle className="size-4" />} label="AI cost · 30d" value={`$${o.ai.costUsd30d.toFixed(2)}`} sub={`${o.ai.errors30d} errors`} accent={o.ai.errors30d > 0} />
      </div>

      {/* AI economics by feature */}
      <section className="mt-8">
        <SectionHeader label="AI economics · by feature" />
        {o.ai.byFeature.length > 0 ? (
          <div className="panel overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left">
                  <th className="px-4 py-2.5 font-medium text-text-dim">Feature</th>
                  <th className="px-4 py-2.5 text-right font-medium text-text-dim">Calls</th>
                  <th className="px-4 py-2.5 text-right font-medium text-text-dim">Est. cost</th>
                  <th className="px-4 py-2.5 text-right font-medium text-text-dim">$/call</th>
                </tr>
              </thead>
              <tbody>
                {o.ai.byFeature.map((f) => (
                  <tr key={f.feature} className="border-b border-line/60 last:border-0">
                    <td className="px-4 py-2.5 text-text-hi">{FEATURE_LABEL[f.feature] ?? f.feature}</td>
                    <td className="data-mono px-4 py-2.5 text-right text-text">{f.calls.toLocaleString()}</td>
                    <td className="data-mono px-4 py-2.5 text-right text-text">${f.costUsd.toFixed(4)}</td>
                    <td className="data-mono px-4 py-2.5 text-right text-text-dim">
                      ${f.calls ? (f.costUsd / f.calls).toFixed(4) : "0.0000"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="panel p-4 text-sm text-text-dim">No AI usage recorded yet.</p>
        )}
      </section>

      {/* AI budget cap */}
      {o.aiBudget.limit > 0 && (
        <section className="mt-8">
          <SectionHeader label="AI budget · this month" />
          <div className="panel p-4">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm text-text">
                {o.aiBudget.capped ? (
                  <span className="font-medium text-review">Cap reached — AI paused for the month</span>
                ) : (
                  "Global monthly Claude spend"
                )}
              </span>
              <span className="data-mono text-sm">
                <span className={o.aiBudget.pct >= 80 ? "text-review" : "text-text-hi"}>${o.aiBudget.spend.toFixed(2)}</span>
                <span className="text-text-faint"> / ${o.aiBudget.limit.toFixed(0)}</span>
              </span>
            </div>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-ink-800">
              <div
                className={`h-full rounded-full ${o.aiBudget.capped ? "bg-review" : o.aiBudget.pct >= 80 ? "bg-review" : "bg-signal"}`}
                style={{ width: `${o.aiBudget.pct}%` }}
              />
            </div>
          </div>
        </section>
      )}

      {/* Subscriptions + system health */}
      <div className="mt-8 grid gap-4 md:grid-cols-2">
        <section className="min-w-0">
          <SectionHeader label="Subscriptions" />
          <div className="min-w-0 panel p-4">
            {Object.keys(o.subscriptions.byPlan).length > 0 ? (
              <ul className="space-y-2 text-sm">
                {Object.entries(o.subscriptions.byPlan).map(([plan, n]) => (
                  <li key={plan} className="flex items-center justify-between">
                    <span className="text-text">{plan}</span>
                    <span className="data-mono text-text-hi">{n}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-text-dim">No active subscriptions.</p>
            )}
          </div>
        </section>

        <section>
          <SectionHeader label="System" />
          <div className="panel space-y-2 p-4 text-sm">
            <Health label="Database" ok={features.database} icon={<Database className="size-4" />} />
            <Health label="AI (Anthropic)" ok={features.ai} />
            <Health label="Video reading (Gemini)" ok={features.nativeVideo} />
            <Health label="YouTube" ok={features.youtube} />
            <Health label="Billing (Stripe)" ok={features.billing} />
            <Health label="Email (Resend)" ok={features.email} />
          </div>
        </section>
      </div>
    </div>
  );
}

function Kpi({ icon, label, value, sub, accent }: { icon: React.ReactNode; label: string; value: string; sub?: string; accent?: boolean }) {
  return (
    <div className="panel p-4">
      <div className="flex items-center gap-2 text-text-dim">
        <span className="text-signal-bright">{icon}</span>
        <span className="label-tech">{label}</span>
      </div>
      <div className={`mt-2 font-display text-2xl font-bold ${accent ? "text-review" : "text-text-hi"}`}>{value}</div>
      {sub && <div className="mt-0.5 text-xs text-text-faint">{sub}</div>}
    </div>
  );
}

function Health({ label, ok, icon }: { label: string; ok: boolean; icon?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <span className="flex items-center gap-2 text-text">{icon}{label}</span>
      <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${ok ? "text-positive" : "text-text-faint"}`}>
        <span className={`size-1.5 rounded-full ${ok ? "bg-positive" : "bg-line-strong"}`} />
        {ok ? "Connected" : "Not configured"}
      </span>
    </div>
  );
}
