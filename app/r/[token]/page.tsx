import type { Metadata } from "next";
import { Lock } from "lucide-react";
import { countShareView, resolveShare } from "@/lib/reports/shares";
import { expiryLabel, shareKindLabel } from "@/lib/reports/share-types";
import { getMonthlyReport } from "@/lib/reports/monthly";
import { getTimeline } from "@/lib/data/timeline";
import { getProfileSettings } from "@/lib/data/profile";
import { periodLabel, periodRange } from "@/lib/reports/period";
import { plural } from "@/lib/data/timeline-types";
import { CONFIDENCE_META } from "@/lib/video/provider";
import { evidenceMeta } from "@/lib/data/development-types";
import { ReportShell, ReportSection, Stat } from "@/components/reports/report-shell";
import { PrintButton } from "@/components/reports/print-button";

/*
  A report, opened by somebody who is not signed in.

  This is the only page in MIDO XI a stranger can reach, and the token is the
  only credential. Everything about it is therefore narrower than the app's own
  report:

  · No navigation. There is nothing to click into, because the reader has
    permission to see one document and not an account.

  · noindex, nofollow, and no OG image. A share link should never end up in a
    search result — the player sent it to one person, not to the internet.

  · The fields come from the LINK, not from the player's current settings. A
    link made in August shows what was ticked in August, even if the defaults
    changed since.

  · Absent, expired and revoked all render the same page. Telling a stranger
    that a token "has expired" confirms it was once real.
*/

export const metadata: Metadata = {
  title: "Shared report — MIDO XI",
  robots: { index: false, follow: false, nocache: true },
};

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function NotValid() {
  return (
    <div className="mx-auto flex min-h-screen max-w-[520px] flex-col items-center justify-center px-4 text-center">
      <span className="grid size-12 place-items-center rounded-lg border border-line bg-ink-850 text-text-faint">
        <Lock className="size-5" />
      </span>
      <h1 className="mt-4 font-display text-xl font-bold text-text-hi">This link is not valid</h1>
      <p className="mt-2 text-sm leading-relaxed text-text-dim">
        Shared reports expire, and the player can withdraw one at any time. Ask them for a new link.
      </p>
      <p className="data-mono mt-6 text-xs text-text-faint">MIDO XI</p>
    </div>
  );
}

export default async function SharedReportPage({ params }: PageProps<"/r/[token]">) {
  const { token } = await params;
  const share = await resolveShare(token);
  if (!share) return <NotValid />;

  // After the decision to serve, never before — a counter is not worth an
  // error page in front of a coach.
  await countShareView(token);

  const show = (f: string) => share.fields.includes(f as never);
  const profile = await getProfileSettings(share.userId);

  const identity = [
    profile.primaryPosition,
    profile.club,
    profile.league,
    show("nationality") ? profile.nationality : null,
    show("physical") && profile.heightCm ? `${profile.heightCm}cm` : null,
    show("physical") && profile.weightKg ? `${profile.weightKg}kg` : null,
  ].filter(Boolean) as string[];

  const player = {
    name: profile.fullName,
    knownAs: profile.knownAs,
    avatarUrl: profile.avatarUrl,
    identity,
    transfermarktUrl: profile.transfermarktUrl || undefined,
  };

  const footer = (
    <p className="no-print mt-6 text-center text-xs leading-relaxed text-text-faint">
      Shared with you by {profile.knownAs || profile.fullName || "a player"} through MIDO XI ·{" "}
      {expiryLabel({ expiresAt: share.expiresAt, revokedAt: null })}
      <br />
      They chose what appears here, and can withdraw this link at any time.
    </p>
  );

  if (share.kind === "training") {
    const { from, to } = periodRange(share.ref);
    const view = await getTimeline({ from, to, kinds: ["training"], limit: 1000, forUser: share.userId });
    const minutes = view.entries.reduce((n, s) => n + (Number(s.meta.durationMin) || 0), 0);

    return (
      <div className="mx-auto max-w-[820px] px-4 py-8 md:px-6">
        <PrintButton title="Training report" detail={`${periodLabel(share.ref)} · shared with you`} />
        <ReportShell
          kind="Training report"
          title={profile.knownAs || profile.fullName || "Player"}
          subtitle={periodLabel(share.ref)}
          player={player}
        >
          <ReportSection label="The month">
            <div className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3">
              <Stat value={view.entries.length} label={plural(view.entries.length, "session")} />
              <Stat value={minutes} label={plural(minutes, "minute")} />
            </div>
          </ReportSection>
          <ReportSection label="Every session">
            <ul className="space-y-2">
              {[...view.entries].reverse().map((s) => (
                <li key={s.id} className="flex gap-3 text-sm">
                  <span className="data-mono w-14 shrink-0 text-xs text-text-dim">
                    {fmtDate(s.occurredAt)}
                  </span>
                  <span className="min-w-0 flex-1 text-text-hi">{s.title}</span>
                  <span className="data-mono shrink-0 text-xs text-text-dim">
                    {Number(s.meta.durationMin) || "—"}
                  </span>
                </li>
              ))}
            </ul>
          </ReportSection>
        </ReportShell>
        {footer}
      </div>
    );
  }

  /*
    Only kinds with a renderer may fall through. "film" is declared in
    ShareKind but has no creation UI and no renderer — before this
    guard, a film token would have fed a videoId into periodRange()
    and rendered a report of NaN. A token for an unrendered kind is
    served the same NotValid as an expired one.
  */
  if (share.kind !== "monthly") return <NotValid />;

  // Development report — the one a coach is most likely to be sent.
  const report = await getMonthlyReport(share.ref, share.userId);

  return (
    <div className="mx-auto max-w-[820px] px-4 py-8 md:px-6">
      <PrintButton
        title={shareKindLabel(share.kind)}
        detail={`${report.periodLabel} · shared with you`}
      />

      <ReportShell
        kind="Development report"
        title={report.player.knownAs || report.player.name || "Player"}
        subtitle={report.periodLabel}
        player={{ ...player, email: show("contact") ? report.player.email : undefined }}
      >
        {report.empty ? (
          <p className="py-8 text-sm leading-relaxed text-text-dim">
            Nothing was recorded in {report.periodLabel}.
          </p>
        ) : (
          <>
            <ReportSection label="The month">
              <div className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4">
                <Stat value={report.totals.matches} label={plural(report.totals.matches, "match", "matches")} />
                <Stat value={report.totals.minutes} label={plural(report.totals.minutes, "minute")} />
                <Stat value={report.totals.goals} label={plural(report.totals.goals, "goal")} />
                <Stat value={report.totals.assists} label={plural(report.totals.assists, "assist")} />
              </div>
            </ReportSection>

            <ReportSection label="Development">
              {report.goals.length === 0 ? (
                <p className="text-sm text-text-dim">No development goals were open this month.</p>
              ) : (
                <div className="space-y-4">
                  {report.goals.map(({ goal, evidence }) => (
                    <div key={goal.id}>
                      <div className="flex flex-wrap items-baseline gap-2">
                        <h3 className="text-sm font-semibold text-text-hi">{goal.title}</h3>
                        <span className="chip">{goal.category}</span>
                        <span className="data-mono ml-auto text-xs text-text-dim">
                          {evidence.length} this month
                        </span>
                      </div>
                      {goal.why && (
                        <p className="mt-1 text-sm leading-relaxed text-text-dim">{goal.why}</p>
                      )}
                      {evidence.length > 0 && (
                        <ul className="mt-2 space-y-1.5 border-l border-line pl-3">
                          {evidence.map((e, i) => (
                            <li key={i} className="flex gap-2.5 text-sm">
                              <span
                                className="data-mono shrink-0 text-[11px]"
                                style={{ color: evidenceMeta(e.kind as never).color }}
                              >
                                {fmtDate(e.createdAt)}
                              </span>
                              <span className="min-w-0 text-text-dim">{e.note}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </ReportSection>

            {show("matchLog") && report.matches.length > 0 && (
              <ReportSection label="Matches">
                <ul className="space-y-1.5">
                  {[...report.matches].reverse().map((m) => (
                    <li key={m.id} className="flex flex-wrap gap-x-3 text-sm">
                      <span className="data-mono w-14 shrink-0 text-xs text-text-dim">
                        {fmtDate(m.occurredAt)}
                      </span>
                      <span className="min-w-0 flex-1 text-text-hi">{m.title}</span>
                      <span className="data-mono shrink-0 text-xs text-text">
                        {Number(m.meta.minutes) || "—"} min
                      </span>
                    </li>
                  ))}
                </ul>
              </ReportSection>
            )}

            {show("filmObservations") && report.observations.length > 0 && (
              <ReportSection
                label="On film"
                note="MIDO&rsquo;s reading of the footage, not measurement"
              >
                <ul className="space-y-3">
                  {report.observations.slice(0, 20).map((o, i) => {
                    const meta = CONFIDENCE_META[o.confidence ?? "observed"];
                    return (
                      <li key={i} className="border-l border-line pl-3">
                        <div className="flex flex-wrap items-baseline gap-2">
                          <span className="data-mono text-[11px] text-text-dim">{fmtDate(o.on)}</span>
                          <span className="text-sm font-medium text-text-hi">{o.title}</span>
                          <span className="chip" style={{ color: meta.color }}>
                            {meta.label}
                          </span>
                        </div>
                        <p className="mt-1 text-sm leading-relaxed text-text-dim">{o.body}</p>
                      </li>
                    );
                  })}
                </ul>
                {/*
                  The legend prints, because once this is open on somebody
                  else's screen nothing explains what the words mean.
                */}
                <dl className="mt-4 space-y-1 border-t border-line pt-3">
                  {(["observed", "inferred", "uncertain"] as const)
                    .filter((l) => report.observations.some((o) => (o.confidence ?? "observed") === l))
                    .map((l) => (
                      <div key={l} className="flex gap-2.5 text-xs">
                        <dt className="w-20 shrink-0" style={{ color: CONFIDENCE_META[l].color }}>
                          {CONFIDENCE_META[l].label}
                        </dt>
                        <dd className="min-w-0 leading-relaxed text-text-faint">
                          {CONFIDENCE_META[l].hint}
                        </dd>
                      </div>
                    ))}
                </dl>
              </ReportSection>
            )}
          </>
        )}
      </ReportShell>

      {footer}
    </div>
  );
}
