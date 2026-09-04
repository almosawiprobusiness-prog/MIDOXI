import Link from "next/link";
import { Network, Users, AlertCircle } from "lucide-react";
import { listTeams, listStaff } from "@/lib/data/club";
import { staffRoleMeta, teamsWithoutStaff } from "@/lib/data/club-types";
import { isDemoMode } from "@/lib/env";
import { PageHeader, StatBand } from "@/components/ui/kit";
import { EmptyState, DemoNote } from "@/components/dashboards/shared";
import { TeamForm } from "@/components/club/team-form";
import { StaffForm } from "@/components/club/staff-form";
import { requireRole, viewingFromOtherOs } from "@/lib/auth/guard";
import { ROLES } from "@/lib/roles/roles";
import { OsNotice } from "@/components/shell/os-notice";

export const metadata = { title: "Teams — MIDO XI" };

export default async function TeamsPage() {
  /* Club OS. `requireRole` is the entitlement gate; being in another
     system is only context, so that is a notice rather than a refusal —
     see lib/auth/guard.ts. */
  const user = await requireRole("club");
  const elsewhere = viewingFromOtherOs(user, "club");

  const [teams, staff] = await Promise.all([listTeams(), listStaff()]);
  const unstaffed = teamsWithoutStaff(teams);
  const recorded = teams.reduce((n, t) => n + (t.squadSize ?? 0), 0);

  return (
    <div className="mx-auto max-w-[1100px] px-4 py-8 md:px-6">
      {elsewhere && <OsNotice role="club" label={ROLES.club.label} />}

      <PageHeader
        icon={Network}
        title="Teams"
        tagline="Squads and age groups across the club."
        actions={<TeamForm mode="create" />}
      />

      {teams.length === 0 ? (
        <EmptyState
          icon={Network}
          title="No teams yet"
          body="A club is teams, staff and players connected by one methodology. Create your first team, then assign the staff responsible for it."
          action={{ label: "Back to HQ", href: "/app" }}
        />
      ) : (
        <>
          <section className="mb-8">
            <StatBand
              cols={4}
              stats={[
                { label: "Teams", value: teams.length },
                { label: "Recorded players", value: recorded, hint: "Squad sizes the club maintains" },
                { label: "Staff", value: staff.filter((s) => s.status !== "left").length },
                { label: "Unstaffed teams", value: unstaffed.length },
              ]}
            />
          </section>

          {unstaffed.length > 0 && (
            <div className="panel mb-8 flex items-start gap-3 border-review/30 bg-review/5 p-4">
              <AlertCircle className="mt-0.5 size-4 shrink-0 text-review" />
              <p className="text-sm leading-relaxed text-text-dim">
                <span className="text-text-hi">
                  {unstaffed.map((t) => t.name).join(", ")}
                </span>{" "}
                {unstaffed.length === 1 ? "has" : "have"} nobody assigned. A team without a named coach is
                a team whose development nobody owns.
              </p>
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            {teams.map((t) => (
              <div key={t.id} className="min-w-0 panel p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="truncate font-display text-lg font-semibold text-text-hi">{t.name}</h3>
                    <div className="label-tech mt-0.5 truncate">
                      {[t.ageGroup, t.level, t.season].filter(Boolean).join(" · ") || "No details set"}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-start gap-2">
                    <div className="text-right">
                      <div className="stat-figure text-xl">{t.squadSize ?? "—"}</div>
                      <div className="label-tech mt-0.5">players</div>
                    </div>
                    <TeamForm mode="edit" team={t} />
                  </div>
                </div>

                <div className="mt-4 border-t border-line pt-3">
                  {t.staff.length > 0 ? (
                    <ul className="space-y-1.5">
                      {t.staff.map((s) => {
                        const meta = staffRoleMeta(s.role);
                        return (
                          <li key={s.id} className="flex items-center gap-2 text-sm">
                            <span className="label-tech" style={{ color: meta.color }}>
                              {meta.label}
                            </span>
                            <span className="truncate text-text">{s.name}</span>
                          </li>
                        );
                      })}
                    </ul>
                  ) : (
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs text-text-dim">Nobody assigned.</span>
                      <StaffForm mode="create" teams={teams} presetTeamId={t.id} />
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-8">
            <Link
              href="/app/staff"
              className="group panel flex items-center gap-3 p-4 transition-colors hover:border-signal-line"
            >
              <span className="grid size-9 shrink-0 place-items-center rounded-lg border border-line bg-ink-850 text-signal-bright">
                <Users className="size-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm text-text-hi">Manage everyone in the club</span>
                <span className="label-tech mt-0.5 block">Staff</span>
              </span>
            </Link>
          </div>
        </>
      )}

      {isDemoMode && (
        <DemoNote>Demo mode — teams and staff you add persist for this session of use.</DemoNote>
      )}
    </div>
  );
}
