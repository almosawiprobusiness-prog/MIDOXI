"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Activity, AlertTriangle, Loader2, Plug, RefreshCw, Unplug } from "lucide-react";
import {
  BAND_LABEL,
  formatSleep,
  hasAnyMetric,
  recoveryBand,
  recoveryContext,
  sleepDebtMin,
  type Connection,
  type RecoverySample,
} from "@/lib/health/providers";
import { disconnectWearable, syncWearable } from "@/app/app/recovery/wearable-actions";
import { cn } from "@/lib/utils";

/*
  Measured physiology, kept visibly apart from what the player reports.

  The four self-reported scores and a WHOOP HRV reading are different
  kinds of fact. They are never averaged into one number here — the
  Recovery page was rebuilt precisely because it used to show HRV,
  resting heart rate and hydration that nothing measured, and blending
  a real reading with a typed-in feeling would be the same fiction with
  better provenance.

  Every metric renders only when it exists. A device can score a night
  UNSCORED, and a resting heart rate of 0bpm on a page somebody uses to
  decide whether to train is worse than a blank.
*/

/*
  WHOOP's own banding, so a score that is green in their app is green
  here. A player seeing the same number called two different things in
  two places stops trusting both.
*/
const BAND_TEXT = {
  high: "text-positive",
  moderate: "text-review",
  low: "text-correction",
} as const;

const BAND_CHIP = {
  high: "border-positive/40 bg-positive/10 text-positive",
  moderate: "border-review/40 bg-review/10 text-review",
  low: "border-correction/40 bg-correction/10 text-correction",
} as const;

const MESSAGES: Record<string, { tone: "ok" | "bad"; text: string }> = {
  connected: { tone: "ok", text: "WHOOP connected. Your last 30 days have been pulled in." },
  syncfailed: { tone: "bad", text: "WHOOP connected, but the first sync failed. Try Sync now." },
  denied: { tone: "bad", text: "You cancelled at WHOOP, so nothing was connected." },
  state: { tone: "bad", text: "That sign-in could not be verified. Start again from this page." },
  incomplete: { tone: "bad", text: "WHOOP sent an incomplete response. Try again." },
  save: { tone: "bad", text: "The connection could not be saved." },
  failed: { tone: "bad", text: "WHOOP would not complete the connection." },
  unconfigured: { tone: "bad", text: "WHOOP is not configured on this deployment." },
};

export function WearablePanel({
  connection,
  samples,
  configured,
  notice,
  fixture = null,
}: {
  connection: Connection | null;
  samples: RecoverySample[];
  configured: boolean;
  notice?: string;
  /** The next match, so the score can be said in football terms. */
  fixture?: { opponent: string; daysAway: number } | null;
}) {
  const router = useRouter();
  const [msg, setMsg] = useState<{ tone: "ok" | "bad"; text: string } | null>(
    notice ? (MESSAGES[notice] ?? null) : null,
  );
  const [pending, start] = useTransition();

  const run = (fn: () => Promise<{ ok: boolean; message?: string; error?: string }>) =>
    start(async () => {
      const res = await fn();
      setMsg(res.ok ? { tone: "ok", text: res.message ?? "Done." } : { tone: "bad", text: res.error ?? "Failed." });
      router.refresh();
    });

  const latest = samples.find(hasAnyMetric) ?? null;
  const band = latest ? recoveryBand(latest.recoveryScore) : null;
  const context = latest ? recoveryContext(latest.recoveryScore, fixture) : null;

  return (
    <div className="min-w-0 panel p-5">
      {msg && (
        <p
          className={cn(
            "mb-4 rounded-lg border px-3 py-2 text-sm",
            msg.tone === "ok"
              ? "border-positive/40 bg-positive/10 text-positive"
              : "border-correction/40 bg-correction/10 text-correction",
          )}
        >
          {msg.text}
        </p>
      )}

      {!connection ? (
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-sm text-text-hi">Connect a WHOOP strap</p>
            <p className="mt-1 max-w-prose text-sm leading-relaxed text-text-dim">
              Recovery, HRV, resting heart rate, sleep and strain — measured, and kept separate
              from how you say you feel.
            </p>
            {!configured && (
              /*
                Said out loud rather than shown as a button that dead-ends
                on WHOOP's error page.
              */
              <p className="mt-2 text-xs text-text-faint">
                Not available on this deployment yet — it needs WHOOP API credentials.
              </p>
            )}
          </div>
          {configured && (
            <a
              href="/api/wearables/whoop/authorize"
              className="flex h-10 shrink-0 items-center gap-2 rounded-lg border border-signal-line bg-signal/10 px-4 text-sm font-medium text-signal-bright transition-colors hover:bg-signal/20"
            >
              <Plug className="size-4" />
              Connect WHOOP
            </a>
          )}
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <Activity className="size-4 text-signal" />
                <span className="text-sm font-medium text-text-hi">WHOOP</span>
                {connection.status !== "active" && (
                  <span className="rounded-full border border-correction/40 bg-correction/10 px-2 py-0.5 text-[10px] text-correction">
                    {connection.status === "expired" ? "Needs reconnecting" : "Disconnected"}
                  </span>
                )}
              </div>
              <p className="mt-1 data-mono text-[11px] text-text-faint">
                {connection.lastSyncAt
                  ? `Last synced ${new Date(connection.lastSyncAt).toLocaleString("en-GB", { timeZone: "UTC", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })} UTC`
                  : "Not synced yet"}
              </p>
            </div>

            <div className="flex shrink-0 gap-2">
              <button
                onClick={() => run(syncWearable)}
                disabled={pending}
                className="flex h-9 items-center gap-2 rounded-lg border border-line px-3 text-sm text-text-dim transition-colors hover:border-signal-line hover:text-text disabled:opacity-50"
              >
                {pending ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
                Sync now
              </button>
              <button
                onClick={() => run(disconnectWearable)}
                disabled={pending}
                className="flex h-9 items-center gap-2 rounded-lg border border-line px-3 text-sm text-text-dim transition-colors hover:border-correction hover:text-correction disabled:opacity-50"
              >
                <Unplug className="size-4" />
                Disconnect
              </button>
            </div>
          </div>

          {/*
            A wearable that quietly stopped syncing is worse than one that
            was never connected, so the reason is shown rather than logged.
          */}
          {connection.lastError && (
            <p className="mt-3 flex items-start gap-2 text-xs text-correction">
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
              {connection.lastError}
            </p>
          )}

          {latest ? (
            <>
              <p className="label-tech mt-5 mb-2 text-text-faint">
                Measured — {new Date(latest.day).toLocaleDateString("en-GB", { timeZone: "UTC", weekday: "long", day: "numeric", month: "short" })}
              </p>

              {/*
                One number, one colour, one sentence — then everything
                else, quieter, underneath.

                This was six equal-weight tiles, which is the pattern
                wearable apps get criticised for: a player opening this
                before training had to read and rank six numbers to
                answer one question. WHOOP and Oura both lead with a
                single banded score because it answers that question
                without being read twice.
              */}
              {band ? (
                <div className="flex flex-wrap items-end gap-x-5 gap-y-2">
                  <div className="flex items-baseline gap-2">
                    <span className={cn("font-display text-5xl font-bold leading-none", BAND_TEXT[band])}>
                      {latest.recoveryScore}
                    </span>
                    <span className="text-lg text-text-dim">%</span>
                  </div>
                  <span
                    className={cn(
                      "mb-1 rounded-full border px-2.5 py-1 text-xs font-medium",
                      BAND_CHIP[band],
                    )}
                  >
                    {BAND_LABEL[band]}
                  </span>
                </div>
              ) : (
                <p className="text-sm text-text-dim">
                  No recovery score for this night — WHOOP did not score it.
                </p>
              )}

              {context && (
                <p className="mt-2.5 max-w-prose text-sm leading-relaxed text-text">{context}</p>
              )}

              {/*
                The raw numbers still matter to anyone who wants them —
                demoted, not deleted.
              */}
              <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
                <Metric label="HRV" value={latest.hrvMs} suffix="ms" round={0} />
                <Metric label="Resting HR" value={latest.restingHr} suffix="bpm" />
                <Metric
                  label="Sleep"
                  text={formatSleep(latest.sleepDurationMin)}
                  note={
                    latest.sleepNeedMin !== null
                      ? `of ${formatSleep(latest.sleepNeedMin)} needed`
                      : null
                  }
                />
                <Metric label="Blood oxygen" value={latest.spo2Percent} suffix="%" round={1} />
                <Metric label="Strain" value={latest.strain} round={1} />
              </div>

              {sleepDebtMin(latest) !== null && sleepDebtMin(latest)! > 0 && (
                /*
                  Stated as the arithmetic, not as a verdict. "Insufficient"
                  is a word no device reported.
                */
                <p className="mt-3 text-xs text-text-dim">
                  {formatSleep(sleepDebtMin(latest))} short of what WHOOP calculated you needed.
                </p>
              )}
            </>
          ) : (
            <p className="mt-5 text-sm text-text-dim">
              Nothing measured yet. WHOOP returns data once you have worn the strap overnight.
            </p>
          )}
        </>
      )}
    </div>
  );
}

function Metric({
  label,
  value,
  text,
  suffix,
  note,
  round = 0,
}: {
  label: string;
  value?: number | null;
  text?: string | null;
  suffix?: string;
  note?: string | null;
  round?: number;
}) {
  const shown = text ?? (value === null || value === undefined ? null : value.toFixed(round));
  return (
    <div className="rounded-lg border border-line bg-ink-850 px-3 py-2.5">
      <p className="label-tech text-text-faint">{label}</p>
      {shown === null ? (
        // Absent, not zero.
        <p className="mt-1 text-sm text-text-faint">Not measured</p>
      ) : (
        <p className="mt-1 font-display text-xl font-bold text-text-hi">
          {shown}
          {suffix && <span className="ml-0.5 text-sm font-normal text-text-dim">{suffix}</span>}
        </p>
      )}
      {note && shown !== null && <p className="mt-0.5 text-[11px] text-text-dim">{note}</p>}
    </div>
  );
}
