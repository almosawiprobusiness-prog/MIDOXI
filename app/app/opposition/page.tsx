import Link from "next/link";
import { Radar, ArrowUpRight, Eye } from "lucide-react";
import { listOppositionReports } from "@/lib/data/coach";
import { observationCount } from "@/lib/data/coach-types";
import { isDemoMode } from "@/lib/env";
import { PageHeader, StatBand } from "@/components/ui/kit";
import { EmptyState, DemoNote } from "@/components/dashboards/shared";
import { OppositionForm } from "@/components/coach/opposition-form";

export const metadata = { title: "Opposition — MIDO XI" };

export default async function OppositionPage() {
  const reports = await listOppositionReports();
  const withPlan = reports.filter((r) => r.plan);
  const observations = reports.reduce((s, r) => s + observationCount(r), 0);

  return (
    <div className="mx-auto max-w-[1100px] px-4 py-8 md:px-6">
      <PageHeader
        icon={Radar}
        title="Opposition"
        tagline="What they do, and what we do about it."
        actions={<OppositionForm mode="create" />}
      />

      {reports.length === 0 ? (
        <EmptyState
          icon={Radar}
          title="No reports yet"
          body="Record what you have actually seen — shape, tendencies, key players, weaknesses. MIDO turns your observations into a match plan, and will not invent scouting you did not record."
          action={{ label: "Back to the Touchline", href: "/app" }}
        />
      ) : (
        <>
          <section className="mb-8">
            <StatBand
              cols={3}
              stats={[
                { label: "Reports", value: reports.length },
                { label: "Observations", value: observations },
                { label: "Match plans", value: `${withPlan.length}/${reports.length}` },
              ]}
            />
          </section>

          <div className="space-y-2">
            {reports.map((r) => {
              const count = observationCount(r);
              return (
                <Link
                  key={r.id}
                  href={`/app/opposition/${r.id}`}
                  className="group panel flex flex-wrap items-center gap-3 p-4 transition-colors hover:border-signal-line"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="truncate text-sm font-medium text-text-hi">{r.opponent}</span>
                      {r.formation && <span className="chip !px-1.5 !py-0">{r.formation}</span>}
                      {r.home !== null && (
                        <span className="label-tech">{r.home ? "Home" : "Away"}</span>
                      )}
                      {r.plan && <span className="chip chip-signal !px-1.5 !py-0">plan ready</span>}
                    </div>
                    <p className="mt-0.5 text-xs text-text-dim">
                      {r.competition || "No competition set"}
                      {r.matchDate &&
                        ` · ${new Date(r.matchDate).toLocaleDateString("en-GB", {
                          day: "numeric",
                          month: "short",
                        })}`}
                    </p>
                  </div>
                  <span className="chip flex shrink-0 items-center gap-1" title="Recorded observations">
                    <Eye className="size-3" /> {count}
                  </span>
                  <ArrowUpRight className="size-4 shrink-0 text-text-faint transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                </Link>
              );
            })}
          </div>
        </>
      )}

      {isDemoMode && (
        <DemoNote>Demo mode — reports and plans you create persist for this session of use.</DemoNote>
      )}
    </div>
  );
}
