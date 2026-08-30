"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Plus, CalendarDays, Users } from "lucide-react";
import { EventFormDialog } from "./event-form-dialog";
import { calendarMeta, type CalendarEvent } from "@/lib/data/calendar-types";
import type { Meeting } from "@/lib/data/meeting-types";

/*
  A day holds two different kinds of thing, and the difference matters.

  A calendar event is yours: you wrote it, you can edit it here, clicking
  it opens the edit dialog. A meeting belongs to two people — it cannot
  be edited from a calendar cell without deciding what that does to the
  other person, so it links out to where accepting, declining and
  proposing a new time actually live.

  They sort together by start time, because a day is a day. Rendering
  them as two separate stacks would recreate exactly the split this
  merge exists to remove.
*/
type DayItem =
  | { at: string; kind: "event"; event: CalendarEvent }
  | { at: string; kind: "meeting"; meeting: Meeting };

const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function pad(n: number) {
  return String(n).padStart(2, "0");
}
function dateKey(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
/*
  A true instant, expressed as the reader's own wall clock.

  Calendar events are already naive wall-clock — typed into a
  `datetime-local` and stored as given — so they slice correctly as-is.
  Meetings are real instants, and slicing their ISO string would print
  UTC. Converting here is what lets both sit in one sorted list showing
  the times each person actually meant.
*/
function localStamp(d: Date) {
  return `${dateKey(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function mondayOf(offsetWeeks: number) {
  const now = new Date();
  const m = new Date(now);
  m.setHours(0, 0, 0, 0);
  m.setDate(m.getDate() - ((now.getDay() + 6) % 7) + offsetWeeks * 7);
  return m;
}

type DialogState =
  | { open: false }
  | { open: true; mode: "create"; presetDate?: string }
  | { open: true; mode: "edit"; event: CalendarEvent };

export function CalendarWeek({
  events,
  meetings = [],
}: {
  events: CalendarEvent[];
  meetings?: Meeting[];
}) {
  const [offset, setOffset] = useState(0);
  const [dialog, setDialog] = useState<DialogState>({ open: false });

  const monday = useMemo(() => mondayOf(offset), [offset]);
  const days = useMemo(
    () => Array.from({ length: 7 }, (_, i) => {
      const d = new Date(monday);
      d.setDate(d.getDate() + i);
      return d;
    }),
    [monday]
  );

  const todayKey = dateKey(new Date());
  const byDay = useMemo(() => {
    const map = new Map<string, DayItem[]>();
    const push = (item: DayItem) => {
      const key = item.at.slice(0, 10);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(item);
    };

    for (const event of events) push({ at: event.startsAt, kind: "event", event });

    for (const meeting of meetings) {
      /*
        Cancelled and declined meetings are not on anybody's day. They
        stay readable in the Meetings list, where the distinction between
        "called off" and "never happened" is the point — a calendar is
        for what is actually going to occur.
      */
      if (meeting.status === "cancelled" || meeting.status === "declined") continue;
      /*
        Meetings are stored as instants and rendered in the reader's own
        zone, so the day a meeting falls on has to be derived locally.
        Slicing the ISO string instead would file a 9pm meeting under
        tomorrow for anyone west of UTC.
      */
      push({ at: localStamp(new Date(meeting.startsAt)), kind: "meeting", meeting });
    }

    for (const list of map.values()) list.sort((a, b) => a.at.localeCompare(b.at));
    return map;
  }, [events, meetings]);

  const rangeLabel = `${monday.toLocaleDateString("en-GB", { day: "numeric", month: "short" })} – ${days[6].toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`;

  return (
    <div>
      {/* Controls */}
      <div className="mb-4 flex items-center gap-3">
        <div className="flex items-center gap-1">
          <button onClick={() => setOffset((o) => o - 1)} aria-label="Previous week" className="flex size-9 items-center justify-center rounded-lg border border-line text-text-dim transition-colors hover:border-signal-line hover:text-text-hi"><ChevronLeft className="size-4" /></button>
          <button onClick={() => setOffset((o) => o + 1)} aria-label="Next week" className="flex size-9 items-center justify-center rounded-lg border border-line text-text-dim transition-colors hover:border-signal-line hover:text-text-hi"><ChevronRight className="size-4" /></button>
        </div>
        <div>
          <div className="font-display text-lg font-semibold text-text-hi">{rangeLabel}</div>
          {offset !== 0 && (
            <button onClick={() => setOffset(0)} className="label-tech !text-signal-bright hover:underline">Back to this week</button>
          )}
        </div>
        <button
          onClick={() => setDialog({ open: true, mode: "create", presetDate: `${dateKey(days[0])}T10:00` })}
          className="ml-auto flex h-9 items-center gap-2 rounded-lg bg-signal px-3.5 text-sm font-medium text-white transition-colors hover:bg-signal-deep"
        >
          <Plus className="size-4" /> Add event
        </button>
      </div>

      {/* Week grid */}
      <div className="grid grid-cols-1 gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-7">
        {days.map((d, i) => {
          const key = dateKey(d);
          const dayItems = byDay.get(key) ?? [];
          const isToday = key === todayKey;
          const tagged = dayItems.find((i) => i.kind === "event" && i.event.mdTag);
          const mdTag = tagged?.kind === "event" ? tagged.event.mdTag : undefined;
          const isMatch = dayItems.some((i) => i.kind === "event" && i.event.kind === "match");
          return (
            <div key={key} className={`group flex min-h-[150px] flex-col p-2.5 ${isToday ? "relative overflow-hidden rounded-xl border border-signal-line bg-gradient-to-b from-signal/10 via-ink-900 to-ink-900" : isMatch ? "bg-ink-850" : "bg-ink-900"}`}>
              {isToday && <div className="label-tech mb-1 !text-signal-bright">Today / 01</div>}
              <div className="mb-2 flex items-center justify-between">
                <div className="flex items-baseline gap-1.5">
                  <span className={`font-display text-sm ${isToday ? "font-bold uppercase tracking-tight text-signal-bright" : "font-semibold text-text-dim"}`}>{DAY_NAMES[i]}</span>
                  <span className="data-mono text-[11px] text-text-faint">{d.getDate()}</span>
                </div>
                {mdTag && <span className={`md-tag ${isMatch ? "text-signal-bright" : "text-text-faint"}`}>{mdTag}</span>}
              </div>

              <div className="flex-1 space-y-1.5">
                {dayItems.map((item) =>
                  item.kind === "event" ? (
                    <button
                      key={`e-${item.event.id}`}
                      onClick={() => setDialog({ open: true, mode: "edit", event: item.event })}
                      className="block w-full rounded-md border border-line bg-ink-850 px-2 py-1.5 text-left transition-colors hover:border-line-strong"
                    >
                      <div className="flex items-center gap-1.5">
                        <span
                          className="size-1.5 shrink-0 rounded-full"
                          style={{ background: calendarMeta(item.event.kind).color }}
                        />
                        <span className="data-mono text-[10px] text-text-faint">{item.at.slice(11, 16)}</span>
                      </div>
                      <span className="mt-0.5 line-clamp-2 block text-[11px] leading-tight text-text">
                        {item.event.title}
                      </span>
                    </button>
                  ) : (
                    /*
                      Two people, so it leaves the calendar rather than
                      opening an editor. The border carries the signal
                      colour and the other person's name is shown — at a
                      glance this is visibly not a note you wrote to
                      yourself.
                    */
                    <Link
                      key={`m-${item.meeting.id}`}
                      href={`/app/meetings/${item.meeting.id}`}
                      className="block w-full rounded-md border border-signal-line bg-signal/10 px-2 py-1.5 text-left transition-colors hover:bg-signal/20"
                    >
                      <div className="flex items-center gap-1.5">
                        <Users className="size-2.5 shrink-0 text-signal-bright" />
                        <span className="data-mono text-[10px] text-text-faint">{item.at.slice(11, 16)}</span>
                        {item.meeting.status === "proposed" && (
                          <span className="data-mono text-[9px] uppercase tracking-wide text-review">
                            {item.meeting.organiser ? "sent" : "reply"}
                          </span>
                        )}
                      </div>
                      <span className="mt-0.5 line-clamp-2 block text-[11px] leading-tight text-text-hi">
                        {item.meeting.title}
                      </span>
                      <span className="mt-0.5 block truncate text-[10px] text-text-dim">
                        {item.meeting.withPerson.name}
                      </span>
                    </Link>
                  ),
                )}
              </div>

              <button
                onClick={() => setDialog({ open: true, mode: "create", presetDate: `${key}T10:00` })}
                aria-label={`Add event on ${DAY_NAMES[i]}`}
                className="mt-1.5 flex items-center justify-center gap-1 rounded-md border border-dashed border-line py-1 text-[11px] text-text-faint opacity-0 transition-opacity hover:text-text-dim group-hover:opacity-100"
              >
                <Plus className="size-3" /> Add
              </button>
            </div>
          );
        })}
      </div>

      {dialog.open && dialog.mode === "edit" ? (
        <EventFormDialog open onClose={() => setDialog({ open: false })} mode="edit" event={dialog.event} />
      ) : (
        <EventFormDialog
          open={dialog.open}
          onClose={() => setDialog({ open: false })}
          mode="create"
          presetDate={dialog.open ? dialog.presetDate : undefined}
        />
      )}

      {events.length === 0 && meetings.length === 0 && (
        <div className="mt-4 flex flex-col items-center gap-2 py-8 text-center">
          <CalendarDays className="size-6 text-text-faint" />
          <p className="text-sm text-text-dim">Nothing yet. Add training, a match, recovery or study to build your week.</p>
        </div>
      )}
    </div>
  );
}
