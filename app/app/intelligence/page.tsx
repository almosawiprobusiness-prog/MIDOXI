import Link from "next/link";
import { LineChart, BookMarked, Users, Network, ShieldCheck, ArrowUpRight, Info } from "lucide-react";
import { getClubOverview, listMethodology } from "@/lib/data/club";
import { METHODOLOGY_DOCS, teamsWithoutStaff } from "@/lib/data/club-types";
import { isDemoMode } from "@/lib/env";
import { PageHeader, StatBand, ProgressRow } from "@/components/ui/kit";
import { SectionHeader } from "@/components/ui/primitives";
import { EmptyState, DemoNote } from "@/components/dashboards/shared";

export const metadata = { title: "Development trends — MIDO XI" };

export default async function ClubIntelligencePage() {
  const [club, sections] = await Promise.all([getClubOverview(), listMethodology()]);
  const unstaffed = teamsWithoutStaff(club.teams);
  const activeStaff = club.staff.filter((s) => s.status !== "left");
  const linked = activeStaff.filter((s) => s.linked).length;

  // Coverage the club can actually verify from its own records.
  const coverage = [
    {
      label: "Teams with staff assigned",
      value: club.teams.length ? club.teams.length - unstaffed.length : 0,
      max: club.teams.length,
    },
    {
      label: "Staff with a MIDO XI account",
      value: linked,
      max: activeStaff.length,
    },
    {
      label: "Methodology documents written",
      value: club.methodology.documentsStarted,
      max: 3,
    },
  ];

  const byAgeGroup = club.teams.reduce<Record<string, number>>((acc, t) => {
    const key = t.ageGroup || "Unassigned";
    acc[key] = (acc[key] ?? 0) + (t.squadSize ?? 0);
    return acc;
  }, {});
  const ageRows = Object.entries(byAgeGroup).sort((a, b) => b[1] - a[1]);
  const maxAge = Math.max(1, ...ageRows.map(([, n]) => n));

  return (
    <div className="mx-auto max-w-[1100px] px-4 py-8 md:px-6">
      <PageHeader
        icon={LineChart}
        title="Development trends"
        tagline="What is actually happening across the club."
      />

      {club.teams.length === 0 && activeStaff.length === 0 ? (
        <EmptyState
          icon={Network}
          title="Nothing to report yet"
          body="This page is built only from what the club has recorded — teams, staff and methodology. Add your teams first and it fills in."
          action={{ label: "Add a team", href: "/app/teams" }}
        />
      ) : (
        <>
          <section className="mb-8">
            <StatBand
              cols={4}
              stats={[
                { label: "Teams", value: club.teams.length },
                { label: "Recorded players", value: club.recordedPlayers },
                { label: "Staff", value: activeStaff.length },
                { label: "Principles live", value: club.methodology.principles },
              ]}
            />
          </section>

          <div className="grid gap-4 lg:grid-cols-2">
            <section className="panel min-w-0 p-5">
              <div className="label-tech">Organisational coverage</div>
              <div className="mt-4 space-y-4">
                {coverage.map((c) => (
                  <ProgressRow
                    key={c.label}
                    label={c.label}
                    value={c.value}
                    max={Math.max(1, c.max)}
                    valueLabel={`${c.value}/${c.max}`}
                    color={c.value === c.max && c.max > 0 ? "var(--positive)" : "var(--signal)"}
                  />
                ))}
              </div>
              <p className="mt-4 border-t border-line pt-3 text-[11px] leading-relaxed text-text-faint">
                Every figure here is counted from club records. Nothing is estimated.
              </p>
            </section>

            <section className="panel min-w-0 p-5">
              <div className="label-tech">Recorded players by age group</div>
              {ageRows.length ? (
                <div className="mt-4 space-y-3">
                  {ageRows.map(([group, n]) => (
                    <div key={group}>
                      <div className="mb-1 flex items-center justify-between text-sm">
                        <span className="text-text-dim">{group}</span>
                        <span className="data-mono text-text">{n}</span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-ink-800">
                        <div
                          className="h-full rounded-full bg-signal"
                          style={{ width: `${Math.round((n / maxAge) * 100)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-3 text-sm text-text-dim">
                  No squad sizes recorded. Add them on a team and this fills in.
                </p>
              )}
            </section>
          </div>

          {/* Methodology reach */}
          <section className="mt-8">
            <SectionHeader label="Methodology reach" action={{ label: "Open", href: "/app/methodology" }} />
            <div className="grid gap-3 sm:grid-cols-3">
              {METHODOLOGY_DOCS.map((doc) => {
                const rows = sections.filter((s) => s.doc === doc.doc);
                const principles = rows.reduce((n, s) => n + s.principles.length, 0);
                return (
                  <Link
                    key={doc.doc}
                    href="/app/methodology"
                    className="group panel p-4 transition-colors hover:border-signal-line"
                  >
                    <div className="flex items-center gap-2">
                      <BookMarked className="size-3.5" style={{ color: doc.color }} />
                      <span className="label-tech" style={{ color: doc.color }}>
                        {rows.length ? "written" : "not started"}
                      </span>
                      <ArrowUpRight className="ml-auto size-3.5 text-text-faint transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                    </div>
                    <h3 className="mt-1.5 font-display text-base font-semibold text-text-hi">
                      {doc.title}
                    </h3>
                    <div className="mt-2 flex items-baseline gap-1.5">
                      <span className="stat-figure text-xl">{principles}</span>
                      <span className="text-xs text-text-dim">principles</span>
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>

          {/* Attention */}
          {(unstaffed.length > 0 || club.methodology.documentsStarted < 3) && (
            <section className="mt-8">
              <SectionHeader label="Where the gaps are" />
              <div className="space-y-2">
                {unstaffed.map((t) => (
                  <Link
                    key={t.id}
                    href="/app/teams"
                    className="group panel flex items-center gap-3 p-4 transition-colors hover:border-signal-line"
                  >
                    <Users className="size-4 shrink-0 text-review" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm text-text-hi">{t.name} has nobody assigned</div>
                      <div className="label-tech mt-0.5">Development with no owner</div>
                    </div>
                    <span className="chip group-hover:border-signal-line group-hover:text-signal-bright">
                      Assign
                    </span>
                  </Link>
                ))}
                {METHODOLOGY_DOCS.filter((d) => !sections.some((s) => s.doc === d.doc)).map((d) => (
                  <Link
                    key={d.doc}
                    href="/app/methodology"
                    className="group panel flex items-center gap-3 p-4 transition-colors hover:border-signal-line"
                  >
                    <BookMarked className="size-4 shrink-0 text-review" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm text-text-hi">
                        &ldquo;{d.title}&rdquo; is not written
                      </div>
                      <div className="label-tech mt-0.5">{d.tagline}</div>
                    </div>
                    <span className="chip group-hover:border-signal-line group-hover:text-signal-bright">
                      Write
                    </span>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* What we can and cannot see */}
          <section className="mt-8">
            <SectionHeader label="What this page can and cannot show" />
            <div className="panel p-5">
              <div className="flex items-start gap-3">
                <ShieldCheck className="mt-0.5 size-4 shrink-0 text-info" />
                <div className="min-w-0 space-y-3 text-sm leading-relaxed text-text-dim">
                  <p>
                    <span className="text-text-hi">Shown:</span> everything the club itself records —
                    teams, squad sizes, staff, assignments and methodology.
                  </p>
                  <p>
                    <span className="text-text-hi">Not shown:</span> individual players&rsquo; development
                    maps, studies, check-ins and clips. Those belong to the player, and a club
                    administrator has no route to them — enforced in the database, not just hidden in this
                    interface.
                  </p>
                  <p>
                    <span className="text-text-hi">Next:</span> team-level development trends arrive when
                    staff link their MIDO XI accounts and share team-level summaries. Until they do, this
                    page will keep saying so rather than estimating.
                  </p>
                </div>
              </div>
            </div>
          </section>

          <p className="mt-8 flex items-start gap-2 text-[11px] leading-relaxed text-text-faint">
            <Info className="mt-0.5 size-3.5 shrink-0" />
            {linked === 0
              ? "No staff have linked a MIDO XI account yet, so nothing on this page comes from their own work."
              : `${linked} of ${activeStaff.length} staff have linked an account.`}
          </p>
        </>
      )}

      {isDemoMode && (
        <DemoNote>Demo mode — a partially built academy, so the gaps are visible.</DemoNote>
      )}
    </div>
  );
}
