import "server-only";
import { frameReader } from "./frame-reader";
import { nativeVideo } from "./native-video";
import { TRACKING_GAP, type VideoAnalysisProvider } from "./provider";

/*
  The providers the app knows about, in the order they should be preferred.

  Two ship. They answer different questions and neither replaces the other:

    video   reads the passage. Sees movement, sequence, timing. Needs a clip
            of at least ten seconds and a video model to be configured.
    frames  reads twelve stills. Sees a moment precisely and nothing between
            moments. Works on any range, on any deployment, with no extra key.

  A tracking provider is still an interface waiting for a vendor. TRACKING_GAP
  is what the film room shows in its place: what it would add, and what it would
  take — rather than a greyed-out button with no explanation.
*/

export const providers: VideoAnalysisProvider[] = [nativeVideo, frameReader];

export function providerById(id: string): VideoAnalysisProvider | null {
  return providers.find((p) => p.id === id) ?? null;
}

export interface ProviderOffer {
  id: string;
  label: string;
  kind: string;
  describes: string;
  cannot: string;
  available: boolean;
  reason: string | null;
}

/**
 * What the film room can offer this user right now, with the reason for
 * anything it cannot. Both are listed either way: an unavailable provider that
 * says what it would take is information, and a hidden one is a mystery.
 */
export async function providerOffers(): Promise<ProviderOffer[]> {
  return Promise.all(
    providers.map(async (p) => {
      const status = await p.status();
      return {
        id: p.id,
        label: p.label,
        kind: p.kind,
        describes: p.describes,
        cannot: p.cannot,
        available: status.available,
        reason: status.reason ?? null,
      };
    }),
  );
}

export { TRACKING_GAP };
