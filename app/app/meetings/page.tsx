import Link from "next/link";
import { CalendarClock, Plus } from "lucide-react";
import { bookableWith, listMeetings } from "@/lib/data/meetings";
import { MeetingRow } from "@/components/meetings/meeting-row";
import { ScheduleDialog } from "@/components/meetings/schedule-dialog";

export const metadata = { title: "Sessions — MIDO XI" };

/*
  Time with the people you actually work with.

  Upcoming first and past below it, rather than two tabs: the list is
  short by nature — nobody has forty sessions booked — and a tab you
  have to click to discover last week's film session is a tab that
  hides the thing most worth reading before this week's.
*/

export default async function MeetingsPage({ searchParams }: PageProps<"/app/meetings">) {
  const { tab } = await searchParams;
  const showPast = tab === "past";

  const [upcoming, past, people] = await Promise.all([
    listMeetings({ scope: "upcoming" }),
    listMeetings({ scope: "past", limit: 20 }),
    bookableWith(),
  ]);

  const rows = showPast ? past : upcoming;

  return (
    <div className="mx-auto max-w-[860px] px-4 py-8">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-text-hi">Sessions</h1>
          <p className="mt-1 text-sm text-text-dim">
            Film sessions, check-ins and calls with your coach or your players.
          </p>
        </div>
        <ScheduleDialog people={people} />
      </header>

      <div className="mb-4 flex gap-1 border-b border-line">
        <Tab href="/app/meetings" active={!showPast} label="Upcoming" count={upcoming.length} />
        <Tab href="/app/meetings?tab=past" active={showPast} label="Past" count={past.length} />
      </div>

      {rows.length === 0 ? (
        <Empty showPast={showPast} hasPeople={people.length > 0} />
      ) : (
        <ul className="space-y-2">
          {rows.map((m) => (
            <li key={m.id}>
              <MeetingRow meeting={m} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Tab({ href, active, label, count }: { href: string; active: boolean; label: string; count: number }) {
  return (
    <Link
      href={href}
      className={
        active
          ? "-mb-px border-b-2 border-signal px-3 py-2 text-sm font-medium text-signal-bright"
          : "-mb-px border-b-2 border-transparent px-3 py-2 text-sm text-text-dim transition-colors hover:text-text"
      }
    >
      {label}
      {count > 0 && <span className="ml-1.5 data-mono text-[10px] text-text-faint">{count}</span>}
    </Link>
  );
}

/*
  The empty state distinguishes "nothing booked" from "nobody to book
  with", because they need completely different things from the reader
  and a single "No sessions yet" tells them neither.
*/
function Empty({ showPast, hasPeople }: { showPast: boolean; hasPeople: boolean }) {
  return (
    <div className="panel px-6 py-12 text-center">
      <span className="mx-auto grid size-11 place-items-center rounded-lg border border-line bg-ink-850 text-text-faint">
        {hasPeople ? <CalendarClock className="size-5" /> : <Plus className="size-5" />}
      </span>
      {showPast ? (
        <p className="mt-3 text-sm text-text-dim">Nothing has happened yet.</p>
      ) : hasPeople ? (
        <>
          <p className="mt-3 text-sm text-text">Nothing booked.</p>
          <p className="mt-1 text-sm text-text-dim">
            Book a film session and put the clips on the agenda before you meet.
          </p>
        </>
      ) : (
        <>
          <p className="mt-3 text-sm text-text">You are not connected to anybody yet.</p>
          <p className="mt-1 text-sm text-text-dim">
            Sessions are with your coach, your trainer or your players — so a connection comes first.
          </p>
          <Link
            href="/app/connections"
            className="mt-4 inline-flex h-9 items-center rounded-lg border border-signal-line bg-signal/10 px-4 text-sm font-medium text-signal-bright transition-colors hover:bg-signal/20"
          >
            Connections
          </Link>
        </>
      )}
    </div>
  );
}
