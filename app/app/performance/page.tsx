import Link from "next/link";
import { LineChart, Star, Trophy, ArrowUpRight, Info } from "lucide-react";
import { getPerformance } from "@/lib/data/performance";
import { NOT_RECORDED, type MatchRow, type Per90 } from "@/lib/data/performance-types";
import { SectionHeader } from "@/components/ui/primitives";
import { PageHeader, StatBand, MiniBars, ProgressRow, FormPips } from "@/components/ui/kit";
import { DemoNote, EmptyState } from "@/components/dashboards/shared";

export const metadata = { title: "Performance — MIDO XI" };

/*
  Every chart on this page is drawn from something the user recorded.

  It used to import a hardcoded module with no demo-mode branch at all, so a
  real signed-in account saw a fictional centre-forward's season presented as
  its own — complete with per-90 figures for pressures and runs in behind, which
  MIDO has no way of measuring and explicitly refuses to claim elsewhere.

  Now: real records, an honest empty state when there are none, coverage stated
  rather than implied, and a panel naming what MIDO does not hold and why.
*/

function result(m: MatchRow): "W" | "D" | "L" | null {
  if (m.gf === null || m.ga === null) return null;
  return m.gf > m.ga ? "W" : m.gf === m.ga ? "D" : "L";
}

function ratingColor(v: number) {
  return v >= 7.5 ? "var(--positive)" : v >= 7 ? "var(--signal)" : "var(--review)";
}

/*
  A per-90 bar needs a ceiling to be drawn against. Rather than hardcoding one
  per metric — which is how a chart ends up implying a target nobody set — the
  scale is the largest value present, rounded up. The bar shows relative shape;
  the number beside it is the fact.
*/
function scaleFor(per90: Per90[]): number {
  const max = Math.max(0, ...per90.map((p) => p.value));
  return max <= 0 ? 1 : Math.ceil(max * 1.15);
}

export default async function PerformancePage() {
  const { source, matches, per90, workload, highlights, coverage } = await getPerformance();

  const chrono = [...matches].reverse();
  const form = matches.slice(0, 5).map(result).filter((r): r is "W" | "D" | "L" => r !== null).reverse();
  const rated = matches.filter((m) => m.rating !== null);
  const avgRating = rated.length
    ? (rated.reduce((a, m) => a + (m.rating ?? 0), 0) / rated.length).toFixed(1)
    : null;
  const load = workload.map((w) => ({ label: w.week, value: w.training, sub: w.match }));
  const scale = scaleFor(per90);

  const totals = {
    goals: matches.reduce((n, m) => n + m.goals, 0),
    assists: matches.reduce((n, m) => n + m.assists, 0),
    minutes: matches.reduce((n, m) => n + m.minutes, 0),
    starts: matches.filter((m) => m.started).length,
  };

  return (
    <div className="mx-auto max-w-[1100px] px-4 py-8 md:px-6">
      <PageHeader
        icon={LineChart}
        title="Performance"
        tagline="Every figure here comes from something you recorded."
      />

      {source === "demo" && (
        <div className="mb-6">
          <DemoNote>
            A seeded season, kept to what MIDO can actually hold — matches, minutes, goals,
            assists, ratings and the stat lines a person writes down afterwards. Connect Supabase
            and this reads your own record instead.
          </DemoNote>
        </div>
      )}

      {matches.length === 0 ? (
        <EmptyState
          icon={LineChart}
          title="Nothing recorded yet"
          body="Performance is built from your match log. Log one match and the form, ratings and workload charts start filling in — there is nothing here to show until then, and MIDO will not invent it."
          action={{ label: "Log a match", href: "/app/matches" }}
        />
      ) : (
        <>
          {/* What is actually on record */}
          <section className="mb-8">
            <SectionHeader label={`Recorded · ${coverage.matches} ${coverage.matches === 1 ? "match" : "matches"}`} />
            <StatBand
              cols={4}
              stats={[
                { label: "Goals", value: totals.goals },
                { label: "Assists", value: totals.assists },
                { label: "Minutes", value: totals.minutes },
                { label: "Starts", value: `${totals.starts}/${coverage.matches}` },
              ]}
            />
          </section>

          {/* Form + ratings */}
          <div className="mb-8 grid gap-4 lg:grid-cols-2">
            <section className="min-w-0">
              <SectionHeader label={`Form · last ${Math.min(5, form.length)}`} />
              <div className="min-w-0 panel flex flex-col gap-4 p-5">
                <div className="flex items-center justify-between gap-3">
                  {form.length ? (
                    <FormPips results={form} />
                  ) : (
                    <span className="text-sm text-text-dim">No scorelines recorded</span>
                  )}
                  <div className="shrink-0 text-right">
                    {avgRating ? (
                      <>
                        <div className="flex items-center gap-1.5">
                          <Star className="size-4 text-review" fill="var(--review)" />
                          <span className="stat-figure text-xl">{avgRating}</span>
                        </div>
                        <div className="label-tech mt-0.5">
                          Avg of {coverage.matchesWithRating}
                        </div>
                      </>
                    ) : (
                      <div className="label-tech">No ratings yet</div>
                    )}
                  </div>
                </div>
                {rated.length > 0 && (
                  <div>
                    <div className="label-tech mb-2">Rating by match</div>
                    <MiniBars
                      data={chrono
                        .filter((m) => m.rating !== null)
                        .map((m) => ({ label: m.opponentShort, value: m.rating ?? 0 }))}
                      className="h-24"
                      colorFor={ratingColor}
                    />
                  </div>
                )}
              </div>
            </section>

            <section className="min-w-0">
              <SectionHeader label="Per 90" />
              <div className="min-w-0 panel space-y-3 p-5">
                {per90.length ? (
                  per90.map((p) => (
                    <ProgressRow
                      key={p.key}
                      label={p.label}
                      value={p.value}
                      max={scale}
                      valueLabel={p.value.toFixed(1)}
                      color="var(--signal)"
                    />
                  ))
                ) : (
                  <p className="text-sm leading-relaxed text-text-dim">
                    No per-90 figures yet. These appear once at least two matches have a stat line
                    recorded — a figure from a single appearance describes that appearance, not you.
                  </p>
                )}
                {per90.length > 0 && (
                  <p className="border-t border-line pt-3 text-xs leading-relaxed text-text-faint">
                    From {coverage.matchesWithStats} of {coverage.matches} matches with a stat line.
                    Bars are scaled to your own highest figure — there is no target here that
                    somebody else set.
                  </p>
                )}
              </div>
            </section>
          </div>

          {/* Workload */}
          <section className="mb-8">
            <SectionHeader
              label="Workload · rolling 8 weeks"
              action={{ label: "Training", href: "/app/training" }}
            />
            <div className="min-w-0 panel p-5">
              <div className="mb-3 flex flex-wrap items-center gap-4 text-xs">
                <span className="flex items-center gap-1.5">
                  <span
                    className="size-2.5 rounded-sm"
                    style={{ background: "color-mix(in oklab, var(--signal) 70%, transparent)" }}
                  />{" "}
                  Training min
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="size-2.5 rounded-sm bg-signal-bright/80" /> Match min
                </span>
              </div>
              <MiniBars data={load} className="h-32" />
              <p className="mt-3 text-xs text-text-faint">
                {coverage.trainingSessions} training{" "}
                {coverage.trainingSessions === 1 ? "session" : "sessions"} recorded in this window.
                Empty weeks are weeks with nothing logged, not weeks with no work.
              </p>
            </div>
          </section>

          {/* Match log */}
          <section className="mb-8">
            <SectionHeader
              label={`Match log · ${matches.length}`}
              action={{ label: "Match center", href: "/app/matches" }}
            />
            <div className="panel overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="label-tech border-b border-line text-left">
                    <th className="px-4 py-2.5 font-medium">Match</th>
                    <th className="px-4 py-2.5 font-medium">Comp</th>
                    <th className="px-4 py-2.5 text-center font-medium">Pos</th>
                    <th className="px-4 py-2.5 text-center font-medium">Min</th>
                    <th className="px-4 py-2.5 text-center font-medium">G</th>
                    <th className="px-4 py-2.5 text-center font-medium">A</th>
                    <th className="px-4 py-2.5 text-right font-medium">Rating</th>
                  </tr>
                </thead>
                <tbody>
                  {matches.map((m) => {
                    const r = result(m);
                    return (
                      <tr
                        key={m.id}
                        className="border-b border-line/60 transition-colors last:border-0 hover:bg-ink-850/50"
                      >
                        <td className="px-4 py-2.5">
                          <span className="text-text-hi">
                            {m.home ? "vs" : "@"} {m.opponent}
                          </span>
                          {r && (
                            <span
                              className={`data-mono ml-2 text-xs ${
                                r === "W"
                                  ? "text-positive"
                                  : r === "L"
                                    ? "text-review"
                                    : "text-text-faint"
                              }`}
                            >
                              {m.gf}–{m.ga}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-text-dim">{m.competition.split(" · ")[0]}</td>
                        <td className="px-4 py-2.5 text-center text-text-dim">
                          {m.position}
                          {m.started ? "" : " ·s"}
                        </td>
                        <td className="data-mono px-4 py-2.5 text-center text-text">{m.minutes}</td>
                        <td className="data-mono px-4 py-2.5 text-center text-text-hi">
                          {m.goals || "–"}
                        </td>
                        <td className="data-mono px-4 py-2.5 text-center text-text-hi">
                          {m.assists || "–"}
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          {m.rating === null ? (
                            <span className="text-text-faint">–</span>
                          ) : (
                            <span
                              className="data-mono font-semibold"
                              style={{ color: ratingColor(m.rating) }}
                            >
                              {m.rating.toFixed(1)}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          {/* Highlights — read off the record, each naming its match */}
          {highlights.length > 0 && (
            <section className="mb-8">
              <SectionHeader label="From your record" />
              <div className="grid gap-3 sm:grid-cols-3">
                {highlights.map((h) => (
                  <div key={h.label} className="min-w-0 panel p-4">
                    <div className="flex items-center gap-2 text-review">
                      <Trophy className="size-4" />
                      <span className="label-tech !text-review">{h.date}</span>
                    </div>
                    <h3 className="mt-2 font-display text-sm font-semibold text-text-hi">
                      {h.label}
                    </h3>
                    <p className="mt-1 text-xs leading-relaxed text-text-dim">{h.detail}</p>
                  </div>
                ))}
              </div>
            </section>
          )}
        </>
      )}

      {/* What MIDO does not hold */}
      <section>
        <SectionHeader label="What is not here" />
        <div className="min-w-0 panel p-5">
          <div className="flex items-start gap-3">
            <Info className="mt-0.5 size-4 shrink-0 text-info" />
            <div className="min-w-0">
              <p className="text-sm leading-relaxed text-text-dim">{NOT_RECORDED.why}</p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {NOT_RECORDED.metrics.map((m) => (
                  <span key={m} className="chip">
                    {m}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <Link
        href="/app/matches"
        className="mt-6 inline-flex items-center gap-1.5 text-sm text-text-dim transition-colors hover:text-signal-bright"
      >
        Full match center <ArrowUpRight className="size-4" />
      </Link>
    </div>
  );
}
