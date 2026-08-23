import Link from "next/link";
import { Quote, TrendingUp, Target, Pencil, Info, ArrowUpRight } from "lucide-react";
import { getProfileSettings } from "@/lib/data/profile";
import { listGoals } from "@/lib/data/development";
import { getPerformance } from "@/lib/data/performance";
import { SectionHeader } from "@/components/ui/primitives";
import { isDemoMode } from "@/lib/env";
import { DemoNote } from "@/components/dashboards/shared";

export const metadata = { title: "Profile — MIDO XI" };

/*
  The player dossier, built only from what the player entered or recorded.

  Two things came off this page for good.

  **The attribute profile** — Finishing 82, Pace 84, Pressing 88, drawn as
  filled bars. Nothing in MIDO assesses any of those. Nobody scored them; they
  were written into a demo file and rendered to every account as though a scout
  had graded the player. They are gone. What replaces them is development goals,
  which are real: the player wrote them, and the progress bar is the evidence
  they have attached.

  **The career timeline** — three invented seasons at invented clubs. MIDO holds
  one season on `player_profiles`, so it now shows one season and says that
  history is not tracked, rather than inventing a past.
*/

function ageFrom(dob: string | null | undefined): string {
  if (!dob) return "—";
  const d = new Date(dob);
  if (Number.isNaN(d.getTime())) return "—";
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age -= 1;
  return age > 0 && age < 120 ? String(age) : "—";
}

function progressColor(v: number) {
  return v >= 70 ? "var(--positive)" : v >= 35 ? "var(--signal)" : "var(--review)";
}

/** A row is shown when it has a value; a dossier of dashes helps nobody. */
function Rows({ rows }: { rows: { label: string; value: string }[] }) {
  const filled = rows.filter((r) => r.value && r.value !== "—");
  if (filled.length === 0) {
    return (
      <div className="panel p-4">
        <p className="text-sm leading-relaxed text-text-dim">
          Nothing recorded yet.{" "}
          <Link href="/app/settings" className="text-signal-bright hover:underline">
            Fill this in
          </Link>{" "}
          and it appears here.
        </p>
      </div>
    );
  }
  return (
    <dl className="min-w-0 panel divide-y divide-line">
      {filled.map((row) => (
        <div key={row.label} className="flex items-center justify-between gap-3 px-4 py-3">
          <dt className="shrink-0 text-sm text-text-dim">{row.label}</dt>
          <dd className="min-w-0 truncate text-right text-sm text-text-hi">{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export default async function ProfilePage() {
  const [p, goals, performance] = await Promise.all([
    getProfileSettings(),
    listGoals(),
    getPerformance(),
  ]);

  const name = p.knownAs || p.fullName || "Your profile";
  const working = goals.filter((g) => g.status !== "achieved");
  const achieved = goals.filter((g) => g.status === "achieved");

  const totals = {
    matches: performance.matches.length,
    goals: performance.matches.reduce((n, m) => n + m.goals, 0),
    assists: performance.matches.reduce((n, m) => n + m.assists, 0),
    minutes: performance.matches.reduce((n, m) => n + m.minutes, 0),
  };

  return (
    <div className="mx-auto max-w-[1100px] px-4 py-8 md:px-6">
      {isDemoMode && (
        <div className="mb-6">
          <DemoNote>
            A seeded dossier. Every field here is one a real account fills in from Settings — there
            are no scouted ratings, because MIDO does not scout.
          </DemoNote>
        </div>
      )}

      {/* Identity */}
      <div className="rise-in min-w-0 panel-raised relative overflow-hidden p-6">
        <div className="pitch-grid absolute inset-0 opacity-40" aria-hidden />
        <div className="field-glow absolute inset-0" aria-hidden />
        <div className="relative flex flex-wrap items-center gap-5">
          <div className="grid size-20 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-signal to-signal-deep font-display text-3xl font-bold text-white shadow-lg shadow-signal/20">
            {p.squadNumber ?? name.slice(0, 1).toUpperCase()}
          </div>
          <div className="min-w-0">
            <div className="label-tech flex flex-wrap items-center gap-2">
              <span>Player dossier</span>
              {p.primaryPosition && <span className="chip chip-signal">{p.primaryPosition}</span>}
              {p.secondaryPosition && <span className="chip">{p.secondaryPosition}</span>}
            </div>
            <h1 className="mt-1 font-display text-4xl font-bold tracking-tight text-text-hi">
              {name}
            </h1>
            <p className="mt-1 text-sm text-text-dim">
              {[p.club, p.league, p.season].filter(Boolean).join(" · ") || "No club recorded"}
            </p>
          </div>
          <Link
            href="/app/settings"
            className="ml-auto inline-flex shrink-0 items-center gap-2 self-start rounded-lg border border-line bg-ink-850/60 px-3 py-2 text-sm text-text backdrop-blur-sm transition-colors hover:border-signal-line hover:text-signal-bright"
          >
            <Pencil className="size-3.5" /> Edit
          </Link>
        </div>
      </div>

      {/* Season — from the match log, not from anywhere else */}
      <div className="rise-in mt-6" style={{ animationDelay: "80ms" }}>
        <SectionHeader
          label="Recorded this season"
          action={{ label: "Performance", href: "/app/performance" }}
        />
        <div className="panel grid grid-cols-2 gap-px overflow-hidden bg-line sm:grid-cols-4">
          {[
            { label: "Matches", value: totals.matches },
            { label: "Goals", value: totals.goals },
            { label: "Assists", value: totals.assists },
            { label: "Minutes", value: totals.minutes },
          ].map((s) => (
            <div key={s.label} className="min-w-0 bg-ink-900 p-4">
              <div className="stat-figure text-2xl">{s.value}</div>
              <div className="label-tech mt-1 truncate">{s.label}</div>
            </div>
          ))}
        </div>
        <p className="mt-2 text-xs text-text-faint">
          Counted from your match log. Nothing here is estimated.
        </p>
      </div>

      {/* Playing style — the player's own words */}
      {p.playStyle && (
        <div className="rise-in mt-6" style={{ animationDelay: "120ms" }}>
          <SectionHeader label="Playing style" />
          <div className="min-w-0 panel relative p-5">
            <Quote className="absolute right-4 top-4 size-8 text-line-strong" aria-hidden />
            <p className="max-w-2xl text-[15px] leading-relaxed text-text">{p.playStyle}</p>
            <p className="mt-3 text-xs text-text-faint">In your own words, from Settings.</p>
          </div>
        </div>
      )}

      {/* Development — what replaced the invented ratings */}
      <div className="rise-in mt-6 grid gap-4 lg:grid-cols-[1.2fr_1fr]" style={{ animationDelay: "160ms" }}>
        <div className="min-w-0">
          <SectionHeader
            label={`Working on · ${working.length}`}
            action={{ label: "Development", href: "/app/development" }}
          />
          <div className="min-w-0 panel p-5">
            {working.length ? (
              <div className="space-y-3.5">
                {working.map((g) => (
                  <div key={g.id}>
                    <div className="mb-1 flex items-center justify-between gap-3 text-sm">
                      <span className="min-w-0 truncate text-text-dim">{g.title}</span>
                      <span className="data-mono shrink-0 text-text">{g.progress}%</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-ink-800">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${g.progress}%`,
                          background: progressColor(g.progress),
                        }}
                      />
                    </div>
                  </div>
                ))}
                <p className="border-t border-line pt-3 text-xs leading-relaxed text-text-faint">
                  Progress is weighted by the evidence attached to each goal — clips, training,
                  study and coach notes. It moves when you do the work, not when you feel you have.
                </p>
              </div>
            ) : (
              <p className="text-sm leading-relaxed text-text-dim">
                No development goals yet.{" "}
                <Link href="/app/development" className="text-signal-bright hover:underline">
                  Set one
                </Link>{" "}
                and it appears here with the evidence behind it.
              </p>
            )}
          </div>
        </div>

        <div className="min-w-0 space-y-4">
          <div>
            <SectionHeader label="Strengths" />
            <div className="min-w-0 panel space-y-2 p-4">
              {p.strengths.length ? (
                p.strengths.map((s) => (
                  <div key={s} className="flex items-start gap-2 text-sm text-text">
                    <TrendingUp className="mt-0.5 size-4 shrink-0 text-positive" />
                    <span className="min-w-0">{s}</span>
                  </div>
                ))
              ) : (
                <p className="text-sm leading-relaxed text-text-dim">
                  You have not named any yet. These are yours to write, in Settings — MIDO does not
                  decide what your strengths are.
                </p>
              )}
            </div>
          </div>

          {achieved.length > 0 && (
            <div>
              <SectionHeader label={`Achieved · ${achieved.length}`} />
              <div className="min-w-0 panel space-y-2 p-4">
                {achieved.map((g) => (
                  <div key={g.id} className="flex items-start gap-2 text-sm text-text">
                    <Target className="mt-0.5 size-4 shrink-0 text-signal-bright" />
                    <span className="min-w-0">{g.title}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Detail */}
      <div className="rise-in mt-6 grid gap-4 md:grid-cols-2" style={{ animationDelay: "200ms" }}>
        <div className="min-w-0">
          <SectionHeader label="Player" />
          <Rows
            rows={[
              { label: "Full name", value: p.fullName },
              { label: "Age", value: ageFrom(p.dateOfBirth) },
              { label: "Nationality", value: p.nationality },
              { label: "Preferred foot", value: p.foot },
              { label: "Height", value: p.heightCm ? `${p.heightCm} cm` : "—" },
              { label: "Weight", value: p.weightKg ? `${p.weightKg} kg` : "—" },
            ]}
          />
        </div>
        <div className="min-w-0">
          <SectionHeader label="On the pitch" />
          <Rows
            rows={[
              { label: "Primary position", value: p.primaryPosition },
              { label: "Secondary", value: p.secondaryPosition },
              { label: "Squad number", value: p.squadNumber ? String(p.squadNumber) : "—" },
              { label: "Club", value: p.club },
              { label: "League", value: p.league },
              { label: "Level", value: p.level },
            ]}
          />
        </div>
      </div>

      {/* What is not here */}
      <div className="rise-in mt-6" style={{ animationDelay: "240ms" }}>
        <SectionHeader label="What is not here" />
        <div className="min-w-0 panel p-5">
          <div className="flex items-start gap-3">
            <Info className="mt-0.5 size-4 shrink-0 text-info" />
            <div className="min-w-0 space-y-2 text-sm leading-relaxed text-text-dim">
              <p>
                <span className="text-text-hi">No attribute ratings.</span> Nothing in MIDO scores
                your finishing or your pace out of 100, so nothing here pretends to. What you get
                instead is the work you are doing and the evidence behind it.
              </p>
              <p>
                <span className="text-text-hi">No career history.</span> MIDO holds the season you
                are in. Previous clubs and seasons are not tracked yet.
              </p>
            </div>
          </div>
        </div>
      </div>

      <Link
        href="/app/development"
        className="mt-6 inline-flex items-center gap-1.5 text-sm text-text-dim transition-colors hover:text-signal-bright"
      >
        Your development map <ArrowUpRight className="size-4" />
      </Link>
    </div>
  );
}
