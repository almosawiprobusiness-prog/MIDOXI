import { notFound } from "next/navigation";
import Link from "next/link";
import {
  Users, Check, X, AlertTriangle, Inbox, Cpu, Clapperboard, Target, ArrowLeft,
} from "lucide-react";
import { getCurrentUser } from "@/lib/auth/session";
import { getBetaDashboard, type BetaPlayer } from "@/lib/data/beta-dashboard";
import { SectionHeader } from "@/components/ui/primitives";
import { TriageControls } from "@/components/admin/triage-controls";

/*
  THE FOUNDING XI DASHBOARD — admin only.

  Eleven players. The whole point is to see them as PEOPLE, not as a
  funnel chart: the per-player table is first, and the aggregates come
  after, because with eleven users the individual is the unit of
  analysis and "62% activation" is a number that hides all eleven of
  them.

  Deliberately small. No charts, no date pickers, no cohort explorer —
  every one of those is a week of work that answers a question you can
  answer by looking at a table of eleven rows.

  It is gated on isAdmin and 404s otherwise, so the route's existence is
  not disclosed to a player who guesses the URL.
*/

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
  return { title: "Founding XI — MIDO XI" };
}
export const dynamic = "force-dynamic";

const LOOP_STEPS: { key: keyof BetaPlayer["loop"]; label: string }[] = [
  { key: "goal", label: "Goal" },
  { key: "checkin", label: "Check-in" },
  { key: "study", label: "Study" },
  { key: "match", label: "Match" },
  { key: "review", label: "Review" },
  { key: "training", label: "Training" },
  { key: "film", label: "Film" },
];

function ago(iso: string | null): string {
  if (!iso) return "never";
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  return `${days}d ago`;
}

export default async function BetaDashboardPage() {
  const user = await getCurrentUser();
  if (!user || !user.isAdmin) notFound();

  const d = await getBetaDashboard();

  return (
    <div className="mx-auto max-w-[1100px] px-4 py-8 md:px-6">
      <Link
        href="/app/admin"
        className="mb-6 inline-flex items-center gap-1.5 text-xs text-text-faint transition-colors hover:text-text"
      >
        <ArrowLeft className="size-3.5" /> Operations
      </Link>

      <div className="mb-6 flex items-center gap-3">
        <span className="grid size-11 place-items-center rounded-lg border border-line bg-ink-850 text-signal-bright">
          <Users className="size-5" />
        </span>
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-text-hi">Founding XI</h1>
          <p className="text-sm text-text-dim">
            What the beta is actually doing — read from product actions, never page views.
          </p>
        </div>
      </div>

      {!d.available && (
        <p className="mb-6 rounded-lg border border-review/30 bg-review/10 px-3 py-2 text-xs text-review">
          Needs a Supabase service-role key. Set SUPABASE_SERVICE_ROLE_KEY.
        </p>
      )}

      {d.available && !d.analyticsReady && (
        <div className="mb-6 flex items-start gap-3 rounded-lg border border-correction/40 bg-correction/10 p-4">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-correction" />
          <p className="text-sm leading-relaxed text-text-dim">
            <span className="text-text-hi">Migration 0033 has not been applied.</span> Every
            number below that comes from product actions will read zero — which looks exactly
            like a dead beta and is not one. Apply it before drawing any conclusion:{" "}
            <span className="data-mono">docs/beta/APPLY_MIGRATIONS.md</span>.
          </p>
        </div>
      )}

      {/* ── the eleven, one row each ────────────────────── */}
      <section className="mb-8">
        <SectionHeader label={`Players · ${d.players.length}`} />
        {d.players.length === 0 ? (
          <div className="panel p-5 text-sm text-text-dim">
            No accounts yet. The first row appears when the first founder signs up.
          </div>
        ) : (
          <div className="panel overflow-x-auto">
            <table className="w-full min-w-[860px] text-sm">
              <thead>
                <tr className="border-b border-line text-left">
                  <th className="label-tech px-4 py-2 font-normal">Player</th>
                  <th className="label-tech px-4 py-2 font-normal">Joined</th>
                  <th className="label-tech px-4 py-2 font-normal">Onboarded</th>
                  <th className="label-tech px-4 py-2 font-normal">Last active</th>
                  <th className="label-tech px-4 py-2 font-normal">Active days</th>
                  <th className="label-tech px-4 py-2 font-normal">Core loop</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {d.players.map((p) => (
                  <tr key={p.id}>
                    <td className="px-4 py-2.5 text-text-hi">{p.email}</td>
                    <td className="px-4 py-2.5 data-mono text-text-faint">{p.joined.slice(0, 10)}</td>
                    <td className="px-4 py-2.5">
                      {p.onboarded ? (
                        <Check className="size-4 text-positive" />
                      ) : (
                        <X className="size-4 text-correction" />
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-text-dim">{ago(p.lastActive)}</td>
                    <td className="px-4 py-2.5 data-mono text-text-hi">{p.activeDays}</td>
                    <td className="px-4 py-2.5">
                      {/*
                        Seven dots per player. Where a player stopped is
                        visible at a glance across the whole beta —
                        which is the single most useful thing this page
                        can show, because a column of players who all
                        stop at the same step is a product problem with
                        a name.
                      */}
                      <span className="flex gap-1">
                        {LOOP_STEPS.map((s) => (
                          <span
                            key={s.key}
                            title={s.label}
                            className="size-2.5 rounded-full"
                            style={{
                              background: p.loop[s.key] ? "var(--positive)" : "var(--line-strong)",
                            }}
                          />
                        ))}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="border-t border-line px-4 py-2.5 text-[11px] text-text-faint">
              Core loop, left to right: {LOOP_STEPS.map((s) => s.label).join(" · ")}
            </p>
          </div>
        )}
      </section>

      {/* ── how far each feature reaches ────────────────── */}
      <section className="mb-8">
        <SectionHeader label="Feature reach" />
        <p className="mb-3 text-sm text-text-dim">
          How many players have ever done the thing — not how many times a page was opened.
          MIDO does not track page views, so &ldquo;did they visit the Locker&rdquo; is a
          question this dashboard cannot and will not answer.
        </p>
        <div className="panel overflow-hidden">
          <table className="w-full text-sm">
            <tbody className="divide-y divide-line">
              {d.featureReach.map((f) => (
                <tr key={f.label}>
                  <td className="px-4 py-2.5 text-text">{f.label}</td>
                  <td className="w-32 px-4 py-2.5 text-right">
                    <span className="data-mono text-text-hi">{f.players}</span>
                    <span className="ml-1 text-xs text-text-faint">
                      / {d.players.length} players
                    </span>
                  </td>
                  <td className="w-28 px-4 py-2.5 text-right data-mono text-text-faint">
                    {f.events} total
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── the NBA hypothesis ──────────────────────────── */}
      <section className="mb-8">
        <SectionHeader label="Next Best Action" />
        <p className="mb-3 text-sm text-text-dim">
          The product&rsquo;s central bet. <span className="text-text-hi">Shown</span> counts
          genuinely new advice, not re-renders — so shown:opened is a real ratio.
        </p>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          {[
            { label: "Shown", value: d.nba.shown },
            { label: "Opened", value: d.nba.opened },
            { label: "Why viewed", value: d.nba.whyViewed },
            { label: "Completed", value: d.nba.completed },
            { label: "Dismissed", value: d.nba.dismissed },
          ].map((s) => (
            <div key={s.label} className="panel p-4">
              <div className="label-tech">{s.label}</div>
              <div className="stat-figure mt-1 text-2xl text-text-hi">{s.value}</div>
            </div>
          ))}
        </div>
        {d.nba.shown > 0 && d.nba.opened === 0 && (
          <p className="mt-3 flex items-start gap-2 rounded-lg border border-review/30 bg-review/10 px-3 py-2 text-xs leading-relaxed text-review">
            <Target className="mt-0.5 size-3.5 shrink-0" />
            Recommendations are being shown and never opened. Before making the panel louder,
            find out why — bad advice, wrong timing, or already done offline are different
            problems with different fixes.
          </p>
        )}
      </section>

      {/* ── AI and video health ─────────────────────────── */}
      <div className="mb-8 grid gap-4 md:grid-cols-2">
        <section className="panel p-5">
          <div className="flex items-center gap-2">
            <Cpu className="size-4 text-signal-bright" />
            <span className="label-tech">AI · last 30 days</span>
          </div>
          <dl className="mt-4 space-y-2 text-sm">
            {[
              ["Calls", d.ai.calls30d],
              ["Errors", d.ai.errors30d],
              ["Rated useful", d.ai.thumbsUp],
              ["Rated not useful", d.ai.thumbsDown],
            ].map(([k, v]) => (
              <div key={String(k)} className="flex justify-between">
                <dt className="text-text-dim">{k}</dt>
                <dd className="data-mono text-text-hi">{v}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="panel p-5">
          <div className="flex items-center gap-2">
            <Clapperboard className="size-4 text-signal-bright" />
            <span className="label-tech">Video</span>
          </div>
          <dl className="mt-4 space-y-2 text-sm">
            {[
              ["Total", d.video.total],
              ["Ready", d.video.ready],
              ["Failed", d.video.failed],
              ["In progress", d.video.processing],
            ].map(([k, v]) => (
              <div key={String(k)} className="flex justify-between">
                <dt className="text-text-dim">{k}</dt>
                <dd className="data-mono text-text-hi">{v}</dd>
              </div>
            ))}
          </dl>
        </section>
      </div>

      {/* ── the inbox ───────────────────────────────────── */}
      <section>
        <SectionHeader label={`Feedback inbox · ${d.feedback.open.length} open`} />
        {d.feedback.open.length === 0 ? (
          <div className="flex items-start gap-3 panel p-5">
            <Inbox className="mt-0.5 size-4 shrink-0 text-text-faint" />
            <p className="text-sm text-text-dim">
              Nothing open. Silence this early usually means players have not been asked, not
              that everything is right — the feedback button is one tap from every screen.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {d.feedback.open.map((f) => (
              <article key={f.id} className="panel p-4">
                <div className="flex flex-wrap items-baseline gap-2">
                  <span className="chip data-mono">{f.kind}</span>
                  {f.rating !== null && (
                    <span className="chip" style={{ color: f.rating === 1 ? "var(--positive)" : "var(--correction)" }}>
                      {f.rating === 1 ? "useful" : "not useful"}
                    </span>
                  )}
                  {f.route && <span className="data-mono text-xs text-text-faint">{f.route}</span>}
                  {f.deviceClass && <span className="text-xs text-text-faint">{f.deviceClass}</span>}
                  <span className="ml-auto data-mono text-xs text-text-faint">
                    {f.createdAt.slice(0, 16).replace("T", " ")}
                  </span>
                </div>

                {f.body && (
                  <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-text">{f.body}</p>
                )}

                <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-line pt-3">
                  <span className="text-xs text-text-faint">{f.email}</span>
                  {f.appVersion && (
                    <span className="data-mono text-[11px] text-text-faint">build {f.appVersion}</span>
                  )}
                  <span className="ml-auto">
                    <TriageControls id={f.id} status={f.status} severity={f.severity} />
                  </span>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <p className="mt-8 border-t border-line pt-4 text-[11px] leading-relaxed text-text-faint">
        Product behaviour only. No page views, no session recording, no device fingerprints —
        what a player writes in their football record never appears here.
      </p>
    </div>
  );
}
