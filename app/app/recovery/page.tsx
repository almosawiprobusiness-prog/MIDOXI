import { HeartPulse, Activity, Info, MessageSquare } from "lucide-react";
import { getRecovery } from "@/lib/data/recovery";
import { listConnections, listRecoverySamples, nextFixture } from "@/lib/data/wearables";
import { hasWhoop } from "@/lib/env";
import { WearablePanel } from "@/components/recovery/wearable-panel";
import {
  BAND_META,
  CHECKIN_FIELDS,
  NOT_MEASURED,
  bandOf,
  type ScoredCheckin,
} from "@/lib/data/recovery-types";
import { SectionHeader } from "@/components/ui/primitives";
import { PageHeader, MiniBars, Radial } from "@/components/ui/kit";
import { DemoNote, EmptyState } from "@/components/dashboards/shared";

export const metadata = { title: "Recovery — MIDO XI" };

/*
  Four self-reported scores, and a readiness figure derived from them by an
  arithmetic the player can follow.

  This page used to show HRV in milliseconds, resting heart rate, hydration in
  litres and a six-region soreness map — none of which exist in the schema or
  can be entered anywhere in MIDO. A player deciding whether to train was
  reading invented physiology. What is here now is smaller, and true.
*/

function dayLabel(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { weekday: "short" });
}

function readyColor(v: number) {
  return v >= 75 ? "var(--positive)" : v >= 55 ? "var(--signal)" : "var(--review)";
}

function fieldColor(value: number, inverted: boolean) {
  const good = inverted ? 6 - value : value;
  return good >= 4 ? "var(--positive)" : good >= 3 ? "var(--signal)" : "var(--review)";
}

export default async function RecoveryPage({ searchParams }: PageProps<"/app/recovery">) {
  const { whoop } = await searchParams;
  const [{ source, days, today, streak }, connections, samples, fixture] = await Promise.all([
    getRecovery(),
    listConnections(),
    listRecoverySamples(14),
    nextFixture(),
  ]);
  const whoopConnection = connections.find((c) => c.provider === "whoop") ?? null;
  /*
    Once a strap is connected these ARE measured, so the section below
    must stop saying they are not. A page that keeps insisting HRV is
    unavailable while showing an HRV reading is worse than either claim
    on its own.
  */
  const measuring = Boolean(whoopConnection) && samples.length > 0;
  const band = bandOf(today?.readiness ?? null);
  const meta = BAND_META[band];
  const scored = days.filter((d): d is ScoredCheckin & { readiness: number } => d.readiness !== null);
  const notes = days.filter((d) => d.note).slice(-4).reverse();

  return (
    <div className="mx-auto max-w-[1100px] px-4 py-8 md:px-6">
      <PageHeader
        icon={HeartPulse}
        title="Recovery"
        tagline="How you said you feel, and what it adds up to."
      />

      {source === "demo" && (
        <div className="mb-6">
          <DemoNote>
            A seeded week of check-ins — the same four scores the real product records, nothing a
            wearable would be needed for.
          </DemoNote>
        </div>
      )}

      {!today ? (
        <EmptyState
          icon={HeartPulse}
          title="No check-ins yet"
          body="Recovery is built entirely from your daily check-in — energy, sleep, soreness and how your head is. Record one and readiness appears. MIDO will not estimate it for you."
          action={{ label: "Check in", href: "/app/training" }}
        />
      ) : (
        <>
          {/* Today */}
          <div className="mb-8 grid gap-4 lg:grid-cols-[320px_1fr]">
            <section className="min-w-0 panel-raised relative flex items-center gap-5 overflow-hidden p-5">
              <div className="field-glow absolute inset-0" aria-hidden />
              <Radial
                value={today.readiness ?? 0}
                sub="readiness"
                color={meta.color}
                size={128}
              />
              <div className="relative min-w-0">
                <div className="label-tech">Last check-in</div>
                <div className="mt-1 font-display text-2xl font-bold" style={{ color: meta.color }}>
                  {meta.label}
                </div>
                <p className="mt-1 text-xs leading-relaxed text-text-dim">{meta.advice}</p>
              </div>
            </section>

            <section className="min-w-0">
              <div className="min-w-0 panel space-y-3.5 p-5">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="label-tech">What you reported</span>
                  <span className="label-tech">{dayLabel(today.date)}</span>
                </div>
                {CHECKIN_FIELDS.map((f) => {
                  const v = today[f.key];
                  return (
                    <div key={f.key}>
                      <div className="mb-1.5 flex items-center justify-between gap-3 text-sm">
                        <span className="text-text-dim">{f.label}</span>
                        <span className="data-mono shrink-0 text-text">
                          {v === null ? "—" : `${v}/5`}
                        </span>
                      </div>
                      <div className="flex gap-1">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <span
                            key={i}
                            className="h-1.5 flex-1 rounded-full"
                            style={{
                              background:
                                v !== null && i < v ? fieldColor(v, f.inverted) : "var(--ink-800)",
                            }}
                          />
                        ))}
                      </div>
                      <div className="mt-1 flex justify-between text-[10px] text-text-faint">
                        <span>{f.low}</span>
                        <span>{f.high}</span>
                      </div>
                    </div>
                  );
                })}
                <p className="border-t border-line pt-3 text-xs leading-relaxed text-text-faint">
                  Readiness is the average of these four, with soreness flipped, mapped onto 0–100.
                  Deliberately simple — a number about your own body should be one you can check.
                </p>
              </div>
            </section>
          </div>

          {/* Trend */}
          {scored.length > 1 && (
            <section className="mb-8">
              <SectionHeader label={`Readiness · last ${scored.length} check-ins`} />
              <div className="min-w-0 panel p-5">
                <div className="mb-2 flex items-center gap-2">
                  <Activity className="size-3.5 text-signal-bright" />
                  <span className="label-tech">
                    {streak.reported} of the last {streak.of} days reported
                  </span>
                </div>
                <MiniBars
                  data={scored.map((d) => ({ label: dayLabel(d.date), value: d.readiness }))}
                  className="h-24"
                  colorFor={readyColor}
                />
                <p className="mt-3 text-xs leading-relaxed text-text-faint">
                  Gaps are days you did not check in, not days you felt nothing. The trend is worth
                  more than any single day.
                </p>
              </div>
            </section>
          )}

          {/* What you wrote */}
          {notes.length > 0 && (
            <section className="mb-8">
              <SectionHeader label="In your own words" />
              <div className="min-w-0 panel divide-y divide-line">
                {notes.map((d) => (
                  <div key={d.date} className="flex items-start gap-3 p-4">
                    <MessageSquare className="mt-0.5 size-4 shrink-0 text-text-faint" />
                    <div className="min-w-0">
                      <div className="label-tech">{dayLabel(d.date)}</div>
                      <p className="mt-0.5 text-sm leading-relaxed text-text-dim">{d.note}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </>
      )}

      {/* Wearables */}
      <section className="mb-8">
        <SectionHeader label="Measured" />
        <WearablePanel
          connection={whoopConnection}
          samples={samples}
          configured={hasWhoop}
          notice={typeof whoop === "string" ? whoop : undefined}
          fixture={fixture}
        />
      </section>

      {/* What MIDO does not measure — only while nothing is measuring it */}
      {!measuring && (
      <section>
        <SectionHeader label="What MIDO does not measure" />
        <div className="min-w-0 panel p-5">
          <div className="flex items-start gap-3">
            <Info className="mt-0.5 size-4 shrink-0 text-info" />
            <div className="min-w-0">
              <p className="text-sm leading-relaxed text-text-dim">{NOT_MEASURED.why}</p>
              <p className="mt-2 text-sm leading-relaxed text-text-faint">
                Would need: {NOT_MEASURED.wouldNeed}
              </p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {NOT_MEASURED.metrics.map((m) => (
                  <span key={m} className="chip">
                    {m}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>
      )}
    </div>
  );
}
