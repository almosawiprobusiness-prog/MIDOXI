import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink, Radio, Video } from "lucide-react";
import { getMeeting } from "@/lib/data/meetings";
import {
  STATUS_LABEL,
  canJoin,
  formatWhen,
  joinBlockedReason,
  kindMeta,
  minutesBetween,
  relativeWhen,
} from "@/lib/data/meeting-types";
import { Agenda } from "@/components/meetings/agenda";
import { MeetingControls } from "@/components/meetings/meeting-controls";

/*
  Named after the session rather than the word "Session". Static, this
  read the same for every meeting — and the one moment somebody has
  several open is exactly when they are trying to find the right call.
*/
export async function generateMetadata({ params }: PageProps<"/app/meetings/[id]">) {
  const { id } = await params;
  const m = await getMeeting(id);
  return { title: m ? `${m.title} — Meetings` : "Session — MIDO XI" };
}

export default async function MeetingPage({ params }: PageProps<"/app/meetings/[id]">) {
  const { id } = await params;
  const m = await getMeeting(id);
  if (!m) notFound();

  const live = canJoin(m);
  const blocked = joinBlockedReason(m);
  const meta = kindMeta(m.kind);

  return (
    <div className="mx-auto max-w-[720px] px-4 py-8">
      <Link
        href="/app/meetings"
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-text-dim transition-colors hover:text-text"
      >
        <ArrowLeft className="size-4" />
        Meetings
      </Link>

      <header>
        <div className="flex flex-wrap items-center gap-2">
          <span className="label-tech text-text-faint">{meta.label}</span>
          {live && (
            <span className="inline-flex items-center gap-1 rounded-full border border-signal-line bg-signal/10 px-2 py-0.5 text-[10px] font-medium text-signal-bright">
              <Radio className="size-3 animate-pulse" />
              Happening now
            </span>
          )}
          {m.status !== "confirmed" && (
            <span className="rounded-full border border-line px-2 py-0.5 text-[10px] text-text-dim">
              {STATUS_LABEL[m.status]}
            </span>
          )}
        </div>

        <h1 className="mt-1 font-display text-2xl font-bold tracking-tight text-text-hi">{m.title}</h1>

        <p className="mt-1.5 text-sm text-text">
          With <span className="text-text-hi">{m.withPerson.name}</span>
          {m.withPerson.position && <span className="text-text-faint"> · {m.withPerson.position}</span>}
        </p>

        {/*
          The zone is named here too. This is the line somebody screenshots
          and sends to the other person, so it has to be unambiguous on
          its own.
        */}
        <p className="mt-3 text-sm text-text-hi">{formatWhen(m.startsAt)}</p>
        <p className="mt-0.5 data-mono text-[11px] text-text-faint">
          {minutesBetween(m.startsAt, m.endsAt)} minutes · {relativeWhen(m.startsAt)}
        </p>

        {m.note && <p className="mt-3 max-w-prose text-sm leading-relaxed text-text-dim">{m.note}</p>}
      </header>

      {/* Joining */}
      <div className="mt-5">
        {m.externalUrl && live ? (
          <a
            href={m.externalUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-10 items-center gap-2 rounded-lg border border-signal-line bg-signal/10 px-4 text-sm font-medium text-signal-bright transition-colors hover:bg-signal/20"
          >
            <ExternalLink className="size-4" />
            Join the call
          </a>
        ) : m.videoProvider === "daily" ? (
          <p className="text-sm text-text-dim">
            <Video className="mr-1.5 inline size-4" />
            In-app video is not connected yet.
          </p>
        ) : blocked ? (
          /*
            A disabled button with no explanation is what people file
            support tickets about, so the reason is written out.
          */
          <p className="text-sm text-text-faint">{blocked}</p>
        ) : null}
      </div>

      <MeetingControls meeting={m} />

      <Agenda meetingId={m.id} items={m.agenda} />
    </div>
  );
}
