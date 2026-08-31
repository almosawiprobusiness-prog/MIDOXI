/*
  PLAYER OS — The Locker.
  The player's command center: what to do today, the next match, readiness,
  the week, current development focus and the study thread.
*/
import Link from "next/link";
import {
  MapPin,
  Clock,
  ArrowUpRight,
  Star,
  Film,
  Flame,
  TrendingUp,
  Plus,
  CalendarOff,
  BookOpen,
} from "lucide-react";
import { getLockerData } from "@/lib/data/locker";
import { SectionHeader, categoryStyle, Meter } from "@/components/ui/primitives";
import { CheckIn } from "@/components/locker/check-in";
import { QuickEntry } from "@/components/locker/quick-entry";
import { Briefing } from "@/components/locker/briefing";
import { ProfilePromptCard } from "@/components/locker/profile-prompt";
import { getProfileSettings } from "@/lib/data/profile";
import { nextPrompt } from "@/lib/data/profiling";
import { NextBestAction } from "@/components/locker/next-best-action";
import { getNextActions } from "@/lib/intelligence/next-actions";
import { briefingLinesToSuppress } from "@/lib/intelligence/overlap";

const DAY_LETTERS = ["M", "T", "W", "T", "F", "S", "S"];

const kindColor: Record<string, string> = {
  match: "var(--signal)",
  team: "var(--info)",
  individual: "var(--signal-bright)",
  gym: "var(--text-dim)",
  tactical: "var(--review)",
  film: "#c58bff",
  recovery: "var(--positive)",
  conditioning: "var(--correction)",
};

export async function PlayerLocker() {
  const [data, profile, actions] = await Promise.all([
    getLockerData(),
    getProfileSettings(),
    getNextActions(),
  ]);
  /*
    Progressive profiling: one question, and only when the missing field is
    genuinely degrading something. Most established accounts see nothing here.
  */
  const prompt = nextPrompt(profile);
  const { nextMatch, recentMatch, focus, readiness, week, study } = data;
  const todayEvents = week.filter((e) => e.day === data.todayIndex);
  const maxRpe = Math.max(...readiness.rpe, 10);

  return (
    <div className="mx-auto max-w-[1440px] px-4 py-6 md:px-6 lg:py-8">
      {/* ── Cinematic hero ─────────────────────────────── */}
      <header className="mb-8">
        <div className="rise-in label-tech flex items-center gap-3" style={{ animationDelay: "0ms" }}>
          <span>Player</span>
          <span className="h-px w-6 bg-line-strong" />
          <span className="text-text">{data.displayName}</span>
          {data.player && (
            <span className="chip chip-signal ml-1">{data.player.primaryPosition}</span>
          )}
        </div>
        <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
          <h1
            className="rise-in font-display text-4xl font-bold uppercase tracking-tight text-text-hi md:text-5xl"
            style={{ animationDelay: "60ms" }}
          >
            The Locker
          </h1>
          <p className="rise-in max-w-md text-sm text-text-dim" style={{ animationDelay: "120ms" }}>
            {nextMatch ? (
              <>
                Next match in <span className="text-text-hi">{nextMatch.daysRemaining} days</span>.
                Focus the week on your active development.
              </>
            ) : (
              <>Welcome to your football system. Start by logging a match or setting a goal.</>
            )}
          </p>
        </div>
      </header>

      {/*
        Two rule engines, one slot, deliberately not merged.

        The recommendation panel goes first: it reads the whole record —
        matches, study, training, observations, what was dismissed — and
        commits to one thing. The briefing below is the rest of today's
        facts, minus anything the panel has already covered, so nobody is
        told to review the same match twice in two different voices.
      */}
      <section className="rise-in mb-6 space-y-3" style={{ animationDelay: "140ms" }}>
        <NextBestAction items={actions.items} informed={actions.informed} />
        <Briefing
          data={data}
          suppress={briefingLinesToSuppress(actions.items.map((a) => a.kind))}
        />
        <ProfilePromptCard prompt={prompt} />
      </section>

      {/* ── Row 1: Next match · Today · Readiness ───────── */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        {/* NEXT MATCH */}
        <section className="rise-in xl:col-span-5" style={{ animationDelay: "160ms" }}>
          <SectionHeader label="Next match" action={{ label: "Match center", href: "/app/matches" }} />
          {nextMatch ? (
            <div className="panel-raised relative overflow-hidden p-5">
              <div className="pitch-grid absolute inset-0 opacity-40" aria-hidden />
              <div className="relative">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="chip chip-signal mb-3">{nextMatch.md} · MATCHDAY</div>
                    <div className="label-tech">{nextMatch.competition}</div>
                    <h3 className="mt-1 font-display text-2xl font-bold text-text-hi">
                      {nextMatch.opponent}
                    </h3>
                    <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm text-text-dim">
                      <span className="flex items-center gap-1.5">
                        <MapPin className="size-4 text-text-faint" />
                        {nextMatch.home ? "Home" : "Away"}
                        {nextMatch.venue ? ` · ${nextMatch.venue}` : ""}
                      </span>
                      {nextMatch.kickoff && (
                        <span className="flex items-center gap-1.5">
                          <Clock className="size-4 text-text-faint" />
                          {nextMatch.kickoff}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="stat-figure text-5xl text-signal-bright">
                      {nextMatch.daysRemaining}
                    </div>
                    <div className="label-tech mt-1">Days out</div>
                  </div>
                </div>

                <div className="mt-5 flex items-center gap-3 border-t border-line pt-4">
                  {data.player && (
                    <div className="grid size-10 place-items-center rounded-md bg-gradient-to-br from-signal to-signal-deep font-display text-sm font-bold text-white">
                      {data.player.squadNumber}
                    </div>
                  )}
                  <div>
                    <div className="text-sm text-text-hi">
                      Expected role ·{" "}
                      <span className="text-signal-bright">{nextMatch.expectedPosition}</span>
                    </div>
                    <div className="label-tech">Prepare your role for this fixture</div>
                  </div>
                  <Link
                    href="/app/film-room"
                    className="ml-auto flex items-center gap-1.5 rounded-lg border border-line px-3 py-2 text-xs text-text transition-colors hover:border-signal-line hover:text-signal-bright"
                  >
                    <Film className="size-3.5" />
                    Prep film
                  </Link>
                </div>
              </div>
            </div>
          ) : (
            <EmptyCard
              icon={<CalendarOff className="size-5" />}
              title="No fixture scheduled"
              body="Add your next match to start preparing your week around it."
              cta={{ label: "Add match", href: "/app/matches" }}
            />
          )}
        </section>

        {/* TODAY */}
        <section className="rise-in xl:col-span-4" style={{ animationDelay: "200ms" }}>
          <SectionHeader label="Today" action={{ label: "Calendar", href: "/app/calendar" }} />
          <div className="panel flex h-[calc(100%-2rem)] flex-col p-4">
            {todayEvents.length > 0 ? (
              <div className="space-y-2.5">
                {todayEvents.map((e) => (
                  <div key={e.id} className="flex items-center gap-3">
                    <span
                      className="mt-0.5 size-2 shrink-0 rounded-full"
                      style={{ background: kindColor[e.kind] ?? "var(--text-dim)" }}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm text-text-hi">{e.label}</div>
                      <div className="label-tech">{e.kind}</div>
                    </div>
                    {e.time && <span className="data-mono text-xs text-text-dim">{e.time}</span>}
                  </div>
                ))}
              </div>
            ) : (
              <p className="py-4 text-sm text-text-dim">
                Nothing scheduled today. Add a session from the calendar.
              </p>
            )}

            {study && (
              <Link
                href="/app/film-room"
                className="group mt-4 block rounded-lg border border-line bg-ink-850 p-3 transition-colors hover:border-signal-line"
              >
                <div className="flex items-center gap-2">
                  <BookOpen className="size-3.5 text-signal-bright" />
                  <span className="label-tech !text-signal-bright">Study assignment</span>
                  <ArrowUpRight className="ml-auto size-3.5 text-text-faint transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                </div>
                <div className="mt-1.5 text-sm text-text-hi">{study.title}</div>
                <div className="mt-1 text-xs text-text-dim">{study.detail}</div>
                <div className="mt-2 flex gap-2">
                  <span className="chip">{study.duration}</span>
                  <span className="chip">{study.clips} clips</span>
                </div>
              </Link>
            )}
          </div>
        </section>

        {/* READINESS */}
        <section className="rise-in xl:col-span-3" style={{ animationDelay: "240ms" }}>
          <SectionHeader label="Readiness" />
          <div className="panel flex h-[calc(100%-2rem)] flex-col p-4">
            {readiness.latest ? (
              <div className="space-y-3">
                {[
                  { label: "Energy", value: readiness.latest.energy },
                  { label: "Sleep", value: readiness.latest.sleep },
                  { label: "Soreness", value: readiness.latest.soreness },
                  { label: "Mental", value: readiness.latest.mental },
                ].map((r) => (
                  <div key={r.label}>
                    <div className="mb-1 flex justify-between text-xs">
                      <span className="text-text-dim">{r.label}</span>
                      <span className="data-mono text-text">{r.value}/5</span>
                    </div>
                    <Meter value={r.value} />
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-text-dim">
                No check-in yet. Log how you feel below — it takes 15 seconds.
              </p>
            )}

            {readiness.rpe.length > 0 && (
              <div className="mt-4 border-t border-line pt-3">
                <div className="mb-1.5 flex items-center justify-between">
                  <span className="label-tech">RPE · last 7</span>
                  <TrendingUp className="size-3.5 text-text-faint" />
                </div>
                <div className="flex h-10 items-end gap-1">
                  {readiness.rpe.map((v, i) => (
                    <div
                      key={i}
                      className="flex-1 rounded-sm bg-signal/70"
                      style={{ height: `${Math.max((v / maxRpe) * 100, 6)}%` }}
                      title={`RPE ${v || "—"}`}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>
      </div>

      {/* ── Row 2: Current focus · Recent match ─────────── */}
      <div className="mt-8 grid grid-cols-1 gap-4 xl:grid-cols-12">
        <section className="rise-in xl:col-span-7" style={{ animationDelay: "280ms" }}>
          <SectionHeader label="Current focus" action={{ label: "Development", href: "/app/development" }} />
          {focus.length > 0 ? (
            <div className="grid gap-3 sm:grid-cols-3">
              {focus.map((f) => {
                const c = categoryStyle[f.category];
                return (
                  <Link
                    key={f.id}
                    href={f.goalId ? `/app/development/${f.goalId}` : "/app/development"}
                    className="group panel flex flex-col p-4 transition-colors hover:border-line-strong"
                  >
                    <div className="flex items-center gap-2">
                      <span className="size-1.5 rounded-full" style={{ background: c.color }} />
                      <span className="label-tech" style={{ color: c.color }}>{c.label}</span>
                    </div>
                    <h3 className="mt-2 font-display text-base font-semibold text-text-hi">{f.title}</h3>
                    <p className="mt-1.5 flex-1 text-xs leading-relaxed text-text-dim">{f.detail}</p>
                    <div className="mt-3 flex items-center gap-1 text-[11px] text-text-faint transition-colors group-hover:text-text-dim">
                      Open loop
                      <ArrowUpRight className="size-3 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                    </div>
                  </Link>
                );
              })}
            </div>
          ) : (
            <EmptyCard
              icon={<Plus className="size-5" />}
              title="No active development goals"
              body="Set what you're working on — finishing, pressing, movement — and MIDO connects your film and training to it."
              cta={{ label: "Create a goal", href: "/app/development" }}
            />
          )}
        </section>

        {/* RECENT MATCH */}
        <section className="rise-in xl:col-span-5" style={{ animationDelay: "320ms" }}>
          <SectionHeader label="Recent match" action={{ label: "Full review", href: "/app/matches" }} />
          {recentMatch ? (
            <div className="panel p-5">
              <div className="flex items-start justify-between">
                <div>
                  <div className="label-tech">{recentMatch.competition}</div>
                  <h3 className="mt-1 font-display text-xl font-bold text-text-hi">
                    {recentMatch.home ? "vs" : "@"} {recentMatch.opponent}
                  </h3>
                  <div className="mt-1 flex items-center gap-2 text-sm">
                    <span className="data-mono text-text-hi">
                      {recentMatch.goalsFor}–{recentMatch.goalsAgainst}
                    </span>
                    {recentMatch.goalsFor > recentMatch.goalsAgainst && (
                      <span
                        className="chip !text-positive"
                        style={{ borderColor: "var(--positive-wash)", background: "var(--positive-wash)" }}
                      >
                        Win
                      </span>
                    )}
                  </div>
                </div>
                {recentMatch.rating > 0 && (
                  <div className="flex items-center gap-1.5 rounded-lg border border-line bg-ink-850 px-3 py-2">
                    <Star className="size-4 text-review" fill="var(--review)" />
                    <span className="stat-figure text-xl">{recentMatch.rating}</span>
                  </div>
                )}
              </div>

              {recentMatch.stats.length > 0 && (
                <div className="mt-4 grid grid-cols-2 gap-2 border-t border-line pt-4 sm:grid-cols-4">
                  {recentMatch.stats.slice(0, 4).map((s) => (
                    <div key={s.label}>
                      <div className="stat-figure text-2xl">{s.value}</div>
                      <div className="label-tech mt-1 truncate">{s.label}</div>
                    </div>
                  ))}
                </div>
              )}

              <div className="mt-4 flex items-center gap-2">
                <Link
                  href="/app/film-room"
                  className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-line bg-ink-850 py-2.5 text-sm text-text transition-colors hover:border-signal-line hover:text-signal-bright"
                >
                  <Film className="size-4" />
                  Key clips
                </Link>
                <Link
                  href="/app/matches"
                  className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-signal/10 py-2.5 text-sm text-signal-bright transition-colors hover:bg-signal/20"
                >
                  <Flame className="size-4" />
                  Self review
                </Link>
              </div>
            </div>
          ) : (
            <EmptyCard
              icon={<Plus className="size-5" />}
              title="No matches logged yet"
              body="Log your first match to start building your football record — stats, review and clips."
              cta={{ label: "Add match", href: "/app/matches" }}
            />
          )}
        </section>
      </div>

      {/* ── Row 3: Week · Quick entry ───────────────────── */}
      <div className="mt-8 grid grid-cols-1 gap-4 xl:grid-cols-12">
        <section className="rise-in xl:col-span-8" style={{ animationDelay: "360ms" }}>
          <SectionHeader label="Week at a glance" action={{ label: "Calendar", href: "/app/calendar" }} />
          <div className="panel grid grid-cols-1 sm:grid-cols-7 gap-px overflow-hidden bg-line">
            {DAY_LETTERS.map((letter, day) => {
              const events = week.filter((e) => e.day === day);
              const isToday = day === data.todayIndex;
              const md = events.find((e) => e.md)?.md;
              const isMatch = events.some((e) => e.kind === "match");
              return (
                <div
                  key={day}
                  className={`min-h-[132px] bg-ink-900 p-2.5 ${isToday ? "bg-signal/5" : ""} ${
                    isMatch ? "bg-ink-850" : ""
                  }`}
                >
                  <div className="mb-2 flex items-center justify-between">
                    <span
                      className={`font-display text-sm font-semibold ${
                        isToday ? "text-signal-bright" : "text-text-dim"
                      }`}
                    >
                      {letter}
                    </span>
                    {md && (
                      <span className={`md-tag ${isMatch ? "text-signal-bright" : "text-text-faint"}`}>
                        {md}
                      </span>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    {events.map((e) => (
                      <div key={e.id} className="flex items-start gap-1.5" title={e.label}>
                        <span
                          className="mt-1 size-1.5 shrink-0 rounded-full"
                          style={{ background: kindColor[e.kind] ?? "var(--text-dim)" }}
                        />
                        <span className="line-clamp-2 text-[11px] leading-tight text-text-dim">
                          {e.label}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="rise-in xl:col-span-4" style={{ animationDelay: "400ms" }}>
          <SectionHeader label="Quick entry" />
          <div className="space-y-2">
            <QuickEntry />
            <CheckIn done={data.checkedInToday} />
          </div>
        </section>
      </div>

      {/* Footer note */}
      {data.isSeed && (
        <div className="mt-10 flex items-center justify-center gap-2 text-[11px] text-text-faint">
          <span className="size-1.5 rounded-full bg-review" />
          Demo locker — seeded football data for {data.displayName}. Nothing here is saved yet.
        </div>
      )}
    </div>
  );
}

function EmptyCard({
  icon,
  title,
  body,
  cta,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  cta: { label: string; href: string };
}) {
  return (
    <div className="panel flex flex-col items-start p-5">
      <span className="grid size-10 place-items-center rounded-lg border border-line bg-ink-850 text-signal-bright">
        {icon}
      </span>
      <h3 className="mt-3 font-display text-base font-semibold text-text-hi">{title}</h3>
      <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-text-dim">{body}</p>
      <Link
        href={cta.href}
        className="mt-4 inline-flex items-center gap-2 rounded-lg bg-signal/10 px-3.5 py-2 text-sm font-medium text-signal-bright transition-colors hover:bg-signal/20"
      >
        <Plus className="size-4" />
        {cta.label}
      </Link>
    </div>
  );
}
