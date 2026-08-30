import { Swords, Clock, Plus, CalendarDays } from "lucide-react";
import { listMatches } from "@/lib/data/matches";
import { daysBetween } from "@/lib/intelligence/signals";
import { listEvents } from "@/lib/data/calendar";
import { isDemoMode } from "@/lib/env";
import type { Match } from "@/lib/types";
import type { CalendarEvent } from "@/lib/data/calendar-types";
import { SectionHeader } from "@/components/ui/primitives";
import { PageHeader, StatBand, FormPips } from "@/components/ui/kit";
import { MatchFormDialog } from "@/components/matches/match-form-dialog";
import { MatchList } from "@/components/matches/match-list";
import { VoiceLog } from "@/components/matches/voice-log";

export const metadata = { title: "Matches — MIDO XI" };

function outcome(m: Match): "W" | "D" | "L" {
  return m.goalsFor > m.goalsAgainst ? "W" : m.goalsFor === m.goalsAgainst ? "D" : "L";
}

/*
  Reading the clock inside a render is impure, so the next-fixture pick lives
  here instead. Same reason the topbar's date label is computed outside its
  component.
*/
function nextFixtureFrom(events: CalendarEvent[]): { event: CalendarEvent; daysOut: number } | null {
  const now = new Date();
  /*
    daysBetween — the same calendar-day counting the scorer and the
    Locker use — rather than a ceil of elapsed hours. Ceil called
    matchday morning "1 day out" (seven hours to kick-off rounds up),
    and disagreed with every other surface by one for part of each day.
    Matchday itself still counts as upcoming: a fixture stops being
    "next" when the calendar day has passed, not at kick-off.
  */
  const event = events
    .filter((e) => e.kind === "match" && daysBetween(e.startsAt, now) <= 0)
    .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime())[0];
  if (!event) return null;
  return { event, daysOut: Math.max(0, -daysBetween(event.startsAt, now)) };
}

export default async function MatchesPage() {
  const [matches, events] = await Promise.all([listMatches(), listEvents()]);

  /*
    The next fixture used to be a hardcoded seed object rendered unconditionally
    — so a real account with no upcoming game saw a fictional one, kick-off time
    and all. It comes from the user's own calendar now, and when there is no
    match in the calendar there is no card.
  */
  const next = nextFixtureFrom(events);

  const totals = matches.reduce(
    (a, m) => ({
      minutes: a.minutes + (m.minutes || 0),
      goals: a.goals + (m.goals || 0),
      assists: a.assists + (m.assists || 0),
    }),
    { minutes: 0, goals: 0, assists: 0 },
  );
  const record = matches.reduce(
    (a, m) => { a[outcome(m)]++; return a; },
    { W: 0, D: 0, L: 0 } as Record<"W" | "D" | "L", number>,
  );
  const form = matches.slice(0, 5).map(outcome).reverse();
  const avgRating = matches.length
    ? (matches.filter((m) => m.rating > 0).reduce((a, m) => a + m.rating, 0) / Math.max(1, matches.filter((m) => m.rating > 0).length)).toFixed(1)
    : "–";

  return (
    <div className="mx-auto max-w-[1100px] px-4 py-8 md:px-6">
      <PageHeader
        icon={Swords}
        title="Match Center"
        tagline="Your match record — stats, review and clips."
        actions={<MatchFormDialog mode="create" />}
        photo="floodlights"
        kicker="Every match, on the record"
      />

      {/*
        Above the record, not buried in the form. Logging a match is the point
        at which this product usually loses people — it asks for thirteen
        fields at the worst possible moment, on a phone, straight after
        playing. Talking for ninety seconds is a different proposition, so it
        is the first thing on the page.
      */}
      <VoiceLog />

      {matches.length > 0 ? (
        <>
          {/* Next fixture — from the calendar, or not at all */}
          {next && (
            <section className="mb-6">
              <SectionHeader label="Next fixture" action={{ label: "Calendar", href: "/app/calendar" }} />
              <div className="relative min-w-0 overflow-hidden rounded-xl border border-signal-line bg-gradient-to-b from-signal/10 via-ink-900 to-ink-900 p-5">
                <div className="pitch-grid absolute inset-0 opacity-40" aria-hidden />
                <div className="label-tech !text-signal-bright relative mb-3">Next match / 01</div>
                <div className="relative flex flex-wrap items-center justify-between gap-4">
                  <div className="min-w-0">
                    {next.event.mdTag && (
                      <div className="chip chip-signal mb-2">{next.event.mdTag} · MATCHDAY</div>
                    )}
                    <h3 className="font-display text-2xl font-bold uppercase tracking-tight text-text-hi">
                      {next.event.title}
                    </h3>
                    <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1.5 text-sm text-text-dim">
                      <span className="flex items-center gap-1.5">
                        <CalendarDays className="size-4 text-text-faint" />
                        {new Date(next.event.startsAt).toLocaleDateString("en-GB", {
                          weekday: "short",
                          day: "numeric",
                          month: "short",
                        })}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <Clock className="size-4 text-text-faint" />
                        {new Date(next.event.startsAt).toLocaleTimeString("en-GB", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                  </div>
                  <div className="shrink-0 text-center">
                    <div className="stat-figure text-4xl text-signal-bright">{next.daysOut}</div>
                    <div className="label-tech mt-0.5">{next.daysOut === 1 ? "day out" : "days out"}</div>
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* Record + form */}
          <section className="mb-6">
            <SectionHeader label="Season record" />
            <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
              <StatBand
                cols={4}
                stats={[
                  { label: "Played", value: matches.length },
                  { label: "Minutes", value: totals.minutes },
                  { label: "Goals", value: totals.goals },
                  { label: "Assists", value: totals.assists },
                ]}
              />
              <div className="panel flex items-center gap-5 px-5 py-3">
                <div>
                  <div className="label-tech mb-1.5">Record</div>
                  <div className="flex items-baseline gap-2 font-display text-lg font-bold">
                    <span className="text-positive">{record.W}</span>
                    <span className="text-text-faint">–</span>
                    <span className="text-review">{record.D}</span>
                    <span className="text-text-faint">–</span>
                    <span className="text-correction">{record.L}</span>
                  </div>
                </div>
                <div className="h-8 w-px bg-line" />
                <div>
                  <div className="label-tech mb-1.5">Form</div>
                  <FormPips results={form} />
                </div>
                <div className="hidden h-8 w-px bg-line sm:block" />
                <div className="hidden sm:block">
                  <div className="label-tech mb-1.5">Avg rating</div>
                  <div className="stat-figure text-lg">{avgRating}</div>
                </div>
              </div>
            </div>
          </section>

          {/* Results */}
          <section>
            <SectionHeader label={`Results · ${matches.length}`} />
            <MatchList matches={matches} />
          </section>
        </>
      ) : (
        <div className="panel flex flex-col items-center justify-center px-6 py-16 text-center">
          <span className="grid size-12 place-items-center rounded-xl border border-line bg-ink-850 text-signal-bright">
            <Plus className="size-6" />
          </span>
          <h3 className="mt-4 font-display text-lg font-semibold text-text-hi">No matches yet</h3>
          <p className="mt-1.5 max-w-sm text-sm text-text-dim">
            Log your first match to start building your football record — stats, review and clips all connect from here.
          </p>
          <div className="mt-5"><MatchFormDialog mode="create" /></div>
        </div>
      )}

      {isDemoMode && matches.length > 0 && (
        <p className="mt-6 flex items-center justify-center gap-2 text-[11px] text-text-faint">
          <span className="size-1.5 rounded-full bg-review" /> Demo mode — a seeded record. Changes
          persist for this session only.
        </p>
      )}
    </div>
  );
}
