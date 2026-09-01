import { BoardView } from "@/components/tactics/board-view";
import { toDocument } from "@/lib/tactics/document";

/*
  Kept as a thin adapter, not a second renderer.

  This file used to draw its own pitch from numbers copied out of the
  editor — two implementations of the same picture, free to drift apart
  and eventually did. It now normalises whatever it is handed (a v2
  document, or a v1 {tokens, arrows, zones} straight off an old row) and
  renders it through the one shared viewer.

  New code should call `BoardView` directly.
*/
export function BoardThumb({ board }: { board: unknown }) {
  return <BoardView doc={toDocument(board)} />;
}
