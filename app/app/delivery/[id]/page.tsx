import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Sparkles, User } from "lucide-react";
import { requireRole, viewingFromOtherOs } from "@/lib/auth/guard";
import { ROLES } from "@/lib/roles/roles";
import { OsNotice } from "@/components/shell/os-notice";
import { getDeliverable } from "@/lib/data/deliverables";
import { getClubBrand } from "@/lib/data/brand";
import { getBoard } from "@/lib/data/boards";
import { getSessionPlan } from "@/lib/data/coach";
import { kindLabel, label, nextAction } from "@/lib/data/deliverable-types";
import { phaseMeta } from "@/lib/data/coach-types";
import { ClubHeader } from "@/components/brand/club-header";
import { BoardView } from "@/components/tactics/board-view";
import { DeliverableActions } from "@/components/managed/deliverable-actions";
import { ClientLink } from "@/components/managed/client-link";
import { deliverableUrl, linkState } from "@/lib/data/deliverable-link-types";
import { env } from "@/lib/env";

/*
  One deliverable, as the client will receive it.

  THE REASON THIS PAGE EXISTS. The queue lists titles. Approving from a list
  means putting your name to a document you have not read — a gate whose
  reviewer cannot see the work is theatre, and it was only obvious once the
  first deliverable was actually run through by hand.

  So the work is rendered here under the client's masthead, in the identity it
  will go out in, with the review actions beneath it. What you approve is what
  they get.
*/

/*
  The deliverable's own name in the tab. `generateMetadata` rather than a
  static export because the title is the document's, and a reviewer with
  several open should be able to tell them apart from the tab alone.
*/
export async function generateMetadata({ params }: PageProps<"/app/delivery/[id]">) {
  const { id } = await params;
  const d = await getDeliverable(id);
  return { title: d ? `${d.title} — MIDO XI` : "Delivery — MIDO XI" };
}

export default async function DeliverablePage({ params }: PageProps<"/app/delivery/[id]">) {
  const user = await requireRole("club");
  const { id } = await params;

  const [deliverable, brand] = await Promise.all([getDeliverable(id), getClubBrand()]);
  if (!deliverable) notFound();

  /*
    The work itself, fetched by what the deliverable points at. A reference
    can go stale — the board it names may have been deleted — so a missing
    body is a state this page renders rather than an error it throws.
  */
  const board =
    deliverable.entityType === "tactical_board" && deliverable.entityId
      ? await getBoard(deliverable.entityId)
      : null;
  const session =
    deliverable.entityType === "session_plan" && deliverable.entityId
      ? await getSessionPlan(deliverable.entityId)
      : null;

  const meta = [kindLabel(deliverable.kind), label(deliverable.status)].join(" · ");

  return (
    <div className="mx-auto max-w-[900px] px-4 py-8 md:px-6">
      {viewingFromOtherOs(user, "club") && <OsNotice role="club" label={ROLES.club.label} />}

      <Link
        href="/app/delivery"
        className="mb-6 inline-flex items-center gap-1.5 text-xs text-text-faint transition-colors hover:text-text"
      >
        <ArrowLeft className="size-3.5" /> Delivery
      </Link>

      {/* What the client sees, in the identity they see it in. */}
      <div className="panel p-5">
        <ClubHeader brand={brand} title={deliverable.title} meta={meta} />

        <div className="mt-5">
          {board && (
            <>
              {board.doc.objective && (
                <p className="mb-4 text-sm leading-relaxed text-text">{board.doc.objective}</p>
              )}
              <BoardView doc={board.doc} scope={`dlv-${deliverable.id}`} />
              {board.notes.trim() && (
                <p className="mt-4 whitespace-pre-line text-sm leading-relaxed text-text-dim">
                  {board.notes}
                </p>
              )}
            </>
          )}

          {session && (
            <>
              {session.plan.objective && (
                <p className="mb-4 text-sm leading-relaxed text-text">{session.plan.objective}</p>
              )}
              <div className="mb-5 flex flex-wrap gap-2">
                {session.plan.durationMin && <span className="chip">{session.plan.durationMin} min</span>}
                {session.plan.playersCount && (
                  <span className="chip">{session.plan.playersCount} players</span>
                )}
                {session.plan.pitch && <span className="chip">{session.plan.pitch}</span>}
                {session.plan.intensity && (
                  <span className="chip">{session.plan.intensity} intensity</span>
                )}
              </div>

              {/* The blocks, in order — this is the document, not a link to it. */}
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

              {session.blocks.length === 0 && (
                <p className="text-sm text-text-dim">
                  This session has no blocks yet. There is nothing here for a client to read.
                </p>
              )}
            </>
          )}

          {/*
            Either the deliverable references nothing (a report written
            elsewhere) or the thing it referenced is gone. Both are real; say
            which rather than rendering an empty panel.
          */}
          {!board && !session && (
            <p className="text-sm leading-relaxed text-text-dim">
              {deliverable.entityId
                ? "The work this points at is no longer here. Supersede this with a new deliverable rather than sending it."
                : "Nothing is attached to this yet."}
            </p>
          )}
        </div>
      </div>

      {/* Everything below the panel is the operation's, not the client's. */}
      <section className="mt-6">
        <div className="label-tech">Review</div>
        <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-text-faint">
          <span className="inline-flex items-center gap-1">
            {deliverable.aiDrafted ? (
              <>
                <Sparkles className="size-3" /> MIDO drafted this
              </>
            ) : (
              <>
                <User className="size-3" /> Written by hand
              </>
            )}
          </span>
          <span aria-hidden>·</span>
          <span>{nextAction(deliverable.status)}</span>
        </p>

        {deliverable.reviewNote && (
          <p className="mt-3 border-l-2 border-correction/50 pl-3 text-sm leading-relaxed text-text-dim">
            {deliverable.reviewNote}
          </p>
        )}

        <div className="mt-4">
          <DeliverableActions id={deliverable.id} status={deliverable.status} />
        </div>

        {/* The link exists only because this was delivered — it is minted by
            that same write, so there is nothing to generate here. */}
        {deliverable.shareToken && (
          <div className="mt-6 border-t border-line pt-4">
            <div className="label-tech mb-2">The client&rsquo;s link</div>
            <ClientLink
              id={deliverable.id}
              url={deliverableUrl(env.appUrl, deliverable.shareToken)}
              state={linkState(deliverable)}
              expiresAt={deliverable.shareExpiresAt}
            />
          </div>
        )}
      </section>
    </div>
  );
}
