import Link from "next/link";
import { Network, BookMarked, Users, Check, ArrowUpRight, Sparkles, AlertCircle } from "lucide-react";
import { getClubOverview } from "@/lib/data/club";
import { METHODOLOGY_DOCS, staffRoleMeta, teamsWithoutStaff } from "@/lib/data/club-types";
import { SectionHeader } from "@/components/ui/primitives";
import { StatBand } from "@/components/ui/kit";
import { DashboardHero, DemoNote, EmptyState, QuickActions } from "./shared";

/*
  CLUB OS — HQ.
  The organizational layer: teams, staff, and the methodology that makes every
  other role in the club answer to the same football principles.
*/

export async function ClubHQ() {
  const d = await getClubOverview();
  const unstaffed = teamsWithoutStaff(d.teams);
  const activeStaff = d.staff.filter((s) => s.status !== "left");
  const written = d.methodology.documentsStarted;

  return (
    <div className="mx-auto max-w-[1440px] px-4 py-6 md:px-6 lg:py-8">
      <DashboardHero
        role="club"
        identity={[d.clubName, d.level].filter(Boolean).join(" · ")}
        title="HQ"
        line={
          d.teams.length ? (
            <>
              <span className="text-text-hi">{d.teams.length} teams</span> connected.
              {written < 3
                ? ` ${3 - written} methodology document${3 - written === 1 ? "" : "s"} still to write.`
                : " Methodology complete — MIDO answers inside it."}
            </>
          ) : (
            <>Create your teams, record your staff, and write the methodology every session answers to.</>
          )
        }
      />

      <section className="mb-8">
        <StatBand
          cols={4}
          stats={[
            { label: "Teams", value: d.teams.length },
            { label: "Recorded players", value: d.recordedPlayers, hint: "Squad sizes the club maintains" },
            { label: "Staff", value: activeStaff.length },
            { label: "Principles live", value: d.methodology.principles, hint: "What MIDO answers inside" },
          ]}
        />
      </section>

      <div className="grid gap-4 xl:grid-cols-12">
        {/* Teams */}
        <section className="rise-in min-w-0 xl:col-span-7">
          <SectionHeader label="Teams" action={{ label: "Manage teams", href: "/app/teams" }} />
          {d.teams.length ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {d.teams.map((t) => (
                <Link
                  key={t.id}
                  href="/app/teams"
                  className="min-w-0 group panel p-4 transition-colors hover:border-signal-line"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="truncate font-display text-base font-semibold text-text-hi">
                        {t.name}
                      </h3>
                      <div className="label-tech mt-0.5 truncate">{t.ageGroup || t.level || "—"}</div>
                    </div>
                    <div className="text-right">
                      <div className="stat-figure text-xl">{t.squadSize ?? "—"}</div>
                      <div className="label-tech mt-0.5">players</div>
                    </div>
                  </div>
                  <div className="mt-3 truncate border-t border-line pt-3 text-xs text-text-dim">
                    {t.staff.length ? (
                      t.staff
                        .map((s) => `${staffRoleMeta(s.role).label} · ${s.name}`)
                        .slice(0, 2)
                        .join(" · ")
                    ) : (
                      <span className="text-review">Nobody assigned</span>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={Network}
              title="No teams yet"
              body="A club is teams, staff and players connected by one methodology. Start by creating your first team."
              action={{ label: "Add a team", href: "/app/teams" }}
            />
          )}

          {unstaffed.length > 0 && (
            <div className="panel mt-3 flex items-start gap-3 border-review/30 bg-review/5 p-4">
              <AlertCircle className="mt-0.5 size-4 shrink-0 text-review" />
              <p className="min-w-0 text-sm leading-relaxed text-text-dim">
                <span className="text-text-hi">{unstaffed.map((t) => t.name).join(", ")}</span>{" "}
                {unstaffed.length === 1 ? "has" : "have"} nobody assigned.
              </p>
            </div>
          )}
        </section>

        {/* Methodology */}
        <section className="rise-in min-w-0 xl:col-span-5" style={{ animationDelay: "80ms" }}>
          <SectionHeader label="Club methodology" action={{ label: "Open", href: "/app/methodology" }} />
          <div className="space-y-2">
            {METHODOLOGY_DOCS.map((m) => {
              const count = d.methodology[m.doc];
              const done = count > 0;
              return (
                <Link
                  key={m.doc}
                  href="/app/methodology"
                  className="group panel flex items-start gap-3 p-4 transition-colors hover:border-signal-line"
                >
                  <span
                    className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg border border-line"
                    style={{
                      color: done ? "var(--positive)" : "var(--text-faint)",
                      background: done ? "var(--positive-wash)" : "transparent",
                    }}
                  >
                    {done ? <Check className="size-4" /> : <BookMarked className="size-4" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-text-hi">{m.title}</span>
                    <span className="mt-0.5 block text-xs leading-relaxed text-text-dim">
                      {done ? `${count} section${count === 1 ? "" : "s"} written` : m.tagline}
                    </span>
                  </span>
                  <ArrowUpRight className="size-4 shrink-0 text-text-faint transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                </Link>
              );
            })}
          </div>

          <div className="relative mt-3 overflow-hidden rounded-xl border border-signal-line bg-gradient-to-b from-signal/10 via-ink-900 to-ink-900 p-4">
            <div className="label-tech mb-2 !text-signal-bright">Club intelligence / 01</div>
            <div className="relative flex items-start gap-3">
              <Sparkles className="mt-0.5 size-4 shrink-0 text-signal-bright" />
              <p className="text-xs leading-relaxed text-text-dim">
                {d.methodology.principles > 0 ? (
                  <>
                    <span className="text-text-hi">{d.methodology.principles} principles are live.</span> A
                    coach in this club drafting a session gets one written inside them — not generic best
                    practice.
                  </>
                ) : (
                  <>
                    Until the methodology is written, MIDO answers your coaches generically. Write the
                    principles and the same request returns{" "}
                    <span className="text-text-hi">this club&rsquo;s</span> session instead.
                  </>
                )}
              </p>
            </div>
          </div>
        </section>
      </div>

      <div className="mt-8 grid gap-4 lg:grid-cols-[1.2fr_1fr]">
        <section className="min-w-0">
          <SectionHeader label="Staff" action={{ label: "Manage staff", href: "/app/staff" }} />
          {activeStaff.length ? (
            <div className="panel divide-y divide-line overflow-hidden">
              {activeStaff.slice(0, 6).map((s) => {
                const rm = staffRoleMeta(s.role);
                const team = d.teams.find((t) => t.id === s.teamId);
                return (
                  <Link
                    key={s.id}
                    href="/app/staff"
                    className="group flex items-center gap-3 p-3.5 transition-colors hover:bg-ink-850"
                  >
                    <span className="grid size-9 shrink-0 place-items-center rounded-lg border border-line bg-ink-850 font-display text-xs font-bold text-signal-bright">
                      {s.name
                        .split(/\s+/)
                        .map((p) => p[0])
                        .join("")
                        .slice(0, 2)
                        .toUpperCase()}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium text-text-hi">{s.name}</div>
                      <div className="label-tech mt-0.5 truncate" style={{ color: rm.color }}>
                        {rm.label} · {team ? team.name : "Across the club"}
                      </div>
                    </div>
                    {s.linked && <span className="chip chip-signal !px-1.5 !py-0">linked</span>}
                  </Link>
                );
              })}
            </div>
          ) : (
            <EmptyState
              icon={Users}
              title="No staff recorded"
              body="Record the people working in the club and what they are responsible for. Recording someone gives them no access — that comes from their own account joining."
              action={{ label: "Add staff", href: "/app/staff" }}
            />
          )}
        </section>

        <section className="min-w-0">
          <SectionHeader label="Start here" />
          <QuickActions role="club" />
          <Link
            href="/app/intelligence"
            className="group panel mt-2 flex items-center gap-3 p-4 transition-colors hover:border-signal-line"
          >
            <span className="grid size-9 shrink-0 place-items-center rounded-lg border border-line bg-ink-850 text-signal-bright">
              <Network className="size-4" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-sm text-text-hi">See where the gaps are</div>
              <div className="label-tech mt-0.5">Development trends</div>
            </div>
          </Link>
        </section>
      </div>

      {d.isDemo && (
        <DemoNote>
          Demonstration academy — teams, staff and a partially written methodology, so the Club OS can be
          explored. Everything you add is real for this session of use.
        </DemoNote>
      )}
    </div>
  );
}
