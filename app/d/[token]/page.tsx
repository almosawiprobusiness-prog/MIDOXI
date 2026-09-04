import type { Metadata } from "next";
import { Lock } from "lucide-react";
import { resolveDeliverableLink, readDeliverableForClient } from "@/lib/data/deliverable-links";
import { brandForOrg } from "@/lib/data/brand";
import { boardForClient, sessionForClient } from "@/lib/data/deliverable-body";
import { kindLabel } from "@/lib/data/deliverable-types";
import { phaseMeta } from "@/lib/data/coach-types";
import { ClubHeader } from "@/components/brand/club-header";
import { BoardView } from "@/components/tactics/board-view";
import { PrintButton } from "@/components/reports/print-button";

/*
  A deliverable, opened by the client.

  The second page in MIDO XI a stranger can reach, and it inherits every rule
  `app/r/[token]` worked out for the first:

  · No navigation. The reader has permission to see one document, not an
    account.
  · noindex, nofollow. A club's session plan should never turn up in a search
    result — it was sent to one person.
  · Absent, expired, revoked and not-delivered all render the SAME page.
    Telling a stranger a token "has expired" confirms it was once real.

  And one rule of its own. Everything the operation knows and the client does
  not — the review note, who drafted it, where it sits in the queue — stays on
  `/app/delivery/[id]`. This page renders the document and the fact that a
  person approved it. Nothing else crosses.
*/

export const metadata: Metadata = {
  title: "Shared work — MIDO XI",
  robots: { index: false, follow: false, nocache: true },
};

function NotValid() {
  return (
    <main className="mx-auto flex min-h-[70vh] max-w-[520px] flex-col items-center justify-center px-6 text-center">
      <Lock className="size-5 text-text-faint" />
      <h1 className="mt-4 font-display text-xl font-semibold text-text-hi">
        This link is not available
      </h1>
      <p className="mt-2 text-sm leading-relaxed text-text-dim">
        It may have expired or been withdrawn. Ask whoever sent it for a new one.
      </p>
    </main>
  );
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export default async function DeliveredPage({ params }: PageProps<"/d/[token]">) {
  const { token } = await params;

  const link = await resolveDeliverableLink(token);
  if (!link) return <NotValid />;

  const deliverable = await readDeliverableForClient(link.deliverableId);
  if (!deliverable) return <NotValid />;

  const [brand, board, session] = await Promise.all([
    brandForOrg(link.orgId),
    deliverable.entityType === "tactical_board" && deliverable.entityId
      ? boardForClient(deliverable.entityId)
      : Promise.resolve(null),
    deliverable.entityType === "session_plan" && deliverable.entityId
      ? sessionForClient(deliverable.entityId)
      : Promise.resolve(null),
  ]);

  return (
    <main className="mx-auto max-w-[820px] px-4 py-10 md:px-6">
      <PrintButton
        title={deliverable.title}
        detail={`Prepared for ${brand.name}. Print or save as PDF to keep a copy.`}
      />

      <article className="panel p-6">
        <ClubHeader
          brand={brand}
          title={deliverable.title}
          meta={kindLabel(deliverable.kind)}
        />

        <div className="mt-6">
          {board && (
            <>
              {board.objective && (
                <p className="mb-4 text-sm leading-relaxed text-text">{board.objective}</p>
              )}
              <BoardView doc={board.doc} scope={`client-${deliverable.id}`} />
              {board.notes.trim() && (
                <p className="mt-4 whitespace-pre-line text-sm leading-relaxed text-text-dim">
                  {board.notes}
                </p>
              )}
            </>
          )}

          {session && (
            <>
              {session.objective && (
                <p className="mb-4 text-sm leading-relaxed text-text">{session.objective}</p>
              )}
              <div className="mb-5 flex flex-wrap gap-2">
                {session.durationMin && <span className="chip">{session.durationMin} min</span>}
                {session.playersCount && <span className="chip">{session.playersCount} players</span>}
                {session.pitch && <span className="chip">{session.pitch}</span>}
              </div>
              <ol className="flex flex-col gap-4">
                {session.blocks.map((b, i) => (
                  <li key={b.id} className="border-t border-line pt-4">
                    <div className="flex flex-wrap items-baseline gap-2">
                      <span className="data-mono text-xs text-text-faint">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <span className="label-tech">{phaseMeta(b.phase).label}</span>
                      <span className="text-sm font-medium text-text-hi">{b.name}</span>
                      {b.durationMin && (
                        <span className="data-mono text-xs text-signal-bright">{b.durationMin}m</span>
                      )}
                    </div>
                    {b.organisation && (
                      <p className="mt-1.5 text-sm leading-relaxed text-text-dim">{b.organisation}</p>
                    )}
                    {b.coachingPoints.length > 0 && (
                      <ul className="mt-2 space-y-1">
                        {b.coachingPoints.map((c, j) => (
                          <li key={j} className="flex items-start gap-2 text-sm leading-relaxed text-text">
                            <span className="mt-1.5 size-1 shrink-0 rounded-full bg-positive" />
                            {c}
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                ))}
              </ol>
            </>
          )}

          {!board && !session && (
            <p className="text-sm leading-relaxed text-text-dim">
              This document has no attachment.
            </p>
          )}
        </div>

        {/*
          The claim the tier rests on, stated to the person who paid for it: a
          human read this before it was sent. Dated, because an undated
          assurance is not one.
        */}
        {deliverable.reviewedAt && (
          <p className="mt-6 border-t border-line pt-4 text-[11px] leading-relaxed text-text-faint">
            Reviewed and approved on {fmtDate(deliverable.reviewedAt)}
            {deliverable.deliveredAt ? `, sent on ${fmtDate(deliverable.deliveredAt)}` : ""}.
          </p>
        )}
      </article>

      {deliverable.shareExpiresAt && (
        <p className="mt-5 text-[11px] text-text-faint">
          This link works until {fmtDate(deliverable.shareExpiresAt)}.
        </p>
      )}
    </main>
  );
}
