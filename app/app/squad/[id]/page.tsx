import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Target, GraduationCap, Link2 } from "lucide-react";
import { getSquadPlayer, listPlayerNotes } from "@/lib/data/coach";
import { boardsFor, listBoards } from "@/lib/data/boards";
import { BoardPicker } from "@/components/tactics/board-picker";
import { AttachedBoards } from "@/components/tactics/attached-boards";
import { statusMeta, noteKindMeta } from "@/lib/data/coach-types";
import { SectionHeader } from "@/components/ui/primitives";
import { SquadForm } from "@/components/coach/squad-form";
import { PlayerNotes } from "@/components/coach/player-notes";
import { InviteButton } from "@/components/connections/invite-button";

export async function generateMetadata({ params }: PageProps<"/app/squad/[id]">) {
  const { id } = await params;
  const player = await getSquadPlayer(id);
  return { title: player ? `${player.name} — MIDO XI` : "Player — MIDO XI" };
}

export default async function PlayerPage({ params }: PageProps<"/app/squad/[id]">) {
  const { id } = await params;
  const player = await getSquadPlayer(id);
  if (!player) notFound();

  const [notes, assigned, library] = await Promise.all([
    listPlayerNotes(id),
    boardsFor("squad_player", id),
    listBoards({ limit: 60 }),
  ]);
  const st = statusMeta(player.status);
  const byKind = notes.reduce<Record<string, number>>((acc, n) => {
    acc[n.kind] = (acc[n.kind] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="mx-auto max-w-[1000px] px-4 py-8 md:px-6">
      <Link
        href="/app/squad"
        className="mb-6 inline-flex items-center gap-1.5 text-xs text-text-faint transition-colors hover:text-text"
      >
        <ArrowLeft className="size-3.5" /> Squad
      </Link>

      <header className="mb-8 flex flex-wrap items-start gap-4">
        <div className="grid size-14 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-signal to-signal-deep font-display text-xl font-bold text-white">
          {player.squadNumber ?? player.name.slice(0, 1).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <div className="label-tech flex flex-wrap items-center gap-3">
            <span>{player.position || "Position not set"}</span>
            <span className="h-px w-5 bg-line-strong" />
            <span style={{ color: st.color }}>{st.label}</span>
            {player.linked && (
              <span className="chip chip-signal flex items-center gap-1">
                <Link2 className="size-3" /> MIDO account
              </span>
            )}
          </div>
          <h1 className="mt-1 font-display text-3xl font-bold tracking-tight text-text-hi">{player.name}</h1>
        </div>
        <div className="flex items-center gap-2">
          {!player.linked && (
            <InviteButton
              kind="coach-player"
              targetTable="coach_players"
              targetId={player.id}
              label={player.name}
              issuerLabel="Your coach"
            />
          )}
          <SquadForm mode="edit" player={player} />
        </div>
      </header>

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <section className="min-w-0 panel-raised relative overflow-hidden p-5">
          <div className="field-glow absolute inset-0" aria-hidden />
          <div className="relative">
            <div className="label-tech flex items-center gap-1.5">
              <Target className="size-3.5 text-signal-bright" /> Current development focus
            </div>
            {player.focus ? (
              <p className="mt-2 font-display text-lg leading-snug text-text-hi">{player.focus}</p>
            ) : (
              <p className="mt-2 text-sm leading-relaxed text-text-dim">
                Nothing recorded yet. Add a development focus below — it becomes the thing you reinforce
                in every session, and the headline the squad list shows.
              </p>
            )}
          </div>
        </section>

        <section className="panel p-5">
          <div className="label-tech">Development record</div>
          <dl className="mt-3 space-y-2">
            {[
              { label: "Focus entries", value: byKind.focus ?? 0 },
              { label: "Match observations", value: byKind.match ?? 0 },
              { label: "Training notes", value: byKind.session ?? 0 },
              { label: "Performance notes", value: byKind.performance ?? 0 },
            ].map((row) => (
              <div key={row.label} className="flex items-center justify-between text-sm">
                <dt className="text-text-dim">{row.label}</dt>
                <dd className="data-mono text-text">{row.value}</dd>
              </div>
            ))}
          </dl>
          {player.linked ? (
            <div className="mt-4 border-t border-line pt-3">
              <div className="label-tech">They share</div>
              <p className="mt-1 text-xs leading-relaxed text-text-dim">
                {player.shareScope === "full"
                  ? "Goals, match log and daily check-ins."
                  : player.shareScope === "development"
                    ? "Their development goals and match log."
                    : "Their identity only — no goals, matches or check-ins."}
              </p>
              <p className="mt-2 text-[11px] leading-relaxed text-text-faint">
                They chose this level and can change or end it at any time. Their studies and private
                notes are never shared, at any level.
              </p>
            </div>
          ) : (
            <p className="mt-4 border-t border-line pt-3 text-[11px] leading-relaxed text-text-faint">
              Not linked to a MIDO XI account. Use <span className="text-text-dim">Invite</span> above to
              send them a code — this profile works fully without it.
            </p>
          )}
        </section>
      </div>

      {/*
        Boards assigned to this player (§35).

        Assigning is the only thing in the board system that crosses an
        account boundary, so it is a deliberate act on a named person
        rather than a visibility setting — migration 0045's policy reads
        exactly these rows.
      */}
      <section className="mt-8">
        <SectionHeader label={assigned.length > 0 ? `Assigned boards · ${assigned.length}` : "Assigned boards"} />
        {assigned.length > 0 ? (
          <div className="space-y-3">
            <AttachedBoards
              attached={assigned}
              entityType="squad_player"
              entityId={id}
              revalidate={`/app/squad/${id}`}
            />
            <BoardPicker
              entityType="squad_player"
              entityId={id}
              boards={library}
              role="assigned"
              revalidate={`/app/squad/${id}`}
              label="Assign another board"
              compact
            />
          </div>
        ) : (
          <div className="panel flex flex-wrap items-center gap-3 p-4">
            <p className="min-w-0 flex-1 text-sm leading-relaxed text-text-dim">
              Assign a tactical board and this player sees it in their own MIDO XI —
              the same board you drew, not a copy of it.
            </p>
            <BoardPicker
              entityType="squad_player"
              entityId={id}
              boards={library}
              role="assigned"
              revalidate={`/app/squad/${id}`}
              label="Assign a board"
            />
          </div>
        )}
      </section>

      <section className="mt-8">
        <SectionHeader label="Development history" />
        <PlayerNotes playerId={player.id} notes={notes} />
      </section>

      <section className="mt-8">
        <SectionHeader label="Reinforce it" />
        <div className="grid gap-3 sm:grid-cols-2">
          <Link
            href={`/app/sessions?objective=${encodeURIComponent(player.focus ?? "")}`}
            className="min-w-0 group panel flex items-center gap-3 p-4 transition-colors hover:border-signal-line"
          >
            <span className="grid size-9 shrink-0 place-items-center rounded-lg border border-line bg-ink-850 text-signal-bright">
              <Target className="size-4" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm text-text-hi">Plan a session around this focus</span>
              <span className="label-tech mt-0.5 block">Session planner</span>
            </span>
          </Link>
          <Link
            href="/app/study"
            className="group panel flex items-center gap-3 p-4 transition-colors hover:border-signal-line"
          >
            <span className="grid size-9 shrink-0 place-items-center rounded-lg border border-line bg-ink-850 text-signal-bright">
              <GraduationCap className="size-4" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm text-text-hi">Find who does this best</span>
              <span className="label-tech mt-0.5 block">Study engine</span>
            </span>
          </Link>
        </div>
      </section>

      {notes.some((n) => n.kind === "focus") && (
        <p className="mt-8 text-center text-[11px] text-text-faint">
          {noteKindMeta("focus").label} entries build this player&rsquo;s development timeline — the record
          you read back at the end of a season.
        </p>
      )}
    </div>
  );
}
