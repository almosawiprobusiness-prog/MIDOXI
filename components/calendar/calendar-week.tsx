"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Plus, CalendarDays } from "lucide-react";
import { EventFormDialog } from "./event-form-dialog";
import { calendarMeta, type CalendarEvent } from "@/lib/data/calendar-types";

const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function pad(n: number) {
  return String(n).padStart(2, "0");
}
function dateKey(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
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

export function CalendarWeek({ events }: { events: CalendarEvent[] }) {
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
    const map = new Map<string, CalendarEvent[]>();
    for (const e of events) {
      const key = e.startsAt.slice(0, 10);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(e);
    }
    for (const list of map.values()) list.sort((a, b) => a.startsAt.localeCompare(b.startsAt));
    return map;
  }, [events]);

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
          const dayEvents = byDay.get(key) ?? [];
          const isToday = key === todayKey;
          const md = dayEvents.find((e) => e.mdTag)?.mdTag;
          const isMatch = dayEvents.some((e) => e.kind === "match");
          return (
            <div key={key} className={`group flex min-h-[150px] flex-col bg-ink-900 p-2.5 ${isToday ? "bg-signal/5" : ""} ${isMatch ? "bg-ink-850" : ""}`}>
              <div className="mb-2 flex items-center justify-between">
                <div className="flex items-baseline gap-1.5">
                  <span className={`font-display text-sm font-semibold ${isToday ? "text-signal-bright" : "text-text-dim"}`}>{DAY_NAMES[i]}</span>
                  <span className="data-mono text-[11px] text-text-faint">{d.getDate()}</span>
                </div>
                {md && <span className={`md-tag ${isMatch ? "text-signal-bright" : "text-text-faint"}`}>{md}</span>}
              </div>

              <div className="flex-1 space-y-1.5">
                {dayEvents.map((e) => {
                  const meta = calendarMeta(e.kind);
                  return (
                    <button
                      key={e.id}
                      onClick={() => setDialog({ open: true, mode: "edit", event: e })}
                      className="block w-full rounded-md border border-line bg-ink-850 px-2 py-1.5 text-left transition-colors hover:border-line-strong"
                    >
                      <div className="flex items-center gap-1.5">
                        <span className="size-1.5 shrink-0 rounded-full" style={{ background: meta.color }} />
                        <span className="data-mono text-[10px] text-text-faint">{e.startsAt.slice(11, 16)}</span>
                      </div>
                      <span className="mt-0.5 line-clamp-2 block text-[11px] leading-tight text-text">{e.title}</span>
                    </button>
                  );
                })}
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

      {events.length === 0 && (
        <div className="mt-4 flex flex-col items-center gap-2 py-8 text-center">
          <CalendarDays className="size-6 text-text-faint" />
          <p className="text-sm text-text-dim">No events yet. Add training, a match, recovery or study to build your week.</p>
        </div>
      )}
    </div>
  );
}
