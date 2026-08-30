import Link from "next/link";
import { ClipboardList, ArrowUpRight, Clock, Users } from "lucide-react";
import { listSessionPlans } from "@/lib/data/coach";
import { isDemoMode } from "@/lib/env";
import { PageHeader, StatBand } from "@/components/ui/kit";
import { SectionHeader } from "@/components/ui/primitives";
import { EmptyState, DemoNote } from "@/components/dashboards/shared";
import { SessionForm } from "@/components/coach/session-form";

export const metadata = { title: "Session planner — MIDO XI" };

const STATUS_COLOR: Record<string, string> = {
  draft: "var(--text-dim)",
  planned: "var(--signal-bright)",
  delivered: "var(--positive)",
};

function dayLabel(iso: string | null): string {
  if (!iso) return "Unscheduled";
  const d = new Date(iso);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.round((new Date(d).setHours(0, 0, 0, 0) - today.getTime()) / 864e5);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff === -1) return "Yesterday";
  return d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
}

type Plan = Awaited<ReturnType<typeof listSessionPlans>>[number];

/** Split the planner into what is ahead and what has been. */
function splitPlans(plans: Plan[]): { upcoming: Plan[]; past: Plan[]; minutesAhead: number } {
  const cutoff = Date.now() - 864e5;
  const upcoming = plans.filter((p) => p.scheduledAt && new Date(p.scheduledAt).getTime() >= cutoff);
  const upcomingIds = new Set(upcoming.map((p) => p.id));
  return {
    upcoming,
    past: plans.filter((p) => !upcomingIds.has(p.id)),
    minutesAhead: upcoming.reduce((s, p) => s + (p.durationMin ?? 0), 0),
  };
}

export default async function SessionsPage({ searchParams }: PageProps<"/app/sessions">) {
  const params = await searchParams;
  const objective = typeof params.objective === "string" ? params.objective : "";

  const plans = await listSessionPlans();
  const { upcoming, past, minutesAhead } = splitPlans(plans);

  return (
    <div className="mx-auto max-w-[1100px] px-4 py-8 md:px-6">
      <PageHeader
        icon={ClipboardList}
        title="Session planner"
        tagline="Build the training week backwards from the match."
        actions={<SessionForm mode="create" presetObjective={objective} />}
      />

      {objective && (
        <div className="panel mb-6 border-signal-line/40 bg-signal/5 p-4 text-sm leading-relaxed text-text-dim">
          Planning around <span className="text-text-hi">{objective}</span> — the objective is pre-filled
          in a new session.
        </div>
      )}

      {plans.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="No sessions yet"
          body="A session starts with an objective: what should be different at the end of it. Write that, and MIDO can draft the blocks for you to edit."
          action={{ label: "Back to the Touchline", href: "/app" }}
        />
      ) : (
        <>
          <section className="mb-8">
            <StatBand
              cols={4}
              stats={[
                { label: "Sessions", value: plans.length },
                { label: "Upcoming", value: upcoming.length },
                { label: "Minutes ahead", value: minutesAhead },
                { label: "Delivered", value: plans.filter((p) => p.status === "delivered").length },
              ]}
            />
          </section>

          {upcoming.length > 0 && (
            <section className="mb-8">
              <SectionHeader label="Ahead" />
              <div className="space-y-2">
                {upcoming.map((p, i) => (
                  <PlanRow key={p.id} plan={p} featured={i === 0} />
                ))}
              </div>
            </section>
          )}

          {past.length > 0 && (
            <section>
              <SectionHeader label="Earlier" />
              <div className="space-y-2">
                {past.map((p) => (
                  <PlanRow key={p.id} plan={p} />
                ))}
              </div>
            </section>
          )}
        </>
      )}

      {isDemoMode && <DemoNote>Demo mode — sessions you plan here are real for this session of use.</DemoNote>}
    </div>
  );
}

function PlanRow({ plan, featured = false }: { plan: Plan; featured?: boolean }) {
  return (
    <Link
      href={`/app/sessions/${plan.id}`}
      className={`group flex flex-wrap items-center gap-3 p-4 transition-colors hover:border-signal-line ${
        featured
          ? "relative overflow-hidden rounded-xl border border-signal-line bg-gradient-to-b from-signal/10 via-ink-900 to-ink-900"
          : "panel"
      }`}
    >
      {featured && <div className="label-tech w-full !text-signal-bright">Next session / 01</div>}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`truncate text-sm text-text-hi ${
              featured ? "font-display font-bold uppercase tracking-tight" : "font-medium"
            }`}
          >
            {plan.title}
          </span>
          <span className="label-tech" style={{ color: STATUS_COLOR[plan.status] }}>
            {plan.status}
          </span>
          {plan.source === "mido" && <span className="chip chip-signal !px-1.5 !py-0">MIDO draft</span>}
        </div>
        <p className="mt-0.5 line-clamp-1 text-xs text-text-dim">{plan.objective || "No objective set"}</p>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <span className="label-tech">{dayLabel(plan.scheduledAt)}</span>
        {plan.durationMin && (
          <span className="chip flex items-center gap-1">
            <Clock className="size-3" /> {plan.durationMin}m
          </span>
        )}
        {plan.playersCount && (
          <span className="chip hidden items-center gap-1 sm:flex">
            <Users className="size-3" /> {plan.playersCount}
          </span>
        )}
        <ArrowUpRight className="size-4 text-text-faint transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
      </div>
    </Link>
  );
}
