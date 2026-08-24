import { CalendarDays } from "lucide-react";
import { listEvents } from "@/lib/data/calendar";
import { listMeetings } from "@/lib/data/meetings";
import { isDemoMode } from "@/lib/env";
import { CalendarWeek } from "@/components/calendar/calendar-week";

export const metadata = { title: "Calendar — MIDO XI" };

export default async function CalendarPage() {
  /*
    Meetings belong here, not only on their own page.

    These shipped as two disconnected destinations: a film session booked
    with a coach appeared under Meetings and nowhere on the calendar, so
    knowing what was happening on Thursday meant checking two places and
    remembering that you had to. One of them was always going to be
    wrong.

    `scope: "all"` because the calendar walks backwards as well as
    forwards — an upcoming-only read would empty every past week.
  */
  const [events, meetings] = await Promise.all([
    listEvents(),
    listMeetings({ scope: "all", limit: 200 }),
  ]);

  return (
    <div className="mx-auto max-w-[1200px] px-4 py-8 md:px-6">
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <span className="grid size-11 place-items-center rounded-lg border border-line bg-ink-850 text-signal-bright">
          <CalendarDays className="size-5" />
        </span>
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-text-hi">Calendar</h1>
          <p className="text-sm text-text-dim">Your week around the matchday cycle.</p>
        </div>
      </div>

      <CalendarWeek events={events} meetings={meetings} />

      {isDemoMode && (
        <p className="mt-6 flex items-center justify-center gap-2 text-[11px] text-text-faint">
          <span className="size-1.5 rounded-full bg-review" /> Demo mode — changes persist for this session only.
        </p>
      )}
    </div>
  );
}
