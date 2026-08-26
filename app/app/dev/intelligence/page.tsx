import { notFound } from "next/navigation";
import { FlaskConical, TriangleAlert, Check, X, Minus } from "lucide-react";
import { buildPlayerSignals } from "@/lib/intelligence/build-signals";
import {
  explainActions,
  hasEnoughToRecommend,
  SURFACE_FLOOR,
  type ScoredCandidate,
} from "@/lib/intelligence/next-best-action";
import { describeSource, parseSource } from "@/lib/intelligence/recommendation-types";
import { briefingLinesToSuppress } from "@/lib/intelligence/overlap";
import { listRecentRecommendations } from "@/lib/data/recommendations";
import { listMidoEvents } from "@/lib/events/emit";
import { SectionHeader } from "@/components/ui/primitives";
import { isDemoMode } from "@/lib/env";

/*
  THE INTELLIGENCE INSPECTOR — development only.

  Everything MIDO used to decide what to tell this player, in the order
  it was used: what was read, what that became, what it scored, what was
  shown, and what was recorded afterwards.

  ───────────────────────────────────────────────────────────────────────
  WHY THIS IS NOT A USER-FACING FEATURE
  ───────────────────────────────────────────────────────────────────────

  A player does not need to see the arithmetic; they need one true
  sentence, which the Locker already gives them. The audience here is
  whoever has to answer "why did it say THAT" — and, far more often,
  "why did it not say the thing I expected". The second question is the
  expensive one, so the discarded candidates get as much room as the
  surfaced ones.

  It is gated on NODE_ENV rather than on a role. A permission is
  something an administrator can be given by mistake; a build-time
  constant is not, and this page reads a player's own record in full.

  Nothing here re-implements the ranking. `explainActions` is the same
  function the Locker's ranking is defined in terms of, so this shows
  what actually happened rather than a plausible reconstruction of it —
  an inspector that computes its own answer is a second bug waiting to
  disagree with the first.
*/

export const dynamic = "force-dynamic";

/** Whether this route exists at all. Build-time constant, not a role. */
const ENABLED = process.env.NODE_ENV === "development";

/*
  The gate is applied HERE as well as in the component, and that is not
  belt-and-braces — the two do different jobs.

  Metadata resolves before the render stream opens. A `notFound()` raised
  only inside the component arrives after the title has already gone out,
  so the route would answer with its own name — "Intelligence inspector"
  — while refusing to render. Raising it here is what stops it naming
  itself.

  MEASURED, so the claim above is not a hope: in a production build this
  route serves the not-found body, the generic root title, and none of
  the page's content.

  What it does NOT do is answer 404. Under `/app` a `loading.tsx`
  boundary flushes the shell before the page resolves, so the status is
  committed at 200 and every `notFound()` in this section behaves the
  same way — `/app/matches/does-not-exist` included. That is an app-wide
  streaming property, not a property of this page, and it is not worth
  restructuring how the whole section streams to change a status code on
  a route that already renders nothing.
*/
export async function generateMetadata() {
  if (!ENABLED) notFound();
  return { title: "Intelligence inspector — MIDO XI" };
}

export default async function IntelligenceInspectorPage() {
  if (!ENABLED) notFound();

  const now = new Date();
  const signals = await buildPlayerSignals(now);
  const informed = hasEnoughToRecommend(signals);
  const candidates = explainActions(signals);
  const surfaced = candidates.filter((c) => c.surfaced);

  const [stored, events] = await Promise.all([
    listRecentRecommendations(25),
    listMidoEvents({ limit: 30 }),
  ]);

  // What the Locker would actually put on screen, and what that costs
  // the briefing below it.
  const shown = surfaced.slice(0, 3);
  const suppressed = briefingLinesToSuppress(shown.map((c) => c.action.kind));

  return (
    <div className="mx-auto max-w-[1100px] px-4 py-8 md:px-6">
      <header className="mb-8">
        <div className="label-tech flex items-center gap-3">
          <FlaskConical className="size-3.5" />
          <span>Development only</span>
        </div>
        <h1 className="mt-3 font-display text-3xl font-bold tracking-tight text-text-hi md:text-4xl">
          Intelligence inspector
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-text-dim">
          Everything behind the Locker&rsquo;s next best action, in the order it was used.
          Outside development it renders nothing and does not name itself.
        </p>
      </header>

      {/* ── the verdict, before any detail ─────────────── */}
      <section className="mb-8">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat
            label="Knows enough"
            value={informed ? "Yes" : "No"}
            tone={informed ? "good" : "warn"}
          />
          <Stat label="Candidates scored" value={String(candidates.length)} />
          <Stat label="Above the floor" value={`${surfaced.length}`} />
          <Stat label="Floor" value={String(SURFACE_FLOOR)} />
        </div>

        {!informed && (
          <div className="mt-3 flex items-start gap-3 panel p-4">
            <TriangleAlert className="mt-0.5 size-4 shrink-0 text-review" />
            <p className="text-sm leading-relaxed text-text-dim">
              <span className="text-text-hi">Nothing is being surfaced.</span> The Locker is
              showing its honest empty state rather than a recommendation. That needs one of:
              an active goal, a match on record, or a readiness figure.
            </p>
          </div>
        )}
      </section>

      {/* ── 1. what was read ───────────────────────────── */}
      <section className="mb-8">
        <SectionHeader label="1 · Signals" />
        <p className="mb-3 text-sm text-text-dim">
          The inputs, as the scorer sees them. Every time is a whole-day delta so the
          arithmetic never depends on the clock.
        </p>
        {isDemoMode && (
          <div className="mb-3 flex items-start gap-3 panel p-4">
            <TriangleAlert className="mt-0.5 size-4 shrink-0 text-review" />
            <p className="text-sm leading-relaxed text-text-dim">
              <span className="text-text-hi">Demo mode reads two different clocks.</span> The
              seed states its fixture twice — a fixed date and a fixed{" "}
              <span className="data-mono">daysRemaining</span> — so the Locker&rsquo;s copy stays
              frozen at &ldquo;three days out&rdquo; while these signals are computed against
              today. Where the two disagree the seed is stale, not the scorer. On a real
              account both read the same <span className="data-mono">matches</span> row and
              cannot drift.
            </p>
          </div>
        )}
        <div className="panel overflow-hidden">
          <table className="w-full text-sm">
            <tbody className="divide-y divide-line">
              <Signal name="daysSinceLastMatch" value={signals.daysSinceLastMatch} unit="days" />
              <Signal name="lastMatchReviewed" value={signals.lastMatchReviewed} />
              <Signal name="daysUntilNextMatch" value={signals.daysUntilNextMatch} unit="days" />
              <Signal name="readiness" value={signals.readiness} unit="/100" />
              <Signal name="daysSinceCheckin" value={signals.daysSinceCheckin} unit="days" />
              <Signal name="daysSinceStudy" value={signals.daysSinceStudy} unit="days" />
              <Signal name="daysSinceTraining" value={signals.daysSinceTraining} unit="days" />
              <Signal
                name="activeGoals"
                value={signals.activeGoals.length}
                detail={signals.activeGoals.map((g) => g.title).join(" · ")}
              />
              <Signal
                name="completedStudies"
                value={signals.completedStudies?.length ?? 0}
                detail={(signals.completedStudies ?? [])
                  .map((s) => `${s.subject} (${s.daysAgo}d)`)
                  .join(" · ")}
              />
              <Signal
                name="filmObservations"
                value={signals.filmObservations?.length ?? 0}
                detail={(signals.filmObservations ?? [])
                  .map((o) => `${o.concept} (${o.daysAgo}d${o.goalId ? ", linked" : ""})`)
                  .join(" · ")}
              />
              <Signal
                name="recentlyDismissed"
                value={signals.recentlyDismissed?.length ?? 0}
                detail={(signals.recentlyDismissed ?? []).join(" · ")}
              />
            </tbody>
          </table>
        </div>
      </section>

      {/* ── 2. what it scored, including the rejects ───── */}
      <section className="mb-8">
        <SectionHeader label="2 · Ranking" />
        <p className="mb-3 text-sm text-text-dim">
          Every candidate the scorer built, not only the survivors. A bar that stops short of
          the marked floor is the answer to &ldquo;why is this not showing&rdquo;.
        </p>

        {candidates.length === 0 ? (
          <div className="panel p-5 text-sm text-text-dim">
            No candidates at all — no rule found anything to say from these signals.
          </div>
        ) : (
          <div className="space-y-2">
            {candidates.map((c, i) => (
              <CandidateRow key={c.action.kind} c={c} rank={i} inTopThree={shown.includes(c)} />
            ))}
          </div>
        )}
      </section>

      {/* ── 3. what it costs the briefing ──────────────── */}
      <section className="mb-8">
        <SectionHeader label="3 · Briefing overlap" />
        <div className="panel p-5">
          {suppressed.length === 0 ? (
            <p className="text-sm text-text-dim">
              Nothing surfaced collides with a briefing line, so the briefing says everything
              it would have said anyway.
            </p>
          ) : (
            <>
              <p className="text-sm text-text-dim">
                The briefing below the panel will drop{" "}
                <span className="text-text-hi">{suppressed.length}</span>{" "}
                {suppressed.length === 1 ? "line" : "lines"}, because the panel above already
                {suppressed.length === 1 ? " covers it." : " covers them."}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {suppressed.map((id) => (
                  <span key={id} className="chip data-mono">
                    {id}
                  </span>
                ))}
              </div>
            </>
          )}
        </div>
      </section>

      {/* ── 4. what was written down ───────────────────── */}
      <section className="mb-8">
        <SectionHeader label="4 · Stored recommendations" />
        <p className="mb-3 text-sm text-text-dim">
          At most one active row per kind. A completed or dismissed row also silences its kind
          for a day, which is why something answered does not immediately return.
        </p>
        {stored.length === 0 ? (
          <div className="panel p-5 text-sm text-text-dim">
            Nothing stored yet.{" "}
            {isDemoMode
              ? "Demo mode keeps these in memory, so a server restart clears them."
              : "If the Locker is showing advice and this is empty, migration 0032 has not run."}
          </div>
        ) : (
          <div className="panel overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-line text-left">
                  <Th>Kind</Th>
                  <Th>Status</Th>
                  <Th>Priority</Th>
                  <Th>Created</Th>
                  <Th>Expires</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {stored.map((r) => (
                  <tr key={r.id}>
                    <Td className="text-text-hi">{r.kind}</Td>
                    <Td>
                      <StatusChip status={r.status} />
                    </Td>
                    <Td className="data-mono">{r.priority}</Td>
                    <Td className="data-mono text-text-faint">{stamp(r.createdAt)}</Td>
                    <Td className="data-mono text-text-faint">
                      {r.expiresAt ? stamp(r.expiresAt) : "—"}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ── 5. what actually happened ──────────────────── */}
      <section className="mb-8">
        <SectionHeader label="5 · Event tail" />
        <p className="mb-3 text-sm text-text-dim">
          The last 30 events for this account, newest first. Signals that look wrong are
          usually a missing emitter rather than a scoring bug — this is where that shows.
        </p>
        {events.length === 0 ? (
          <div className="panel p-5 text-sm text-text-dim">
            No events recorded.{" "}
            {isDemoMode
              ? "Demo mode keeps these in memory."
              : "If actions are being taken and this stays empty, migration 0031 has not run."}
          </div>
        ) : (
          <div className="panel overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-line text-left">
                  <Th>Type</Th>
                  <Th>Subject</Th>
                  <Th>Source</Th>
                  <Th>Occurred</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {events.map((e) => (
                  <tr key={e.id}>
                    <Td className="data-mono text-text-hi">{e.type}</Td>
                    <Td className="text-text-dim">{e.subjectType}</Td>
                    <Td className="text-text-faint">{e.source}</Td>
                    <Td className="data-mono text-text-faint">{stamp(e.occurredAt)}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <p className="border-t border-line pt-4 text-[11px] leading-relaxed text-text-faint">
        Read-only. This page emits nothing and writes nothing — inspecting the loop must not
        move it, or the reading changes the thing being read.
      </p>
    </div>
  );
}

/* ── small pieces ──────────────────────────────────────── */

function Stat({ label, value, tone }: { label: string; value: string; tone?: "good" | "warn" }) {
  const color =
    tone === "good" ? "var(--positive)" : tone === "warn" ? "var(--review)" : "var(--text-hi)";
  return (
    <div className="panel p-4">
      <div className="label-tech">{label}</div>
      <div className="stat-figure mt-1 text-2xl" style={{ color }}>
        {value}
      </div>
    </div>
  );
}

function Signal({
  name,
  value,
  unit,
  detail,
}: {
  name: string;
  value: number | boolean | null;
  unit?: string;
  detail?: string;
}) {
  /*
    Null is shown as "not known", never as 0.

    They mean opposite things — "you have never studied" against "you
    studied today" — and a table that renders both as a dash is how a
    missing emitter gets mistaken for a working one.
  */
  const missing = value === null;
  return (
    <tr>
      <td className="w-[240px] px-4 py-2.5 align-top">
        <span className="data-mono text-xs text-text-dim">{name}</span>
      </td>
      <td className="px-4 py-2.5 align-top">
        {missing ? (
          <span className="flex items-center gap-1.5 text-text-faint">
            <Minus className="size-3.5" /> not known
          </span>
        ) : typeof value === "boolean" ? (
          <span className={value ? "flex items-center gap-1.5 text-positive" : "flex items-center gap-1.5 text-text-dim"}>
            {value ? <Check className="size-3.5" /> : <X className="size-3.5" />}
            {String(value)}
          </span>
        ) : (
          <span className="data-mono text-text-hi">
            {value}
            {unit && <span className="ml-1 text-xs text-text-faint">{unit}</span>}
          </span>
        )}
        {detail && <div className="mt-0.5 text-xs leading-relaxed text-text-faint">{detail}</div>}
      </td>
    </tr>
  );
}

function CandidateRow({
  c,
  rank,
  inTopThree,
}: {
  c: ScoredCandidate;
  rank: number;
  inTopThree: boolean;
}) {
  const pct = Math.min(100, Math.round((c.action.score / 100) * 100));
  const color = c.surfaced ? "var(--signal)" : "var(--text-faint)";

  return (
    <div className={`panel p-4 ${c.surfaced ? "" : "opacity-70"}`}>
      <div className="flex flex-wrap items-baseline gap-2">
        <span className="data-mono text-xs text-text-faint">{String(rank + 1).padStart(2, "0")}</span>
        <span className="font-medium text-text-hi">{c.action.title}</span>
        <span className="chip data-mono">{c.action.kind}</span>
        {inTopThree && <span className="chip chip-signal">on screen</span>}
        {c.halved && <span className="chip">halved · dismissed</span>}
        {c.dropped && <span className="chip">{c.dropped.replace(/-/g, " ")}</span>}
        <span className="ml-auto data-mono text-sm text-text-hi">
          {c.action.score}
          {c.halved && <span className="ml-1 text-xs text-text-faint">was {c.rawScore}</span>}
        </span>
      </div>

      {/* The floor, drawn where it actually sits. */}
      <div className="relative mt-2 h-1.5 overflow-hidden rounded-full bg-ink-800">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
        <span
          className="absolute top-0 h-full w-px bg-line-strong"
          style={{ left: `${SURFACE_FLOOR}%` }}
          aria-hidden
        />
      </div>

      <p className="mt-2 text-sm leading-relaxed text-text-dim">{c.action.reason}</p>

      {c.action.sources.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
          {c.action.sources.map((token) => {
            const phrase = describeSource(parseSource(token));
            return (
              <span key={token} className="text-xs">
                <span className="data-mono text-text-faint">{token}</span>
                <span className="mx-1 text-text-faint">→</span>
                {/*
                  An untranslated token would render as "GOAL g1" under
                  "why this?" on the Locker. Flagging it here is cheaper
                  than finding it there.
                */}
                <span className={phrase ? "text-text-dim" : "text-review"}>
                  {phrase ?? "no phrase — would be dropped"}
                </span>
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}

function StatusChip({ status }: { status: string }) {
  const color =
    status === "active"
      ? "var(--signal-bright)"
      : status === "completed"
        ? "var(--positive)"
        : "var(--text-faint)";
  return (
    <span className="chip data-mono" style={{ color }}>
      {status}
    </span>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="label-tech px-4 py-2 font-normal">{children}</th>;
}

function Td({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-4 py-2.5 ${className}`}>{children}</td>;
}

/** Short, sortable, and unambiguous at a glance. */
function stamp(iso: string): string {
  return iso.replace("T", " ").slice(5, 16);
}
