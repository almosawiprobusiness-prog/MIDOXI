import { env } from "@/lib/env";
import { track } from "@/lib/analytics/track";
import { emitMidoEvent } from "@/lib/events/emit";
import { idempotencyKey } from "@/lib/events/types";
import { captureIssue, type CaptureInput, type CaptureCategory } from "@/lib/data/capture-types";
import { saveCapture } from "@/lib/data/captures";
import { extensionJson, preflight, readJsonBody, refuseBadOrigin } from "@/lib/extension/api";

export const dynamic = "force-dynamic";

/*
  Save one captured moment.

  The trust boundary of the whole extension. Nothing the client sends
  is believed: the payload is revalidated with the same captureIssue()
  the popup ran (the popup's copy was a courtesy; this one is the
  contract), goal ownership is proven through RLS in saveCapture, and
  the client_key unique index turns any retry — double-click, network
  stall, service-worker replay — into a dedupe instead of a duplicate.

  Analytics record that a capture happened and what it connected to.
  They never carry the observation text: what the player noticed is
  their football record, not our telemetry.
*/

export async function OPTIONS(request: Request) {
  return preflight(request);
}

export async function POST(request: Request) {
  const refused = refuseBadOrigin(request);
  if (refused) return refused;

  const body = await readJsonBody(request);
  if (!body) return extensionJson(request, { ok: false, error: "Bad request body." }, 400);

  const input: CaptureInput = {
    videoId: body.videoId as string,
    sourceUrl: body.sourceUrl as string,
    videoTitle: body.videoTitle as string,
    channelName: (body.channelName as string) ?? null,
    thumbnailUrl: (body.thumbnailUrl as string) ?? null,
    timestampSeconds: body.timestampSeconds as number,
    observation: body.observation as string,
    category: (body.category as CaptureCategory) ?? null,
    goalId: (body.goalId as string) ?? null,
    clientKey: (body.clientKey as string) ?? null,
  };

  const issue = captureIssue(input);
  if (issue) {
    return extensionJson(request, { ok: false, error: issue.message, field: issue.field }, 422);
  }

  const saved = await saveCapture(input);
  if (!saved.ok) {
    return extensionJson(request, { ok: false, error: saved.error }, saved.status);
  }

  if (!saved.deduped) {
    await track("capture_saved", {
      linkedToGoal: Boolean(input.goalId),
      category: input.category ?? "none",
      // "import" = a Free Mode library moment brought into MIDO; "popup"
      // = captured live while connected. Same event, one enum apart, so
      // the free→connected funnel is readable without a new vocabulary.
      via: body.via === "import" ? "import" : "popup",
    });
    await emitMidoEvent({
      type: "STUDY_MOMENT_CAPTURED",
      subjectType: "study",
      subjectId: saved.id,
      payload: {
        videoId: input.videoId,
        category: input.category ?? null,
        goalId: input.goalId ?? null,
      },
      idempotencyKey: idempotencyKey(["capture", saved.id]),
    });
  }

  return extensionJson(request, {
    ok: true,
    id: saved.id,
    deduped: saved.deduped ?? false,
    openUrl: `${env.appUrl}/app/film-room?moment=${saved.id}`,
  });
}
