import Link from "next/link";
import { Grid3x3, ArrowUpRight } from "lucide-react";
import { listBoards } from "@/lib/data/coach";
import { BOARD_PHASES } from "@/lib/data/coach-types";
import { isDemoMode } from "@/lib/env";
import { PageHeader } from "@/components/ui/kit";
import { EmptyState, DemoNote } from "@/components/dashboards/shared";
import { NewBoardButton } from "@/components/coach/new-board-button";
import { BoardThumb } from "@/components/coach/board-thumb";

export const metadata = { title: "Tactical board — MIDO XI" };

export default async function TacticsPage() {
  const boards = await listBoards();

  return (
    <div className="mx-auto max-w-[1100px] px-4 py-8 md:px-6">
      <PageHeader
        icon={Grid3x3}
        title="Tactical board"
        tagline="Draw the idea, save it, teach it."
        actions={<NewBoardButton />}
      />

      {boards.length === 0 ? (
        <EmptyState
          icon={Grid3x3}
          title="No boards yet"
          body="Start from a formation, move your players, and draw runs, passes and pressing angles. Boards are saved so you can show the same idea again in the next session."
          action={{ label: "Back to the Touchline", href: "/app" }}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {boards.map((b) => (
            <Link
              key={b.id}
              href={`/app/tactics/${b.id}`}
              className="min-w-0 group panel overflow-hidden transition-colors hover:border-signal-line"
            >
              <div className="aspect-[2/3] w-full overflow-hidden border-b border-line">
                <BoardThumb board={b.board} />
              </div>
              <div className="p-4">
                <div className="label-tech flex items-center gap-2">
                  <span>{b.formation}</span>
                  <span className="h-px w-3 bg-line-strong" />
                  <span>{BOARD_PHASES.find((p) => p.phase === b.phase)?.label ?? b.phase}</span>
                </div>
                <h3 className="mt-1 flex items-start gap-1.5 font-display text-base font-semibold text-text-hi">
                  <span className="min-w-0 flex-1">{b.title}</span>
                  <ArrowUpRight className="mt-0.5 size-4 shrink-0 text-text-faint transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                </h3>
                {b.notes && <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-text-dim">{b.notes}</p>}
              </div>
            </Link>
          ))}
        </div>
      )}

      {isDemoMode && <DemoNote>Demo mode — boards you draw persist for this session of use.</DemoNote>}
    </div>
  );
}
