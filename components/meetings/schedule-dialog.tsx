"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarPlus, Loader2, X } from "lucide-react";
import { createMeeting } from "@/app/app/meetings/actions";
import {
  DURATIONS,
  MEETING_KINDS,
  TITLE_MAX,
  formatWhen,
  kindMeta,
  rangeIssue,
  titleIssue,
  type MeetingKind,
  type MeetingPerson,
} from "@/lib/data/meeting-types";
import { FormError } from "@/components/forms/ui";
import { cn } from "@/lib/utils";

/*
  Booking time with somebody.

  The picker only ever contains people this account is connected to,
  and the server checks that again on submit — a form that merely omits
  an option is not enforcing anything.

  The time is entered in the reader's own zone through a plain
  `datetime-local`, converted to an instant on submit, and echoed back
  underneath WITH THE ZONE NAMED before they can send it. Two people in
  different countries agreeing to "3pm" without ever seeing which 3pm
  is the failure this whole feature exists to avoid.
*/

/** `datetime-local` wants local wall-clock, not an instant. */
function localValue(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Next round half-hour — a sensible default nobody has to correct. */
function defaultStart(): string {
  const d = new Date();
  d.setSeconds(0, 0);
  d.setMinutes(d.getMinutes() > 30 ? 60 : 30);
  return localValue(d);
}

export function ScheduleDialog({ people }: { people: MeetingPerson[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [withUser, setWithUser] = useState(people[0]?.id ?? "");
  const [kind, setKind] = useState<MeetingKind>("film");
  const [title, setTitle] = useState("");
  const [start, setStart] = useState(defaultStart);
  const [minutes, setMinutes] = useState<number>(45);
  const [note, setNote] = useState("");
  const [link, setLink] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (people.length === 0) return null;

  const startIso = start ? new Date(start).toISOString() : "";
  const endIso = startIso ? new Date(Date.parse(startIso) + minutes * 60_000).toISOString() : "";
  const issue = title.trim()
    ? (titleIssue(title) ?? (startIso ? rangeIssue(startIso, endIso) : "Pick a time."))
    : null;

  const submit = () =>
    startTransition(async () => {
      setError(null);
      const bad = titleIssue(title) ?? rangeIssue(startIso, endIso);
      if (bad) {
        setError(bad);
        return;
      }
      const res = await createMeeting({
        withUser,
        kind,
        title,
        note: note || null,
        startsAt: startIso,
        endsAt: endIso,
        externalUrl: link || null,
      });
      if (res.ok) {
        setOpen(false);
        setTitle("");
        setNote("");
        setLink("");
        router.refresh();
        if (res.id) router.push(`/app/meetings/${res.id}`);
      } else setError(res.error);
    });

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex h-10 items-center gap-2 rounded-lg border border-signal-line bg-signal/10 px-4 text-sm font-medium text-signal-bright transition-colors hover:bg-signal/20"
      >
        <CalendarPlus className="size-4" />
        Book a session
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-ink-950/70 p-4">
      <div className="panel w-full max-w-[480px] p-5">
        <div className="mb-4 flex items-start justify-between gap-4">
          <h2 className="font-display text-lg font-bold text-text-hi">Book a session</h2>
          <button
            onClick={() => setOpen(false)}
            aria-label="Close"
            className="text-text-faint transition-colors hover:text-text"
          >
            <X className="size-5" />
          </button>
        </div>

        <Field label="With">
          <select
            value={withUser}
            onChange={(e) => setWithUser(e.target.value)}
            className="h-10 w-full rounded-lg border border-line bg-ink-850 px-3 text-sm text-text-hi focus:border-signal-line focus:outline-none"
          >
            {people.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
                {p.position ? ` · ${p.position}` : ""}
              </option>
            ))}
          </select>
        </Field>

        <Field label="What kind">
          <div className="flex flex-wrap gap-1.5">
            {MEETING_KINDS.map((k) => (
              <button
                key={k.kind}
                onClick={() => setKind(k.kind)}
                className={cn(
                  "rounded-lg border px-2.5 py-1.5 text-xs transition-colors",
                  kind === k.kind
                    ? "border-signal-line bg-signal/10 text-signal-bright"
                    : "border-line text-text-dim hover:border-signal-line hover:text-text",
                )}
              >
                {k.label}
              </button>
            ))}
          </div>
          <p className="mt-1.5 text-xs text-text-faint">{kindMeta(kind).hint}</p>
        </Field>

        <Field label="Title">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={TITLE_MAX}
            placeholder="Northgate away — first half"
            className="h-10 w-full rounded-lg border border-line bg-ink-850 px-3 text-sm text-text-hi placeholder:text-text-faint focus:border-signal-line focus:outline-none"
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Starts">
            <input
              type="datetime-local"
              value={start}
              onChange={(e) => setStart(e.target.value)}
              className="h-10 w-full rounded-lg border border-line bg-ink-850 px-3 text-sm text-text-hi focus:border-signal-line focus:outline-none"
            />
          </Field>
          <Field label="How long">
            <select
              value={minutes}
              onChange={(e) => setMinutes(Number(e.target.value))}
              className="h-10 w-full rounded-lg border border-line bg-ink-850 px-3 text-sm text-text-hi focus:border-signal-line focus:outline-none"
            >
              {DURATIONS.map((d) => (
                <option key={d} value={d}>
                  {d} minutes
                </option>
              ))}
            </select>
          </Field>
        </div>

        {/*
          The zone, spelled out, before they can send it. This is the
          single most useful line in the dialog.
        */}
        {startIso && !issue && (
          <p className="mt-1 text-xs text-text-dim">
            {formatWhen(startIso)} — {minutes} minutes, in your time zone. They will see it in theirs.
          </p>
        )}

        <Field label="Note (optional)">
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            placeholder="Bring the two build-up clips you flagged."
            className="w-full resize-none rounded-lg border border-line bg-ink-850 px-3 py-2 text-sm text-text-hi placeholder:text-text-faint focus:border-signal-line focus:outline-none"
          />
        </Field>

        <Field label="Call link (optional)">
          <input
            value={link}
            onChange={(e) => setLink(e.target.value)}
            placeholder="Zoom, Meet or FaceTime link"
            className="h-10 w-full rounded-lg border border-line bg-ink-850 px-3 text-sm text-text-hi placeholder:text-text-faint focus:border-signal-line focus:outline-none"
          />
        </Field>

        <FormError error={error} />

        <div className="mt-4 flex justify-end gap-2">
          <button
            onClick={() => setOpen(false)}
            className="h-9 rounded-lg border border-line px-4 text-sm text-text-dim transition-colors hover:text-text"
          >
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={pending || Boolean(titleIssue(title))}
            className="flex h-9 items-center gap-2 rounded-lg border border-signal-line bg-signal/10 px-4 text-sm font-medium text-signal-bright transition-colors hover:bg-signal/20 disabled:opacity-50"
          >
            {pending && <Loader2 className="size-4 animate-spin" />}
            Send
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="mb-3 block">
      <span className="label-tech mb-1.5 block text-text-faint">{label}</span>
      {children}
    </label>
  );
}
