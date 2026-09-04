import { Users, Link2, Info } from "lucide-react";
import { listStaff, listTeams } from "@/lib/data/club";
import { STAFF_ROLES, staffRoleMeta, staffStatusMeta } from "@/lib/data/club-types";
import { isDemoMode } from "@/lib/env";
import { PageHeader, StatBand } from "@/components/ui/kit";
import { SectionHeader } from "@/components/ui/primitives";
import { EmptyState, DemoNote } from "@/components/dashboards/shared";
import { StaffForm } from "@/components/club/staff-form";
import { InviteButton } from "@/components/connections/invite-button";
import { requireRole, viewingFromOtherOs } from "@/lib/auth/guard";
import { ROLES } from "@/lib/roles/roles";
import { OsNotice } from "@/components/shell/os-notice";

export const metadata = { title: "Staff — MIDO XI" };

export default async function StaffPage() {
  /* Club OS. `requireRole` is the entitlement gate; being in another
     system is only context, so that is a notice rather than a refusal —
     see lib/auth/guard.ts. */
  const user = await requireRole("club");
  const elsewhere = viewingFromOtherOs(user, "club");

  const [staff, teams] = await Promise.all([listStaff(), listTeams()]);
  const teamName = new Map(teams.map((t) => [t.id, t.name]));
  const activeStaff = staff.filter((s) => s.status !== "left");
  const linked = staff.filter((s) => s.linked).length;

  const grouped = STAFF_ROLES.map((role) => ({
    role,
    people: activeStaff.filter((s) => s.role === role.value),
  })).filter((g) => g.people.length > 0);

  return (
    <div className="mx-auto max-w-[1100px] px-4 py-8 md:px-6">
      {elsewhere && <OsNotice role="club" label={ROLES.club.label} />}

      <PageHeader
        icon={Users}
        title="Staff"
        tagline="Coaches, trainers and analysts."
        actions={<StaffForm mode="create" teams={teams} />}
      />

      {staff.length === 0 ? (
        <EmptyState
          icon={Users}
          title="Nobody recorded yet"
          body="Record the people working in the club and what they are responsible for. They work as club records straight away; linking their own MIDO XI account comes with invites."
          action={{ label: "Back to HQ", href: "/app" }}
        />
      ) : (
        <>
          <section className="mb-8">
            <StatBand
              cols={4}
              stats={[
                { label: "Staff", value: activeStaff.length },
                { label: "Coaches", value: activeStaff.filter((s) => s.role.includes("coach")).length },
                { label: "Assigned to a team", value: activeStaff.filter((s) => s.teamId).length },
                { label: "MIDO accounts", value: linked },
              ]}
            />
          </section>

          <div className="space-y-8">
            {grouped.map(({ role, people }) => (
              <section key={role.value}>
                <SectionHeader label={`${role.label}${people.length > 1 ? "s" : ""}`} />
                <div className="panel divide-y divide-line overflow-hidden">
                  {people.map((s) => {
                    const rm = staffRoleMeta(s.role);
                    const sm = staffStatusMeta(s.status);
                    return (
                      <div key={s.id} className="flex flex-wrap items-center gap-3 p-4">
                        <span className="grid size-9 shrink-0 place-items-center rounded-lg border border-line bg-ink-850 font-display text-xs font-bold text-signal-bright">
                          {s.name
                            .split(/\s+/)
                            .map((p) => p[0])
                            .join("")
                            .slice(0, 2)
                            .toUpperCase()}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="truncate text-sm font-medium text-text-hi">{s.name}</span>
                            <span className="label-tech" style={{ color: rm.color }}>
                              {rm.label}
                            </span>
                            {s.linked && (
                              <span className="chip chip-signal flex items-center gap-1 !px-1.5 !py-0">
                                <Link2 className="size-2.5" /> linked
                              </span>
                            )}
                          </div>
                          <div className="mt-0.5 truncate text-xs text-text-dim">
                            {s.teamId ? (teamName.get(s.teamId) ?? "Team") : "Across the club"}
                            {s.notes ? ` · ${s.notes}` : ""}
                          </div>
                        </div>
                        <span className="label-tech shrink-0" style={{ color: sm.color }}>
                          {sm.label}
                        </span>
                        {!s.linked && (
                          <InviteButton
                            kind="club-staff"
                            targetTable="org_staff"
                            targetId={s.id}
                            label={s.name}
                            issuerLabel="Your club"
                            compact
                          />
                        )}
                        <StaffForm mode="edit" staff={s} teams={teams} />
                      </div>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>

          <p className="mt-8 flex items-start gap-2 text-[11px] leading-relaxed text-text-faint">
            <Info className="mt-0.5 size-3.5 shrink-0" />
            Recording someone here does not give them access to anything. Access comes from a MIDO XI
            account joining the organization — and even then, a coach reaches only the players connected
            to them, and a player&rsquo;s own development map stays private to the player.
          </p>
        </>
      )}

      {isDemoMode && <DemoNote>Demo mode — staff you record persist for this session of use.</DemoNote>}
    </div>
  );
}
