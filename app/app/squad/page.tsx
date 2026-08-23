import Link from "next/link";
import { Users, ArrowUpRight, AlertCircle } from "lucide-react";
import { listSquad } from "@/lib/data/coach";
import { statusMeta } from "@/lib/data/coach-types";
import { isDemoMode } from "@/lib/env";
import { PageHeader, StatBand } from "@/components/ui/kit";
import { SectionHeader } from "@/components/ui/primitives";
import { EmptyState, DemoNote } from "@/components/dashboards/shared";
import { SquadForm } from "@/components/coach/squad-form";

export const metadata = { title: "Squad — MIDO XI" };

/** Group the squad the way a coach reads a team sheet. */
const GROUPS: { label: string; match: (p: string) => boolean }[] = [
  { label: "Goalkeepers", match: (p) => p.startsWith("GK") },
  { label: "Defenders", match: (p) => /^(R|L)?(C)?B$|^(R|L)WB$/.test(p) },
  { label: "Midfielders", match: (p) => ["6", "8", "10", "CM", "DM", "AM", "RM", "LM"].includes(p) },
  { label: "Forwards", match: (p) => ["RW", "LW", "CF", "ST", "FW"].includes(p) },
];

export default async function SquadPage() {
  const squad = await listSquad();
  const available = squad.filter((p) => p.status === "active");
  const withFocus = squad.filter((p) => p.focus);
  const linked = squad.filter((p) => p.linked);

  const grouped = GROUPS.map((g) => ({ ...g, players: squad.filter((p) => g.match(p.position)) }));
  const ungrouped = squad.filter((p) => !GROUPS.some((g) => g.match(p.position)));

  return (
    <div className="mx-auto max-w-[1100px] px-4 py-8 md:px-6">
      <PageHeader
        icon={Users}
        title="Squad"
        tagline="Your players, their development, their history."
        actions={<SquadForm mode="create" />}
      />

      {squad.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No players yet"
          body="Add the players you work with. Development focus, notes and match observations all hang off a player, so a season of coaching becomes a record you can actually read."
          action={{ label: "Back to the Touchline", href: "/app" }}
        />
      ) : (
        <>
          <section className="mb-8">
            <StatBand
              cols={4}
              stats={[
                { label: "In the squad", value: squad.length },
                { label: "Available", value: available.length },
                { label: "With a focus", value: `${withFocus.length}/${squad.length}` },
                { label: "MIDO accounts", value: linked.length, hint: "Players with their own MIDO XI account" },
              ]}
            />
          </section>

          {withFocus.length < squad.length && (
            <div className="panel mb-8 flex items-start gap-3 border-review/30 bg-review/5 p-4">
              <AlertCircle className="mt-0.5 size-4 shrink-0 text-review" />
              <p className="text-sm leading-relaxed text-text-dim">
                <span className="text-text-hi">{squad.length - withFocus.length} players</span> have no
                development focus recorded. A focus is what turns team training into individual
                development — it is the first thing MIDO reinforces for a player.
              </p>
            </div>
          )}

          <div className="space-y-8">
            {[...grouped, { label: "Other", match: () => false, players: ungrouped }]
              .filter((g) => g.players.length > 0)
              .map((group) => (
                <section key={group.label}>
                  <SectionHeader label={group.label} />
                  <div className="panel divide-y divide-line overflow-hidden">
                    {group.players.map((p) => {
                      const st = statusMeta(p.status);
                      return (
                        <Link
                          key={p.id}
                          href={`/app/squad/${p.id}`}
                          className="group flex items-center gap-3 p-4 transition-colors hover:bg-ink-850"
                        >
                          <span className="data-mono grid size-9 shrink-0 place-items-center rounded-md border border-line bg-ink-850 text-sm text-text">
                            {p.squadNumber ?? "–"}
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="truncate text-sm font-medium text-text-hi">{p.name}</span>
                              {p.position && <span className="chip !px-1.5 !py-0">{p.position}</span>}
                              {p.linked && (
                                <span className="chip chip-signal !px-1.5 !py-0" title="Has a MIDO XI account">
                                  linked
                                </span>
                              )}
                            </div>
                            <div className="mt-0.5 truncate text-xs text-text-dim">
                              {p.focus ?? "No development focus set"}
                            </div>
                          </div>
                          <span className="label-tech shrink-0" style={{ color: st.color }}>
                            {st.label}
                          </span>
                          <ArrowUpRight className="size-4 shrink-0 text-text-faint transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                        </Link>
                      );
                    })}
                  </div>
                </section>
              ))}
          </div>
        </>
      )}

      {isDemoMode && (
        <DemoNote>
          Demo mode — the squad is a working in-memory dataset. Everything you add or edit here is real
          for this session, and persists to Postgres once a backend is connected.
        </DemoNote>
      )}
    </div>
  );
}
