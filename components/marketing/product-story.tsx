import Link from "next/link";
import { Reveal } from "./cinematic";
import {
  AskMidoChip,
  FixtureClock,
  ReadinessDial,
  Spotlight,
} from "./locker-live";

/*
  The product-story sections ported from the Framer "Design Football OS"
  elevation. Instead of describing the system, each section is a slice of
  the real surface — the Locker command view, a study card, a film moment,
  a development thread, the fixture countdown and the evidence timeline —
  rendered with the same tokens the app itself uses.
*/

function SectionHeader({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <Reveal className="mb-6">
      <div className="label-tech mb-2">{eyebrow}</div>
      <h2 className="font-display text-3xl font-bold uppercase tracking-tight text-text-hi md:text-4xl">
        {title}
      </h2>
    </Reveal>
  );
}

const MOCK_NAV = ["Locker", "Study", "Film", "Development", "Matches", "Performance"];

const WEEK = [
  { day: "Mon", plan: "Recovery" },
  { day: "Tue", plan: "Training" },
  { day: "Wed", plan: "Film + training" },
  { day: "Thu", plan: "Training" },
  { day: "Fri", plan: "Match prep" },
  { day: "Sat", plan: "Match · Riverside", match: true },
  { day: "Sun", plan: "Recovery" },
];

/* The Locker command surface — the app's home screen as the landing showpiece. */
export function LockerShowcase() {
  return (
    <section className="cv-auto relative z-10 mx-auto max-w-6xl px-5 py-14">
      <SectionHeader eyebrow="The Locker" title="One calm command surface" />

      <Reveal>
      <Spotlight className="panel-raised relative overflow-hidden">
        <div className="field-glow absolute inset-0" aria-hidden />

        <div className="relative p-5 sm:p-7">
          {/* Mock top bar */}
          <div className="flex items-center justify-between">
            <div className="flex items-baseline gap-1">
              <span className="font-display text-base font-bold text-text-hi">MIDO</span>
              <span className="font-display text-base font-bold text-signal">XI</span>
            </div>
            <AskMidoChip />
          </div>

          {/* Mock nav */}
          <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 border-b border-line pb-3">
            {MOCK_NAV.map((item, i) => (
              <span
                key={item}
                className={`label-tech ${i === 0 ? "!text-signal-bright" : ""}`}
              >
                {item}
              </span>
            ))}
          </div>

          {/* Next best action + readiness */}
          <div className="mt-5 grid gap-4 lg:grid-cols-3">
            <div className="min-w-0 rounded-xl border border-signal-line bg-signal/10 p-5 sm:p-6 lg:col-span-2">
              <div className="label-tech">Next best action / 01</div>
              <h3 className="mt-3 font-display text-2xl font-bold uppercase leading-tight tracking-tight text-text-hi sm:text-3xl">
                Recovery should be the priority.
              </h3>
              <p className="mt-3 max-w-lg text-sm leading-relaxed text-text">
                Your readiness is 61%. You played yesterday. Your next fixture is
                four days away.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <span className="chip">Readiness check · 61%</span>
                <span className="chip">Played · Yesterday</span>
              </div>
              <Link
                href="/signup"
                className="mt-5 inline-block rounded-full bg-signal px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-signal-deep"
              >
                Start recovery
              </Link>
            </div>

            <div className="min-w-0 panel p-5 sm:p-6">
              <div className="label-tech">Readiness</div>
              <div className="mt-4">
                <ReadinessDial value={61} />
              </div>
              <p className="mt-4 text-sm text-text">Recovery-day signal</p>
              <p className="mt-1 text-sm text-text-dim">Energy stable · soreness elevated</p>
            </div>
          </div>

          {/* Football week strip */}
          <div className="mt-4 panel p-5">
            <div className="label-tech">The football week</div>
            <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-4 sm:grid-cols-4 lg:grid-cols-7">
              {WEEK.map((d) => (
                <div key={d.day} className="min-w-0">
                  <div className={`label-tech ${d.match ? "!text-signal-bright" : ""}`}>
                    {d.day}
                  </div>
                  <div
                    className={`mt-1 truncate text-xs ${
                      d.match ? "font-medium text-signal-bright" : "text-text-dim"
                    }`}
                  >
                    {d.plan}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Next match row */}
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-ink-925 px-5 py-4">
            <div className="min-w-0">
              <div className="label-tech">Next match / 03 days</div>
              <div className="mt-1 font-display text-sm font-semibold uppercase tracking-tight text-text-hi">
                Riverside FC — Saturday, 3:00 PM
              </div>
            </div>
            <span className="text-xs font-medium text-signal-bright">
              Focus: arrive recovered
            </span>
          </div>
        </div>
      </Spotlight>
      </Reveal>

      <p className="mt-4 max-w-2xl text-sm text-text-dim">
        The Locker reads everything the system knows — readiness, load, film,
        fixtures — and leads with the one action that matters today. Evidence
        first, always.
      </p>
    </section>
  );
}

const WATCH_LIST = [
  "Delay, then attack the blindside.",
  "Open the body before the final movement.",
  "Arrive across the front post, not at it.",
];

/* Study → Film → Development → Match Center → Performance, as one connected read. */
export function ProductStory() {
  return (
    <>
      {/* Study / Movement intelligence */}
      <section className="cv-auto relative z-10 mx-auto max-w-6xl px-5 py-14">
        <SectionHeader eyebrow="Player study" title="Movement intelligence" />
        <div className="grid gap-4 md:grid-cols-2">
          <Reveal className="min-w-0 panel-raised p-6">
            <div className="label-tech">Striker · Off-ball movement</div>
            <div className="mt-3 font-display text-4xl font-bold uppercase tracking-tight text-text-hi md:text-5xl">
              Harry Kane
            </div>
            <p className="mt-4 text-sm leading-relaxed text-text-dim">
              Relevant to your current development thread: near-post finishing
              and blindside movement.
            </p>
          </Reveal>
          <Reveal delay={0.08} className="min-w-0 panel p-6">
            <div className="label-tech">What to watch</div>
            <ol className="mt-4 space-y-3">
              {WATCH_LIST.map((line, i) => (
                <li key={i} className="flex gap-3 text-sm text-text-hi">
                  <span className="data-mono text-text-faint">0{i + 1}</span>
                  <span>{line}</span>
                </li>
              ))}
            </ol>
          </Reveal>
        </div>
      </section>

      {/* Film room */}
      <section className="cv-auto relative z-10 mx-auto max-w-6xl px-5 py-14">
        <SectionHeader eyebrow="Match analysis" title="Film room / Riverside FC" />
        <div className="grid gap-4 md:grid-cols-2">
          <Reveal className="relative min-w-0 overflow-hidden rounded-xl border border-line bg-gradient-to-b from-ink-850 to-ink-925 p-6">
            <div className="field-glow absolute inset-0" aria-hidden />
            <div className="relative flex min-h-44 flex-col justify-end">
              <div className="label-tech">62:14 / Receiving moment</div>
              <div className="mt-2 font-display text-2xl font-bold uppercase tracking-tight text-text-hi md:text-3xl">
                Half space / Closed body
              </div>
            </div>
          </Reveal>
          <Reveal delay={0.08} className="min-w-0 panel p-6">
            <div className="label-tech">From your match review</div>
            <blockquote className="mt-4 text-lg font-medium leading-snug text-text-hi">
              &ldquo;I kept receiving with my back completely closed.&rdquo;
            </blockquote>
            <p className="mt-4 text-sm text-text-dim">
              MIDO found 4 related moments across your last two matches.
            </p>
          </Reveal>
        </div>
      </section>

      {/* MIDO XI Capture — the free browser extension */}
      <section className="cv-auto relative z-10 mx-auto max-w-6xl px-5 py-14">
        <SectionHeader eyebrow="Free browser extension" title="Clip YouTube. Straight to your Locker." />
        <div className="grid items-center gap-10 md:grid-cols-2">
          <Reveal>
            <p className="max-w-md text-sm leading-relaxed text-text-dim">
              MIDO XI Capture lives in your browser. Watching a full match, a
              highlight reel, an analysis breakdown — hit{" "}
              <span className="data-mono text-xs text-text">Alt+Shift+M</span>{" "}
              and the moment is saved with its exact timestamp and your note.
              No account needed: moments keep in a private local library, and
              connect to your Locker whenever you create one.
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <a
                href="/mido-xi-capture.zip"
                download="mido-xi-capture.zip"
                className="rounded-xl bg-signal px-5 py-3 text-sm font-medium text-white transition-colors hover:bg-signal-deep"
              >
                Download for Chrome — free
              </a>
              <span className="chip">v0.2 · No account needed</span>
            </div>
            <p className="data-mono mt-4 text-[11px] text-text-faint">
              Unzip → chrome://extensions → Developer mode → Load unpacked
            </p>
          </Reveal>

          {/* Popup-scale mock, in the extension's real layout */}
          <Reveal delay={0.1} className="justify-self-center md:justify-self-end">
            <div className="w-72 rounded-2xl border border-line-strong bg-ink-950 p-4 shadow-2xl shadow-black/50">
              <div className="flex items-baseline gap-1.5">
                <span className="font-display text-sm font-bold text-text-hi">MIDO</span>
                <span className="font-display text-sm font-bold text-signal">XI</span>
                <span className="label-tech !text-[9px]">Capture</span>
              </div>
              <div className="mt-3 flex gap-3 rounded-xl border border-signal-line bg-signal/10 p-3">
                <div className="h-12 w-20 flex-none rounded-md border border-line bg-ink-850" />
                <div className="min-w-0">
                  <div className="label-tech !text-[9px]">Current moment</div>
                  <div className="mt-0.5 truncate text-[11px] font-medium text-text-hi">
                    Kane — movement in the box
                  </div>
                  <div className="stat-figure mt-1 text-lg !text-signal-bright">62:14</div>
                </div>
              </div>
              <p className="mt-3 rounded-lg border border-line bg-ink-850 px-3 py-2 text-[11px] leading-relaxed text-text">
                Delays his run until the CB turns his head.
              </p>
              <div className="mt-3 flex gap-1.5">
                <span className="chip !text-[9px]">Movement</span>
                <span className="chip chip-signal !text-[9px]">Near-post</span>
              </div>
              <div className="mt-3 grid h-9 place-items-center rounded-lg bg-signal text-xs font-medium text-white">
                Save moment
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Development plan */}
      <section className="cv-auto relative z-10 mx-auto max-w-6xl px-5 py-14">
        <SectionHeader eyebrow="Active development" title="Development plan" />
        <Reveal className="panel-raised p-6 sm:p-7">
          <div className="label-tech">Development thread / Improving</div>
          <div className="mt-3 font-display text-3xl font-bold uppercase tracking-tight text-text-hi md:text-4xl">
            Near-post finishing
          </div>
          <p className="data-mono mt-4 text-xs text-text-dim">
            6 sessions · 14 match moments · 3 studies · 2 coach observations
          </p>
          <p className="mt-3 max-w-2xl text-xs font-medium leading-relaxed text-signal-bright">
            PLAYER MEMORY: You told MIDO this still doesn&rsquo;t feel natural
            after six weeks of work.
          </p>
          <div className="mt-5 rounded-xl border border-signal-line bg-signal/10 px-5 py-4">
            <div className="label-tech">Connected next action</div>
            <div className="mt-1 text-sm font-medium text-text-hi">
              Finishing session Thursday
            </div>
          </div>
        </Reveal>
      </section>

      {/* Match center */}
      <section className="cv-auto relative z-10 mx-auto max-w-6xl px-5 py-14">
        <SectionHeader eyebrow="Fixture intelligence" title="Match center" />
        <div className="grid gap-4 md:grid-cols-2">
          <Reveal className="min-w-0 panel-raised p-6">
            <div className="label-tech">Next match / Saturday</div>
            <div className="stat-figure mt-3 text-6xl uppercase !text-signal-bright md:text-7xl">
              03 days
            </div>
            <p className="data-mono mt-4 text-xs text-text-dim">
              Riverside FC · 3:00 PM
            </p>
            <FixtureClock />
          </Reveal>
          <Reveal delay={0.08} className="min-w-0 rounded-xl border border-signal-line bg-signal/10 p-6">
            <div className="label-tech">Match focus</div>
            <p className="mt-3 text-lg font-medium leading-snug text-text-hi">
              Attack the space between their centre-back and left-back.
            </p>
            <p className="mt-3 text-sm text-text-dim">
              Why: your last three reviews repeatedly mention receiving too
              centrally.
            </p>
          </Reveal>
        </div>
      </section>

      {/* Performance */}
      <section className="cv-auto relative z-10 mx-auto max-w-6xl px-5 py-14">
        <SectionHeader eyebrow="Evidence, not estimates" title="Performance" />
        <div className="grid gap-4">
          <Reveal className="panel p-6">
            <div className="label-tech">Current form / Last 28 days</div>
            <p className="mt-3 max-w-2xl text-lg font-medium leading-snug text-text-hi">
              A clearer picture is forming after your last two matches and six
              sessions.
            </p>
            <p className="mt-2 text-sm text-text-dim">
              No synthetic score. MIDO only surfaces patterns when there is
              enough evidence.
            </p>
          </Reveal>

          <Reveal delay={0.06} className="panel p-6">
            <div className="label-tech">Connected timeline</div>
            <div className="data-mono mt-4 space-y-2.5 text-xs">
              <p className="text-text">
                Match played <span className="text-text-faint">→</span> Review completed
              </p>
              <p className="text-text">
                Weakness identified <span className="text-text-faint">→</span> Goal created
              </p>
              <p className="text-signal-bright">
                Kane study <span className="text-signal-bright/60">→</span> Training
                session <span className="text-signal-bright/60">→</span> Film observation
              </p>
            </div>
          </Reveal>

          <div className="grid gap-4 sm:grid-cols-3">
            {[
              { label: "Matches reviewed", value: "02", active: false },
              { label: "Film moments", value: "04", active: false },
              { label: "Active thread", value: "01", active: true },
            ].map((s, i) => (
              <Reveal
                key={s.label}
                delay={i * 0.07}
                className={`min-w-0 rounded-xl border p-5 ${
                  s.active
                    ? "border-signal-line bg-signal/10"
                    : "border-line bg-ink-900"
                }`}
              >
                <div className="label-tech">{s.label}</div>
                <div
                  className={`stat-figure mt-3 text-5xl ${
                    s.active ? "!text-signal-bright" : ""
                  }`}
                >
                  {s.value}
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}

/* Closing system statement — the Locker again, at phone size. */
export function PocketStatement() {
  return (
    <section className="cv-auto relative z-10 mx-auto max-w-6xl px-5 py-14">
      <div className="grid items-center gap-10 md:grid-cols-2">
        <Reveal>
          <div className="label-tech mb-2">The player system</div>
          <h2 className="font-display text-3xl font-bold uppercase tracking-tight text-text-hi md:text-4xl">
            The system travels with you
          </h2>
          <p className="mt-4 max-w-md text-sm leading-relaxed text-text-dim">
            The same Locker, the same evidence, the same next best action —
            from the desktop film room to the phone in your kit bag. Nothing to
            sync, nothing to re-enter.
          </p>
        </Reveal>

        {/* Phone-scale locker mock */}
        <Reveal delay={0.1} className="justify-self-center md:justify-self-end">
          <div className="w-64 rounded-[28px] border border-line-strong bg-ink-925 p-4 shadow-2xl shadow-black/50">
            <div className="flex items-baseline gap-1">
              <span className="font-display text-xs font-bold text-text-hi">MIDO</span>
              <span className="font-display text-xs font-bold text-signal">XI</span>
            </div>
            <div className="label-tech mt-4">Today / Next best action</div>
            <div className="mt-2 font-display text-lg font-bold uppercase leading-tight tracking-tight text-text-hi">
              Recover. Your body has the message.
            </div>
            <p className="data-mono mt-2 text-[10px] text-text-dim">
              61% readiness · played yesterday
            </p>
            <span className="mt-3 inline-block rounded-full bg-signal px-3 py-1.5 text-xs font-medium text-white">
              Start recovery
            </span>
            <div className="mt-4 flex justify-between border-t border-line pt-3">
              <div>
                <div className="label-tech !text-[9px]">Today</div>
                <div className="mt-0.5 text-[10px] text-text-dim">Recovery</div>
              </div>
              <div className="text-right">
                <div className="label-tech !text-[9px]">Next</div>
                <div className="mt-0.5 text-[10px] text-text-dim">Training · Tue</div>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
