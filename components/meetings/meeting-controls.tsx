"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarClock, Check, Loader2, X } from "lucide-react";
import {
  cancelMeeting,
  proposeTime,
  respondToMeeting,
  respondToProposal,
} from "@/app/app/meetings/actions";
import {
  DURATIONS,
  formatWhen,
  minutesBetween,
  rangeIssue,
  type MeetingDetail,
} from "@/lib/data/meeting-types";

/*
  Answering, moving and calling off.

  The asymmetry is deliberate and is the whole point of the feature: the
  person who proposed something is never shown a button to accept it.
  Whoever is waiting sees "waiting"; whoever owes an answer sees the
  answer buttons. Rendering both to both is how a meeting ends up agreed
  by one person.
*/

function localValue(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function MeetingControls({ meeting: m }: { meeting: MeetingDetail }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [moving, setMoving] = useState(false);
  const [start, setStart] = useState(() => localValue(new Date(m.startsAt)));
  const [minutes, setMinutes] = useState(() => minutesBetween(m.startsAt, m.endsAt));
  const [note, setNote] = useState("");

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) =>
    startTransition(async () => {
      setError(null);
      const res = await fn();
      if (!res.ok && res.error) setError(res.error);
      else router.refresh();
    });

  const over = m.status === "cancelled" || m.status === "declined" || m.status === "done";
  const p = m.openProposal;

  const sendProposal = () => {
    const startIso = new Date(start).toISOString();
    const endIso = new Date(Date.parse(startIso) + minutes * 60_000).toISOString();
    const bad = rangeIssue(startIso, endIso);
    if (bad) {
      setError(bad);
      return;
    }
    run(async () => {
      const res = await proposeTime(m.id, startIso, endIso, note || null);
      if (res.ok) {
        setMoving(false);
        setNote("");
      }
      return res;
    });
  };

  return (
    <div className="mt-4 space-y-3">
      {/* An open request to move it takes priority over everything else. */}
      {p && (
        <div className="panel border-review/40 bg-review/5 p-4">
          <p className="label-tech text-review">Request to move</p>
          <p className="mt-1.5 text-sm text-text-hi">{formatWhen(p.startsAt)}</p>
          <p className="mt-0.5 data-mono text-[11px] text-text-faint">
            {minutesBetween(p.startsAt, p.endsAt)} min · was {formatWhen(m.startsAt)}
          </p>
          {p.note && <p className="mt-2 text-sm text-text-dim">{p.note}</p>}

          {p.mine ? (
            <p className="mt-3 text-xs text-text-faint">
              Waiting for {m.withPerson.name} to answer.
            </p>
          ) : (
            <div className="mt-3 flex gap-2">
              <Btn primary onClick={() => run(() => respondToProposal(p.id, true))} disabled={pending}>
                <Check className="size-4" />
                Move it
              </Btn>
              <Btn onClick={() => run(() => respondToProposal(p.id, false))} disabled={pending}>
                <X className="size-4" />
                Keep the original
              </Btn>
            </div>
          )}
        </div>
      )}

      {/* Whether the meeting itself is agreed. */}
      {m.status === "proposed" &&
        (m.organiser ? (
          <p className="text-sm text-text-dim">Waiting for {m.withPerson.name} to accept.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            <Btn primary onClick={() => run(() => respondToMeeting(m.id, true))} disabled={pending}>
              <Check className="size-4" />
              Accept
            </Btn>
            <Btn onClick={() => run(() => respondToMeeting(m.id, false))} disabled={pending}>
              <X className="size-4" />
              Decline
            </Btn>
          </div>
        ))}

      {!over && !p && (
        <div className="flex flex-wrap gap-2">
          {!moving && (
            <Btn onClick={() => setMoving(true)} disabled={pending}>
              <CalendarClock className="size-4" />
              Suggest another time
            </Btn>
          )}
          <Btn onClick={() => run(() => cancelMeeting(m.id))} disabled={pending}>
            Cancel session
          </Btn>
        </div>
      )}

      {moving && (
        <div className="panel p-4">
          <p className="label-tech mb-2 text-text-faint">Suggest another time</p>
          <div className="flex flex-wrap gap-2">
            <input
              type="datetime-local"
              value={start}
              onChange={(e) => setStart(e.target.value)}
              className="h-10 flex-1 rounded-lg border border-line bg-ink-850 px-3 text-sm text-text-hi focus:border-signal-line focus:outline-none"
            />
            <select
              value={minutes}
              onChange={(e) => setMinutes(Number(e.target.value))}
              className="h-10 rounded-lg border border-line bg-ink-850 px-3 text-sm text-text-hi focus:border-signal-line focus:outline-none"
            >
              {DURATIONS.map((d) => (
                <option key={d} value={d}>
                  {d} min
                </option>
              ))}
            </select>
          </div>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Why, briefly — it makes a yes more likely."
            className="mt-2 h-10 w-full rounded-lg border border-line bg-ink-850 px-3 text-sm text-text-hi placeholder:text-text-faint focus:border-signal-line focus:outline-none"
          />
          <p className="mt-2 text-xs text-text-dim">
            They will see this in their own time zone, and it only moves if they agree.
          </p>
          <div className="mt-3 flex gap-2">
            <Btn primary onClick={sendProposal} disabled={pending}>
              {pending && <Loader2 className="size-4 animate-spin" />}
              Send request
            </Btn>
            <Btn onClick={() => setMoving(false)}>Never mind</Btn>
          </div>
        </div>
      )}

      {error && <p className="text-xs text-correction">{error}</p>}
    </div>
  );
}

function Btn({
  children,
  onClick,
  disabled,
  primary,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  primary?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={
        primary
          ? "flex h-9 items-center gap-2 rounded-lg border border-signal-line bg-signal/10 px-4 text-sm font-medium text-signal-bright transition-colors hover:bg-signal/20 disabled:opacity-50"
          : "flex h-9 items-center gap-2 rounded-lg border border-line px-4 text-sm text-text-dim transition-colors hover:border-signal-line hover:text-text disabled:opacity-50"
      }
    >
      {children}
    </button>
  );
}
