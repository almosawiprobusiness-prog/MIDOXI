import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getBoard, linksForBoard } from "@/lib/data/boards";
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
  // Where this board is used — the editor warns before a change that
  // would ripple into a session somebody has already planned.
  const links = await linksForBoard(id);

  return (
    <div className="mx-auto max-w-[1100px] px-4 py-8 md:px-6">
      <Link
        href="/app/tactics"
        className="mb-6 inline-flex items-center gap-1.5 text-xs text-text-faint transition-colors hover:text-text"
      >
        <ArrowLeft className="size-3.5" /> Boards
      </Link>
      {/*
        The page's heading, for screen readers only.

        This page had no <h1> at all: the board's name lives in an
        editable input inside the editor, which is a CONTROL rather than
        a heading — labelled "Title", and correctly so. A reader moving
        by heading found nothing on the page. Stating it here leaves the
        editor untouched and gives the document a name.
      */}
      <h1 className="sr-only">{board.title}</h1>
      <TacticalBoardEditor board={board} links={links} />
    </div>
  );
}
