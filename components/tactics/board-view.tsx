/*
  A board, read-only.

  Server-safe by design and by discipline: no "use client", no hooks, no
  event handlers. A session page showing six drill boards ships six
  inert SVGs and zero kilobytes of editor — which is the whole of §23.
  The editor is a separate module that nothing here imports, so it
  cannot be pulled into a page that only wanted to look.

  Every layer is the same component the editor uses, so a board looks
  identical wherever it appears.
*/

import { pitchView } from "@/lib/tactics/geometry";
import { emptyFrame } from "@/lib/tactics/document";
import type { TacticalDocument } from "@/lib/tactics/types";
import { PitchSurface } from "./pitch";
import { AnnotationLayer, EntityLayer, PathLayer, PathMarkers, ZoneLayer } from "./layers";

/**
 * `scope` keeps SVG marker ids unique when several boards share a page.
 *
 * Derived from the document's own first frame id rather than a module
 * counter: a counter is state living outside the component, which makes
 * the same board render differently on the server and the client. The
 * frame id is already unique per board and stable across both.
 */
export function BoardView({
  doc,
  frameIndex = 0,
  scope,
  className,
  title,
}: {
  doc: TacticalDocument;
  frameIndex?: number;
  scope?: string;
  className?: string;
  title?: string;
}) {
  const view = pitchView(doc.pitch.type);
  const frame = doc.frames[frameIndex] ?? doc.frames[0] ?? emptyFrame();
  const ns = scope ?? frame.id ?? "board";

  return (
    <svg
      viewBox={`0 0 ${view.w} ${view.h}`}
      className={className ?? "block h-full w-full"}
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      <PathMarkers scope={ns} />
      <PitchSurface pitch={doc.pitch} />
      <ZoneLayer zones={frame.zones} view={view} />
      <PathLayer paths={frame.paths} view={view} scope={ns} />
      <EntityLayer entities={frame.entities} view={view} />
      <AnnotationLayer annotations={frame.annotations} view={view} />
    </svg>
  );
}
