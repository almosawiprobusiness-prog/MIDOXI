import Link from "next/link";
import { Grid3x3, ArrowUpRight, Link2 } from "lucide-react";
import { listBoards, linkCounts, boardsAssignedToMe } from "@/lib/data/boards";
import { getActiveRole } from "@/lib/auth/session";
import { AttachedBoards } from "@/components/tactics/attached-boards";
import { SectionHeader } from "@/components/ui/primitives";
import { BOARD_PHASES, BOARD_KINDS } from "@/lib/tactics/types";
import { summariseBoard } from "@/lib/tactics/describe";
import { summariseLinks } from "@/lib/tactics/links";
import { isDemoMode } from "@/lib/env";
import { PageHeader } from "@/components/ui/kit";
import { EmptyState, DemoNote } from "@/components/dashboards/shared";
import { NewBoardButton } from "@/components/coach/new-board-button";
import { BoardView } from "@/components/tactics/board-view";

export const metadata = { title: "Tactical board — MIDO XI" };

/*
  The board library.

  Same card layout the page has always had — the strong visual grid is
  the point of it — with the metadata that turns a wall of pictures into
  something searchable: what is actually drawn on each board, and where
  it is used. "Linked to 2 sessions" is the line that tells a coach this
  board is load-bearing before they edit it.
*/

export default async function TacticsPage({
  searchParams,
}: {
  searchParams?: Promise<{ q?: string; phase?: string; kind?: string }>;
}) {
  const params = await searchParams;
  const query = {
    text: params?.q?.trim() || undefined,
    phase: BOARD_PHASES.some((p) => p.phase === params?.phase)
      ? (params?.phase as (typeof BOARD_PHASES)[number]["phase"])
      : undefined,
    kind: BOARD_KINDS.some((k) => k.kind === params?.kind)
      ? (params?.kind as (typeof BOARD_KINDS)[number]["kind"])
      : undefined,
  };

  const [role, boards, assigned] = await Promise.all([
    getActiveRole(),
    listBoards(query),
    boardsAssignedToMe(),
  ]);
  const links = await linkCounts(boards.map((b) => b.id));
  const filtered = Boolean(query.text || query.phase || query.kind);

  /*
    One page, read differently per operating system (§19/§20).

    Not three pages and not three components: the same boards, the same
    engine, with the framing each role actually needs. A player is here
    to understand and to think something through; a coach is here to
    build the week.
  */
  const copy =
    role === "player"
      ? {
          title: "Boards",
          tagline: "See the idea. Draw your own.",
          empty:
            "Boards your coach or trainer assigns you appear here. You can also draw your own — recreate a moment from a match, or work out where you should have been.",
        }
      : role === "trainer"
        ? {
            title: "Boards",
            tagline: "Draw the movement, attach it to the work.",
            empty:
              "Draw a movement pattern once — the start position, the server, the run, the finish — and attach it to a programme session or assign it to an athlete.",
          }
        : {
            title: "Tactical board",
            tagline: "Draw the idea, save it, teach it.",
            empty:
              "Start from a formation, move your players, and draw runs, passes and pressing angles. Boards are saved so you can show the same idea again in the next session — and attach it to a drill, a goal or an opposition report.",
          };

  return (
    <div className="mx-auto max-w-[1100px] px-4 py-8 md:px-6">
      <PageHeader
        icon={Grid3x3}
        title={copy.title}
        tagline={copy.tagline}
        actions={<NewBoardButton />}
      />

      {/*
        Assigned to you — the other half of the shared board.

        Read-only by construction, not by interface choice: migration
        0045 grants the assignee `select` and nothing else, so this is
        the same object the coach drew rather than a copy, and it cannot
        be edited from here.
      */}
      {assigned.length > 0 && (
        <section className="mb-8">
          <SectionHeader label={`Assigned to you · ${assigned.length}`} />
          <AttachedBoards
            attached={assigned}
            entityType={assigned[0].link.entityType}
            entityId={assigned[0].link.entityId}
            editable={false}
          />
        </section>
      )}

      {/* Filters as links, so a filtered library is a shareable URL and
          the page stays a server component. */}
      {(boards.length > 0 || filtered) && (
        <form method="get" className="mb-5 flex flex-wrap items-center gap-2">
          <input
            name="q"
            defaultValue={params?.q ?? ""}
            placeholder="Search boards…"
            aria-label="Search boards"
            className="h-9 min-w-0 flex-1 rounded-lg border border-line bg-ink-850 px-3 text-sm text-text-hi placeholder:text-text-faint focus:border-signal-line focus:outline-none"
          />
          <select
            name="phase"
            defaultValue={params?.phase ?? ""}
            aria-label="Filter by phase"
            className="h-9 rounded-lg border border-line bg-ink-850 px-2 text-sm text-text-dim focus:border-signal-line focus:outline-none"
          >
            <option value="">Any phase</option>
            {BOARD_PHASES.map((p) => (
              <option key={p.phase} value={p.phase}>
                {p.label}
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="h-9 rounded-lg border border-line-strong px-3 text-sm text-text-hi transition-colors hover:border-signal-line"
          >
            Filter
          </button>
          {filtered && (
            <Link href="/app/tactics" className="text-xs text-text-faint hover:text-text">
              Clear
            </Link>
          )}
        </form>
      )}

      {boards.length === 0 ? (
        <EmptyState
          icon={Grid3x3}
          title={filtered ? "Nothing matches that" : "No boards yet"}
          body={
            filtered
              ? "No board matches those filters. Clear them to see everything you have drawn."
              : copy.empty
          }
          action={filtered ? { label: "Clear filters", href: "/app/tactics" } : { label: "Back to the Touchline", href: "/app" }}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {boards.map((b) => {
            const usage = summariseLinks(links.get(b.id) ?? []);
            const contents = summariseBoard(b);
            return (
              <Link
                key={b.id}
                href={`/app/tactics/${b.id}`}
                className="min-w-0 group panel overflow-hidden transition-colors hover:border-signal-line"
              >
                <div className="aspect-[2/3] w-full overflow-hidden border-b border-line">
                  <BoardView doc={b.doc} scope={`card-${b.id}`} />
                </div>
                <div className="p-4">
                  <div className="label-tech flex flex-wrap items-center gap-2">
                    <span>{b.formation}</span>
                    <span className="h-px w-3 bg-line-strong" />
                    <span>{BOARD_PHASES.find((p) => p.phase === b.phase)?.label ?? b.phase}</span>
                    {b.kind !== "tactical" && (
                      <>
                        <span className="h-px w-3 bg-line-strong" />
                        <span className="text-signal-bright">{b.kind}</span>
                      </>
                    )}
                  </div>
                  <h3 className="mt-1 flex items-start gap-1.5 font-display text-base font-semibold text-text-hi">
                    <span className="min-w-0 flex-1">{b.title}</span>
                    <ArrowUpRight className="mt-0.5 size-4 shrink-0 text-text-faint transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                  </h3>

                  {b.doc.objective ? (
                    <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-text-dim">{b.doc.objective}</p>
                  ) : (
                    b.notes && <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-text-dim">{b.notes}</p>
                  )}

                  <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-text-faint">
                    {contents && <span className="data-mono">{contents}</span>}
                    {usage && (
                      <span className="flex items-center gap-1 text-signal-bright">
                        <Link2 className="size-3" /> {usage}
                      </span>
                    )}
                  </div>

                  {b.tags.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {b.tags.slice(0, 3).map((t) => (
                        <span key={t} className="chip !normal-case">
                          {t}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {isDemoMode && <DemoNote>Demo mode — boards you draw persist for this session of use.</DemoNote>}
    </div>
  );
}
