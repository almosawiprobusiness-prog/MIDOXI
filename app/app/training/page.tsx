import Link from "next/link";
import { Dumbbell, Clock, Target, Plus, Gauge, FileText } from "lucide-react";
import { listTraining } from "@/lib/data/training";
import { isDemoMode } from "@/lib/env";
import { trainingMeta, TRAINING_KINDS } from "@/lib/data/training-types";
import type { TrainingEntry } from "@/lib/data/training-types";
import { SectionHeader } from "@/components/ui/primitives";
import { PageHeader, StatBand, MiniBars } from "@/components/ui/kit";
import { TrainingFormDialog } from "@/components/training/training-form-dialog";
import { GenerateSessionDialog } from "@/components/training/generate-session-dialog";
import { DeleteTrainingButton } from "@/components/training/delete-training-button";
import { SessionRunner } from "@/components/training/session-runner";
import { track } from "@/lib/analytics/track";

export const metadata = { title: "Training — MIDO XI" };

const DAY_LETTERS = ["M", "T", "W", "T", "F", "S", "S"];

function fmt(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("en-GB", { weekday: "short", day: "2-digit", month: "short" }) +
    " · " + d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}
function weekdayIdx(iso: string) {
  return (new Date(iso).getDay() + 6) % 7; // Mon=0
}
function isThisWeek(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const monday = new Date(now);
  monday.setHours(0, 0, 0, 0);
  monday.setDate(monday.getDate() - ((now.getDay() + 6) % 7));
  const sunday = new Date(monday);
  sunday.setDate(sunday.getDate() + 7);
  return d >= monday && d < sunday;
}

function SessionRow({ e }: { e: TrainingEntry }) {
  const meta = trainingMeta(e.kind);
  return (
    <div className="panel flex items-start gap-3 p-4">
      <span className="mt-0.5 size-2.5 shrink-0 rounded-full" style={{ background: meta.color }} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-text-hi">{e.title}</span>
          <span className="label-tech" style={{ color: meta.color }}>{meta.label}</span>
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-text-dim">
          <span>{fmt(e.scheduledAt)}</span>
          {e.durationMin ? <span className="flex items-center gap-1"><Clock className="size-3" />{e.durationMin}m</span> : null}
          {e.rpe != null ? <span className="flex items-center gap-1"><Gauge className="size-3" />RPE {e.rpe}</span> : null}
        </div>
        {e.objective ? (
          <div className="mt-1.5 flex items-center gap-1.5 text-xs text-text">
            <Target className="size-3 text-text-faint" /> {e.objective}
          </div>
        ) : null}
        {/*
          Why this session exists at all. A player opening it on Thursday
          should not have to remember what Sunday's film said.
        */}
        {e.builtFrom ? (
          <div className="mt-2 flex flex-wrap items-baseline gap-x-2 border-l-2 border-signal-line pl-2.5 text-xs">
            <span className="label-tech !text-text-faint">Built from</span>
            <span className="text-text">{e.builtFrom.label}</span>
          </div>
        ) : null}
        {e.plan?.length ? (
          <div className="mt-2 space-y-1 border-t border-line pt-2">
            {e.plan.map((b, i) => (
              <div key={i} className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-xs">
                <span className="text-text">{b.name}</span>
                <span className="data-mono text-text-faint">{b.work}</span>
                {b.source ? <span className="text-[10px] uppercase tracking-wide text-signal-bright">{b.source}</span> : null}
                {b.why ? (
                  <span className="basis-full text-[11px] leading-relaxed text-text-faint">{b.why}</span>
                ) : null}
              </div>
            ))}
          </div>
        ) : null}
        {(e.improved || e.feltOff) && (
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 border-t border-line pt-2 text-xs">
            {e.improved ? <span className="text-positive">↑ {e.improved}</span> : null}
            {e.feltOff ? <span className="text-review">! {e.feltOff}</span> : null}
          </div>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        {e.plan?.length ? <SessionRunner entry={e} /> : null}
        {e.plan?.length ? (
          <Link
            href={`/app/reports/session/${e.id}`}
            aria-label={`Print the plan for ${e.title}`}
            title="Session plan — print / save as PDF"
            className="grid size-8 place-items-center rounded-md border border-line text-text-dim transition-colors hover:border-signal-line hover:text-signal-bright"
          >
            <FileText className="size-3.5" />
          </Link>
        ) : null}
        <TrainingFormDialog mode="edit" entry={e} />
        <DeleteTrainingButton id={e.id} title={e.title} />
      </div>
    </div>
  );
}

export default async function TrainingPage({
  searchParams,
}: {
  searchParams?: Promise<{ focus?: string; src?: string }>;
}) {
  const params = await searchParams;
  const focus = params?.focus ?? null;
  /*
    Arriving with a `capture:` focus IS the Capture → Training handoff —
    the extension (or the post-checkout return) landed the player here
    with a saved lesson to train. Counted before entitlement gates so
    "handed off but never generated" is visible in the funnel. The id
    stays out of props; `via` is a closed enum.
  */
  if (focus?.startsWith("capture:")) {
    await track("capture_training_handoff_opened", {
      via: params?.src === "post_checkout" ? "post_checkout" : "extension",
    });
  }
  const entries = await listTraining();
  const week = entries.filter((e) => isThisWeek(e.scheduledAt));
  const earlier = entries.filter((e) => !isThisWeek(e.scheduledAt));
  const weekMinutes = week.reduce((a, e) => a + (e.durationMin || 0), 0);
  const rpeVals = week.map((e) => e.rpe).filter((v): v is number => v != null);
  const rpeLoad = rpeVals.reduce((a, v) => a + v, 0);
  const avgRpe = rpeVals.length ? (rpeLoad / rpeVals.length).toFixed(1) : "–";

  // Minutes per weekday, this week.
  const dayLoad = DAY_LETTERS.map((label, i) => ({
    label,
    value: week.filter((e) => weekdayIdx(e.scheduledAt) === i).reduce((a, e) => a + (e.durationMin || 0), 0),
  }));

  // Session-type distribution (all-time), highest first.
  const typeBreakdown = TRAINING_KINDS
    .map((k) => ({ ...k, count: entries.filter((e) => e.kind === k.kind).length }))
    .filter((k) => k.count > 0)
    .sort((a, b) => b.count - a.count);
  const maxType = Math.max(...typeBreakdown.map((t) => t.count), 1);

  return (
    <div className="mx-auto max-w-[1000px] px-4 py-8 md:px-6">
      <PageHeader
        icon={Dumbbell}
        title="Training"
        tagline="Sessions, load and how you felt."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <GenerateSessionDialog initialFocus={focus} />
            <TrainingFormDialog mode="create" />
          </div>
        }
        photo="soloStrike"
        kicker="The work between matches"
      />

      {entries.length > 0 ? (
        <>
          <section className="mb-6">
            <StatBand
              cols={4}
              stats={[
                { label: "Sessions · week", value: week.length },
                { label: "Minutes · week", value: weekMinutes },
                { label: "RPE load", value: rpeLoad, hint: "Sum of session RPE this week" },
                { label: "Avg RPE", value: avgRpe },
              ]}
            />
          </section>

          <div className="mb-6 grid gap-4 lg:grid-cols-2">
            <section className="relative min-w-0 overflow-hidden rounded-xl border border-signal-line bg-gradient-to-b from-signal/10 via-ink-900 to-ink-900 p-5">
              <div className="mb-3 flex items-baseline justify-between gap-3">
                <span className="label-tech !text-signal-bright">Load this week / 01</span>
                <span className="label-tech">minutes / day</span>
              </div>
              <MiniBars data={dayLoad} className="h-28" />
            </section>
            <section className="panel p-5">
              <div className="label-tech mb-3">Session mix</div>
              <div className="space-y-2.5">
                {typeBreakdown.map((t) => (
                  <div key={t.kind} className="flex items-center gap-3">
                    <span className="w-20 shrink-0 text-xs text-text-dim">{t.label}</span>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-ink-800">
                      <div className="h-full rounded-full" style={{ width: `${(t.count / maxType) * 100}%`, background: t.color }} />
                    </div>
                    <span className="data-mono w-5 shrink-0 text-right text-xs text-text">{t.count}</span>
                  </div>
                ))}
              </div>
            </section>
          </div>

          {week.length > 0 && (
            <section className="mb-6">
              <SectionHeader label={`This week · ${week.length}`} />
              <div className="space-y-2">{week.map((e) => <SessionRow key={e.id} e={e} />)}</div>
            </section>
          )}

          {earlier.length > 0 && (
            <section>
              <SectionHeader label={`Earlier · ${earlier.length}`} />
              <div className="space-y-2">{earlier.map((e) => <SessionRow key={e.id} e={e} />)}</div>
            </section>
          )}
        </>
      ) : (
        <div className="panel flex flex-col items-center justify-center px-6 py-16 text-center">
          <span className="grid size-12 place-items-center rounded-xl border border-line bg-ink-850 text-signal-bright"><Plus className="size-6" /></span>
          <h3 className="mt-4 font-display text-lg font-semibold text-text-hi">No sessions logged yet</h3>
          <p className="mt-1.5 max-w-sm text-sm text-text-dim">Log a session — the type, what you worked on, and how it felt. Load builds your week.</p>
          <div className="mt-5"><TrainingFormDialog mode="create" /></div>
        </div>
      )}

      {isDemoMode && entries.length > 0 && (
        <p className="mt-6 flex items-center justify-center gap-2 text-[11px] text-text-faint">
          <span className="size-1.5 rounded-full bg-review" /> Demo mode — changes persist for this session only.
        </p>
      )}
    </div>
  );
}
