import Link from "next/link";
import {
  Users,
  Swords,
  ClipboardList,
  Radar,
  GraduationCap,
  AlertCircle,
  Clock,
  ArrowUpRight,
} from "lucide-react";
import { getCoachDashboard } from "@/lib/data/roles";
import { statusMeta } from "@/lib/data/coach-types";
import { SectionHeader } from "@/components/ui/primitives";
import { StatBand } from "@/components/ui/kit";
import { DashboardHero, DemoNote, EmptyState, QuickActions } from "./shared";

/*
  COACH OS — the Touchline.
  A coach opens MIDO XI to answer: what is my team, what is next, and who
  needs my attention. Squad first, fixture second, work third.
*/

export async function CoachTouchline() {
  const d = await getCoachDashboard();
  const available = d.squad.filter((p) => p.status === "active").length;
  const withFocus = d.squad.filter((p) => p.focus).length;

  return (
    <div className="mx-auto max-w-[1440px] px-4 py-6 md:px-6 lg:py-8">
      <DashboardHero
        role="coach"
        identity={d.teamName}
        title="Touchline"
        line={
          d.nextMatch ? (
            <>
              {d.nextMatch.opponent} in{" "}
              <span className="text-text-hi">{d.nextMatch.daysRemaining} days</span>. Build the week
              backwards from it.
            </>
          ) : (
            <>Add your squad and your next opponent — the week plans itself backwards from the match.</>
          )
        }
      />

      <section className="mb-8">
        <StatBand
          cols={4}
          stats={[
            { label: "Squad", value: d.squad.length },
            { label: "Available", value: available, hint: "Fit and selectable" },
            { label: "Sessions this week", value: d.sessionsThisWeek },
            { label: "With a focus", value: `${withFocus}/${d.squad.length || 0}` },
          ]}
        />
      </section>

      <div className="grid gap-4 xl:grid-cols-12">
        {/* Next fixture + next session */}
        <section className="rise-in min-w-0 xl:col-span-5">
          <SectionHeader label="Next fixture" action={{ label: "Opposition", href: "/app/opposition" }} />
          {d.nextMatch ? (
            <Link
              href={`/app/opposition/${d.nextMatch.reportId}`}
              className="group panel-raised relative block overflow-hidden p-5 transition-colors hover:border-signal-line"
            >
              <div className="pitch-grid absolute inset-0 opacity-40" aria-hidden />
              <div className="relative">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="label-tech">{d.nextMatch.home ? "Home" : "Away"}</div>
                    <h3 className="mt-1 font-display text-2xl font-semibold text-text-hi">
                      {d.nextMatch.opponent}
                    </h3>
                    <p className="mt-0.5 text-sm text-text-dim">
                      {d.nextMatch.competition || "Fixture"}
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="stat-figure text-3xl">{d.nextMatch.daysRemaining}</div>
                    <div className="label-tech mt-1">days out</div>
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-line pt-4">
                  <span
                    className="chip"
                    style={
                      d.nextMatch.hasPlan
                        ? { color: "var(--positive)", borderColor: "var(--positive-wash)" }
                        : { color: "var(--review)", borderColor: "var(--review-wash)" }
                    }
                  >
                    {d.nextMatch.hasPlan ? "Match plan ready" : "No match plan yet"}
                  </span>
                  <span className="ml-auto flex items-center gap-1 text-[11px] text-text-faint transition-colors group-hover:text-signal-bright">
                    Open the report
                    <ArrowUpRight className="size-3 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                  </span>
                </div>
              </div>
            </Link>
          ) : (
            <EmptyState
              icon={Swords}
              title="No opponent scouted"
              body="Create an opposition report for your next match. MIDO builds the plan from what you record — and only from that."
              action={{ label: "New report", href: "/app/opposition" }}
            />
          )}

          <div className="mt-3">
            <SectionHeader label="Next session" action={{ label: "Planner", href: "/app/sessions" }} />
            {d.nextSession ? (
              <Link
                href={`/app/sessions/${d.nextSession.id}`}
                className="group panel flex items-center gap-3 p-4 transition-colors hover:border-signal-line"
              >
                <span className="grid size-9 shrink-0 place-items-center rounded-lg border border-line bg-ink-850 text-signal-bright">
                  <ClipboardList className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-text-hi">{d.nextSession.title}</div>
                  <div className="label-tech mt-0.5 truncate">
                    {d.nextSession.scheduledAt
                      ? new Date(d.nextSession.scheduledAt).toLocaleString("en-GB", {
                          weekday: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : "Unscheduled"}
                    {d.nextSession.durationMin ? ` · ${d.nextSession.durationMin}m` : ""}
                  </div>
                </div>
                <Clock className="size-4 shrink-0 text-text-faint" />
              </Link>
            ) : (
              <div className="panel p-4 text-sm text-text-dim">
                Nothing planned.{" "}
                <Link href="/app/sessions" className="text-signal-bright hover:underline">
                  Plan a session
                </Link>{" "}
                — write the objective and MIDO can draft the blocks.
              </div>
            )}
          </div>
        </section>

        {/* Squad */}
        <section className="rise-in min-w-0 xl:col-span-7" style={{ animationDelay: "80ms" }}>
          <SectionHeader label="Squad" action={{ label: "Open squad", href: "/app/squad" }} />
          {d.squad.length ? (
            <div className="panel divide-y divide-line overflow-hidden">
              {d.squad.slice(0, 10).map((p) => {
                const st = statusMeta(p.status);
                return (
                  <Link
                    key={p.id}
                    href={`/app/squad/${p.id}`}
                    className="group flex items-center gap-3 p-3.5 transition-colors hover:bg-ink-850"
                  >
                    <span className="data-mono grid size-9 shrink-0 place-items-center rounded-md border border-line bg-ink-850 text-sm text-text">
                      {p.squadNumber ?? "–"}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-medium text-text-hi">{p.name}</span>
                        {p.position && <span className="chip !px-1.5 !py-0">{p.position}</span>}
                        {p.linked && (
                          <span className="chip chip-signal !px-1.5 !py-0" title="Has a MIDO XI account">
                            linked
                          </span>
                        )}
                      </div>
                      <div className="mt-0.5 truncate text-xs text-text-dim">
                        {p.focus ?? "No development focus set"}
                      </div>
                    </div>
                    <span className="label-tech shrink-0" style={{ color: st.color }}>
                      {st.label}
                    </span>
                  </Link>
                );
              })}
              {d.squad.length > 10 && (
                <Link
                  href="/app/squad"
                  className="flex items-center justify-center gap-1.5 p-3 text-xs text-text-faint transition-colors hover:text-signal-bright"
                >
                  {d.squad.length - 10} more <ArrowUpRight className="size-3" />
                </Link>
              )}
            </div>
          ) : (
            <EmptyState
              icon={Users}
              title="Your squad is empty"
              body="Add players to start tracking development, availability and notes. Every session and match observation hangs off a player."
              action={{ label: "Open squad", href: "/app/squad" }}
            />
          )}
        </section>
      </div>

      {/* Attention + actions */}
      <div className="mt-8 grid gap-4 lg:grid-cols-[1.2fr_1fr]">
        <section className="min-w-0">
          <SectionHeader label="Needs your attention" />
          <div className="space-y-2">
            {d.reportsWithoutPlan > 0 && (
              <Link
                href="/app/opposition"
                className="group panel flex items-center gap-3 p-4 transition-colors hover:border-signal-line"
              >
                <Radar className="size-4 shrink-0 text-review" />
                <div className="min-w-0 flex-1">
                  <div className="text-sm text-text-hi">
                    {d.reportsWithoutPlan} opposition report{d.reportsWithoutPlan === 1 ? "" : "s"} without
                    a plan
                  </div>
                  <div className="label-tech mt-0.5">Turn observations into instructions</div>
                </div>
                <span className="chip group-hover:border-signal-line group-hover:text-signal-bright">
                  Build
                </span>
              </Link>
            )}

            {d.needsAttention.map((p) => (
              <Link
                key={p.id}
                href={`/app/squad/${p.id}`}
                className="group panel flex items-center gap-3 p-4 transition-colors hover:border-signal-line"
              >
                <AlertCircle className="size-4 shrink-0 text-review" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm text-text-hi">{p.name}</div>
                  <div className="label-tech mt-0.5">No development focus recorded</div>
                </div>
                <span className="chip group-hover:border-signal-line group-hover:text-signal-bright">
                  Set focus
                </span>
              </Link>
            ))}

            {d.reportsWithoutPlan === 0 && d.needsAttention.length === 0 && (
              <div className="panel p-5 text-sm text-text-dim">
                Every player has a development focus, and every opponent has a plan. Nothing outstanding.
              </div>
            )}
          </div>
        </section>

        <section className="min-w-0">
          <SectionHeader label="Start here" />
          <QuickActions role="coach" />
          <Link
            href="/app/study"
            className="group panel mt-2 flex items-center gap-3 p-4 transition-colors hover:border-signal-line"
          >
            <span className="grid size-9 shrink-0 place-items-center rounded-lg border border-line bg-ink-850 text-signal-bright">
              <GraduationCap className="size-4" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-sm text-text-hi">Study a coach</div>
              <div className="label-tech mt-0.5">Guardiola · Ancelotti · Simeone · Bielsa</div>
            </div>
          </Link>
        </section>
      </div>

      {d.isDemo && (
        <DemoNote>
          Demo mode — the squad, sessions and reports here are a working dataset. Everything you add is
          real for this session of use, and writes to Postgres once a backend is connected.
        </DemoNote>
      )}
    </div>
  );
}
