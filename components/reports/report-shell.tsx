import Image from "next/image";

/*
  The frame every MIDO XI document shares.

  There are three of these now — development, training, film — and there will be
  more. Without a shared shell they drift: one grows a logo the others do not
  have, one forgets to say that MIDO's readings are interpretation, and a coach
  holding two of them can tell they came from different weeks of work.

  So the masthead, the identity block and the footer live here, once. A document
  supplies its title, its subtitle and its contents, and nothing else.

  Prints through the `@media print` block in globals.css: the dark palette flips
  to light and the app chrome disappears, so what comes out of the browser is a
  document rather than a screenshot.
*/

export interface ReportPlayer {
  name: string;
  knownAs: string;
  avatarUrl?: string;
  /** Pre-assembled, because each document decides what it may disclose. */
  identity: string[];
  email?: string;
  transfermarktUrl?: string;
}

export function ReportShell({
  kind,
  title,
  subtitle,
  player,
  children,
  footnote,
}: {
  /** The small label above the name: "Development report", "Training", … */
  kind: string;
  title: string;
  subtitle?: string;
  player: ReportPlayer;
  children: React.ReactNode;
  /** Anything this document specifically has to disclaim. */
  footnote?: string;
}) {
  return (
    <article className="panel p-6 md:p-8">
      <header className="border-b border-line pb-5">
        <div className="flex items-baseline justify-between gap-4">
          <span className="label-tech">{kind}</span>
          <span className="data-mono text-xs text-text-dim">MIDO XI</span>
        </div>

        <div className="mt-2 flex items-start gap-4">
          {player.avatarUrl && (
            <Image
              src={player.avatarUrl}
              alt=""
              width={72}
              height={72}
              unoptimized
              className="size-[72px] shrink-0 rounded-full border border-line object-cover"
            />
          )}
          <div className="min-w-0">
            <h1 className="font-display text-3xl font-bold tracking-tight text-text-hi">{title}</h1>
            {player.identity.length > 0 && (
              <p className="mt-1 text-sm text-text-dim">{player.identity.join(" · ")}</p>
            )}
            {subtitle && <p className="mt-2 text-sm text-text">{subtitle}</p>}
            {player.email && (
              <p className="mt-1 data-mono text-xs text-text-dim">{player.email}</p>
            )}
            {player.transfermarktUrl && (
              <p className="mt-1 data-mono text-xs text-text-dim">
                {player.transfermarktUrl.replace(/^https?:\/\/(www\.)?/, "")}
              </p>
            )}
          </div>
        </div>
      </header>

      {children}

      <footer className="pt-5">
        <p className="text-[11px] leading-relaxed text-text-faint">
          Produced by MIDO XI from {player.knownAs || player.name || "the player"}&rsquo;s own
          record. Counts are of what was logged. Anything labelled as MIDO&rsquo;s reading is
          interpretation of film, not measurement — MIDO XI does not produce tracking data,
          distances or speeds.
          {footnote ? ` ${footnote}` : ""}
        </p>
      </footer>
    </article>
  );
}

/** A figure and its word. Used by every document's summary band. */
export function Stat({ value, label }: { value: number | string; label: string }) {
  return (
    <div>
      <div className="data-mono text-xl text-text-hi">{value}</div>
      <div className="text-xs text-text-faint">{label}</div>
    </div>
  );
}

export function ReportSection({
  label,
  note,
  children,
}: {
  label: string;
  note?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-b border-line py-5">
      <div className="mb-3 flex flex-wrap items-baseline gap-2">
        <h2 className="label-tech">{label}</h2>
        {note && <span className="text-xs text-text-faint">{note}</span>}
      </div>
      {children}
    </section>
  );
}
