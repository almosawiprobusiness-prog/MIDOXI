import Link from "next/link";
import {
  Swords,
  Clapperboard,
  Dumbbell,
  Target,
  LineChart,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Users,
} from "lucide-react";
import { isDemoMode } from "@/lib/env";
import { ROLES, ROLE_IDS } from "@/lib/roles/roles";
import { HeroMotion, ScrollZoomReveal } from "@/components/marketing/scroll-motion";

export const metadata = {
  title: "MIDO XI — Your entire football career. One system.",
  description:
    "A private football intelligence environment for players, coaches, trainers and clubs. Matches, film, training, development and AI study — one connected loop.",
};

const LOOP = ["Match", "Film", "Insight", "Study", "Training", "Match"];

const PILLARS = [
  { icon: Swords, title: "Matches", body: "A real match database with position-specific stats, self-review and coach feedback." },
  { icon: Clapperboard, title: "Film Room", body: "Upload, clip, tag and study — a true analysis room, not a video dump." },
  { icon: Dumbbell, title: "Training", body: "Football-specific sessions, load and a reusable drill library." },
  { icon: Target, title: "Development", body: "Active objectives tracked by evidence — clips, sessions, notes. Never XP points." },
  { icon: LineChart, title: "Performance", body: "Analytics where every chart answers a football question." },
];

export default function LandingPage() {
  return (
    <div className="relative min-h-screen overflow-x-clip">
      {/*
        `overflow-x-clip`, not `overflow-hidden`. An ancestor with
        `overflow: hidden` establishes a scroll container and silently
        kills `position: sticky` in every descendant — which would leave
        the reveal section below as 400vh of nothing. `clip` contains
        the background glows the same way without creating one.
      */}
      <div className="pitch-grid absolute inset-0 opacity-60" aria-hidden />
      <div className="field-glow absolute inset-0" aria-hidden />

      {/* Full-bleed cinematic hero */}
      <section className="relative min-h-[92vh] w-full overflow-hidden">
        {/*
          The video is full-bleed and the headline is readable on the
          first frame — that is the hero's job. The motion is a slow
          push-in as you leave it, so the page has some life without the
          opening being something that has to assemble itself first.
        */}
        <HeroMotion src="/hero.mp4" poster="/hero-poster.jpg" />
        {/* legibility scrims — dark on the left for copy, blend into the page at the bottom */}
        <div className="absolute inset-0 bg-gradient-to-r from-ink-950 via-ink-950/70 to-ink-950/5" aria-hidden />
        <div className="absolute inset-0 bg-gradient-to-t from-ink-950 via-transparent to-ink-950/45" aria-hidden />

        <div className="relative z-10 flex min-h-[92vh] flex-col">
          {/* Nav */}
          <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-5">
            <Link href="/" className="flex items-baseline gap-1.5">
              <span className="font-display text-xl font-bold tracking-tight text-text-hi">MIDO</span>
              <span className="font-display text-xl font-bold tracking-tight text-signal">XI</span>
            </Link>
            <nav className="flex items-center gap-2">
              {isDemoMode && (
                <Link
                  href="/app"
                  className="hidden rounded-lg border border-line px-3.5 py-2 text-sm text-text transition-colors hover:border-signal-line hover:text-signal-bright sm:inline-block"
                >
                  View demo
                </Link>
              )}
              <Link
                href="/login"
                className="rounded-lg px-3.5 py-2 text-sm text-text-dim transition-colors hover:text-text-hi"
              >
                Log in
              </Link>
              <Link
                href="/signup"
                className="rounded-lg bg-signal px-3.5 py-2 text-sm font-medium text-white transition-colors hover:bg-signal-deep"
              >
                Create profile
              </Link>
            </nav>
          </header>

          {/* Hero copy */}
          <div className="flex flex-1 items-center">
            <div className="mx-auto w-full max-w-6xl px-5 pb-24 pt-10">
              <div className="chip chip-signal mb-6">Football Performance OS</div>
              <h1 className="max-w-2xl font-display text-5xl font-bold leading-[1.02] tracking-tight text-text-hi md:text-7xl [text-shadow:0_2px_30px_rgba(0,0,0,0.75)]">
                Your entire football career.{" "}
                <span className="text-signal">One system.</span>
              </h1>
              <p className="mt-6 max-w-xl text-lg leading-relaxed text-text [text-shadow:0_1px_16px_rgba(0,0,0,0.8)]">
                Every match, every clip, every lesson, every session. MIDO XI is the
                private intelligence environment where serious footballers study,
                prepare and build a career — and where film turns into real
                improvement.
              </p>
              <div className="mt-9 flex flex-wrap items-center gap-3">
                <Link
                  href="/signup"
                  className="group flex items-center gap-2 rounded-xl bg-signal px-5 py-3 font-medium text-white shadow-lg shadow-black/40 transition-colors hover:bg-signal-deep"
                >
                  Create your player profile
                  <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
                </Link>
                <Link
                  href={isDemoMode ? "/app" : "/login"}
                  className="rounded-xl border border-line-strong bg-ink-950/40 px-5 py-3 font-medium text-text backdrop-blur-sm transition-colors hover:border-signal-line hover:text-signal-bright"
                >
                  {isDemoMode ? "Explore the demo locker" : "Log in"}
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/*
        The showpiece. Starts as a small rounded frame and grows to fill
        the screen as you scroll — the effect only works because it
        starts small, which is precisely why it belongs here rather than
        at the top of the page.
      */}
      <ScrollZoomReveal
        className="relative z-10"
        src="/hero.mp4"
        poster="/hero-poster.jpg"
        caption={
          <>
            <p className="font-display text-3xl font-bold leading-tight tracking-tight text-text-hi md:text-5xl [text-shadow:0_2px_30px_rgba(0,0,0,0.8)]">
              Watch it again. <span className="text-signal">Properly.</span>
            </p>
            <p className="mx-auto mt-4 max-w-xl text-base text-text [text-shadow:0_1px_16px_rgba(0,0,0,0.85)]">
              Every clip tagged, every moment timestamped, every lesson kept — so
              the same mistake stops being the same mistake.
            </p>
          </>
        }
      />

      {/* Development loop */}
      <section className="relative z-10 mx-auto max-w-6xl px-5 py-14">
        <div className="label-tech mb-6">The development loop</div>
        <div className="panel-raised flex flex-wrap items-center justify-center gap-x-2 gap-y-4 p-8">
          {LOOP.map((node, i) => (
            <div key={i} className="flex items-center gap-2">
              <span
                className={`rounded-lg border px-4 py-2 font-display text-sm font-semibold ${
                  i === 0 || i === LOOP.length - 1
                    ? "border-signal-line bg-signal/10 text-signal-bright"
                    : "border-line text-text-hi"
                }`}
              >
                {node}
              </span>
              {i < LOOP.length - 1 && (
                <ArrowRight className="size-4 text-text-faint" />
              )}
            </div>
          ))}
        </div>
        <p className="mt-4 max-w-2xl text-sm text-text-dim">
          Football improvement shouldn&rsquo;t live in disconnected apps. MIDO
          links what happened in a match to the film that explains it, the
          insight you took, the study that sharpens it, and the training that
          fixes it — then back to the next match.
        </p>
      </section>

      {/* Player system */}
      <section className="relative z-10 mx-auto max-w-6xl px-5 py-14">
        <div className="label-tech mb-6">The player system</div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {PILLARS.map((p) => {
            const Icon = p.icon;
            return (
              <div key={p.title} className="min-w-0 panel p-5">
                <span className="grid size-10 place-items-center rounded-lg border border-line bg-ink-850 text-signal-bright">
                  <Icon className="size-5" />
                </span>
                <h3 className="mt-4 font-display text-lg font-semibold text-text-hi">
                  {p.title}
                </h3>
                <p className="mt-1.5 text-sm leading-relaxed text-text-dim">{p.body}</p>
              </div>
            );
          })}

          {/* AI study engine — highlighted */}
          <div className="panel-raised relative overflow-hidden p-5">
            <div className="field-glow absolute inset-0" aria-hidden />
            <div className="relative">
              <span className="grid size-10 place-items-center rounded-lg border border-signal-line bg-signal/10 text-signal-bright">
                <Sparkles className="size-5" />
              </span>
              <div className="mt-4 flex items-center gap-2">
                <h3 className="font-display text-lg font-semibold text-text-hi">
                  MIDO AI Study Engine
                </h3>
                <span className="chip chip-signal">PRO</span>
              </div>
              <p className="mt-1.5 text-sm leading-relaxed text-text-dim">
                Recommends real football film for your position, goals and recent
                match issues — then turns what you learn into a training action.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Four operating systems — the product thesis, and the thing a visitor
          could not previously learn without signing up. Read from the same
          role registry the app uses, so this cannot drift from what ships. */}
      <section className="relative z-10 mx-auto max-w-6xl px-5 py-14">
        <div className="mb-6 max-w-2xl">
          <div className="label-tech mb-2">One account · four systems</div>
          <h2 className="font-display text-3xl font-bold tracking-tight text-text-hi">
            It becomes a different product depending on who you are.
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-text-dim">
            Not four apps, and not one app with a settings toggle. The navigation, the language, the
            first screen and what MIDO is willing to say all change with the role — over one shared
            football intelligence engine. Switch role and the whole system follows you.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {ROLE_IDS.map((id) => {
            const role = ROLES[id];
            const Icon = role.icon;
            return (
              <div key={id} className="min-w-0 panel flex flex-col p-5">
                <Icon className="size-5 text-signal-bright" />
                <h3 className="mt-3 font-display text-lg font-semibold text-text-hi">
                  {role.label}
                </h3>
                <p className="mt-1 text-sm text-text-dim">{role.tagline}</p>
                <p className="mt-3 border-t border-line pt-3 text-xs leading-relaxed text-text-faint">
                  &ldquo;{role.question}&rdquo;
                </p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Honesty + privacy */}
      <section className="relative z-10 mx-auto max-w-6xl px-5 py-14">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="min-w-0 panel p-6">
            <ShieldCheck className="size-6 text-signal-bright" />
            <h3 className="mt-3 font-display text-xl font-semibold text-text-hi">
              Private by default
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-text-dim">
              Your matches, notes, readiness, film and feedback are yours. A coach or club sees only
              what you accepted when you linked your account, you can change or end that at any
              time, and the database enforces it rather than the interface. Export or delete
              everything whenever you like.
            </p>
          </div>
          <div className="min-w-0 panel p-6">
            <Users className="size-6 text-signal-bright" />
            <h3 className="mt-3 font-display text-xl font-semibold text-text-hi">
              It tells you what it cannot do
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-text-dim">
              MIDO has no camera system and no data feed, so it does not report distances, sprint
              counts or expected goals — and it says so rather than estimating them. What it holds
              is what you and your coach record, plus a curated football library where facts and
              interpretation are labelled separately.
            </p>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="relative z-10 mx-auto max-w-6xl px-5 py-20 text-center">
        <h2 className="mx-auto max-w-2xl font-display text-4xl font-bold tracking-tight text-text-hi md:text-5xl">
          Build your football memory.
        </h2>
        <p className="mx-auto mt-4 max-w-md text-text-dim">
          From academy level through professional football — one record, one
          system, every season.
        </p>
        <Link
          href="/signup"
          className="group mt-8 inline-flex items-center gap-2 rounded-xl bg-signal px-6 py-3.5 font-medium text-white transition-colors hover:bg-signal-deep"
        >
          Create your profile
          <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
        </Link>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-5 py-8">
          <div className="flex items-baseline gap-1.5">
            <span className="font-display text-sm font-bold text-text-hi">MIDO</span>
            <span className="font-display text-sm font-bold text-signal">XI</span>
            <span className="ml-2 text-xs text-text-faint">
              © {new Date().getFullYear()} · Football Performance OS
            </span>
          </div>
          <nav className="flex items-center gap-5 text-sm text-text-dim">
            <Link href="/privacy" className="transition-colors hover:text-text-hi">Privacy</Link>
            <Link href="/terms" className="transition-colors hover:text-text-hi">Terms</Link>
            <Link href="/login" className="transition-colors hover:text-text-hi">Log in</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
