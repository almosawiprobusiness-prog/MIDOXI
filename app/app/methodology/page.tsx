import { BookMarked, Sparkles, Info } from "lucide-react";
import { listMethodology } from "@/lib/data/club";
import { METHODOLOGY_DOCS, methodologyStatus } from "@/lib/data/club-types";
import { isDemoMode } from "@/lib/env";
import { PageHeader, StatBand } from "@/components/ui/kit";
import { DemoNote } from "@/components/dashboards/shared";
import { SectionForm, SectionControls } from "@/components/club/methodology-editor";
import { requireRole, viewingFromOtherOs } from "@/lib/auth/guard";
import { ROLES } from "@/lib/roles/roles";
import { OsNotice } from "@/components/shell/os-notice";

export const metadata = { title: "Club methodology — MIDO XI" };

export default async function MethodologyPage() {
  /* Club OS. `requireRole` is the entitlement gate; being in another
     system is only context, so that is a notice rather than a refusal —
     see lib/auth/guard.ts. */
  const user = await requireRole("club");
  const elsewhere = viewingFromOtherOs(user, "club");

  const sections = await listMethodology();
  const status = methodologyStatus(sections);

  return (
    <div className="mx-auto max-w-[1100px] px-4 py-8 md:px-6">
      {elsewhere && <OsNotice role="club" label={ROLES.club.label} />}

      <PageHeader
        icon={BookMarked}
        title="Club methodology"
        tagline="How we play. How we train. How we develop players."
      />

      <section className="mb-6">
        <StatBand
          cols={4}
          stats={[
            { label: "Documents started", value: `${status.documentsStarted}/3` },
            { label: "Sections", value: sections.length },
            { label: "Principles", value: status.principles, hint: "What MIDO actually reads" },
            {
              label: "Applied to",
              value: status.principles > 0 ? "Sessions" : "—",
              hint: "Where the methodology is in use today",
            },
          ]}
        />
      </section>

      <div className="panel-raised relative mb-8 overflow-hidden">
        <div className="field-glow absolute inset-0" aria-hidden />
        <div className="relative flex items-start gap-3 p-5">
          <Sparkles className="mt-0.5 size-4 shrink-0 text-signal-bright" />
          <p className="text-sm leading-relaxed text-text-dim">
            {status.principles > 0 ? (
              <>
                <span className="text-text-hi">{status.principles} principles are live.</span> When a coach
                in this club drafts a session, MIDO writes it inside them — the coaching points carry your
                principles, not generic best practice.
              </>
            ) : (
              <>
                Nothing written yet. Until it is, MIDO answers coaches generically. Write your principles
                and the same request returns <span className="text-text-hi">your club&rsquo;s</span> session
                instead.
              </>
            )}
          </p>
        </div>
      </div>

      <div className="space-y-10">
        {METHODOLOGY_DOCS.map((doc) => {
          const rows = sections.filter((s) => s.doc === doc.doc);
          return (
            <section key={doc.doc}>
              <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
                <div>
                  <div className="label-tech" style={{ color: doc.color }}>
                    {rows.length} section{rows.length === 1 ? "" : "s"}
                  </div>
                  <h2 className="font-display text-2xl font-bold tracking-tight text-text-hi">
                    {doc.title}
                  </h2>
                  <p className="mt-0.5 text-sm text-text-dim">{doc.tagline}</p>
                </div>
                <SectionForm doc={doc.doc} mode="create" suggested={doc.suggested} />
              </div>

              {rows.length === 0 ? (
                <div className="panel p-5">
                  <p className="text-sm leading-relaxed text-text-dim">
                    Nothing here yet. Sections a club usually starts with:
                  </p>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {doc.suggested.map((s) => (
                      <span key={s} className="chip">
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {rows.map((s, i) => (
                    <article key={s.id} className="panel overflow-hidden">
                      <div
                        className="flex flex-wrap items-center gap-2.5 border-b border-line px-4 py-3"
                        style={{ borderLeft: `3px solid ${doc.color}` }}
                      >
                        <span className="data-mono text-[11px] text-signal">
                          {String(i + 1).padStart(2, "0")}
                        </span>
                        <h3 className="min-w-0 flex-1 truncate font-display text-base font-semibold text-text-hi">
                          {s.section}
                        </h3>
                        {s.ageGroup && <span className="chip">{s.ageGroup}</span>}
                        <div className="flex shrink-0 items-center gap-1">
                          <SectionForm doc={doc.doc} mode="edit" section={s} />
                          <SectionControls id={s.id} first={i === 0} last={i === rows.length - 1} />
                        </div>
                      </div>

                      <div className="p-4">
                        <ul className="space-y-2">
                          {s.principles.map((p, pi) => (
                            <li key={pi} className="flex items-start gap-2.5 text-sm leading-relaxed text-text">
                              <span
                                className="mt-1.5 size-1.5 shrink-0 rounded-full"
                                style={{ background: doc.color }}
                              />
                              {p}
                            </li>
                          ))}
                        </ul>
                        {s.detail && (
                          <p className="mt-3 border-t border-line pt-3 text-sm leading-relaxed text-text-dim">
                            {s.detail}
                          </p>
                        )}
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>
          );
        })}
      </div>

      <p className="mt-10 flex items-start gap-2 text-[11px] leading-relaxed text-text-faint">
        <Info className="mt-0.5 size-3.5 shrink-0" />
        MIDO never writes your methodology. It is the one part of the product that must come from the
        club — the AI only ever answers inside it.
      </p>

      {isDemoMode && (
        <DemoNote>
          Demo mode — a partially written methodology, so the effect on session drafting can be seen.
        </DemoNote>
      )}
    </div>
  );
}
