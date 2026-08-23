import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getBoard } from "@/lib/data/coach";
import { TacticalBoardEditor } from "@/components/coach/tactical-board";

export async function generateMetadata({ params }: PageProps<"/app/tactics/[id]">) {
  const { id } = await params;
  const board = await getBoard(id);
  return { title: board ? `${board.title} — MIDO XI` : "Board — MIDO XI" };
}

export default async function BoardPage({ params }: PageProps<"/app/tactics/[id]">) {
  const { id } = await params;
  const board = await getBoard(id);
  if (!board) notFound();

  return (
    <div className="mx-auto max-w-[1100px] px-4 py-8 md:px-6">
      <Link
        href="/app/tactics"
        className="mb-6 inline-flex items-center gap-1.5 text-xs text-text-faint transition-colors hover:text-text"
      >
        <ArrowLeft className="size-3.5" /> Boards
      </Link>
      <TacticalBoardEditor board={board} />
    </div>
  );
}
