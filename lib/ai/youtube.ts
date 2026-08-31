import "server-only";
import { env, features } from "@/lib/env";
import { parseIsoDuration } from "@/lib/util/duration";

/*
  YouTube Data API v3 — search + details, with a cache.

  A search call costs 100 quota units against a 10,000/day free budget, so an
  uncached engine would exhaust the day in ~100 searches. We cache aggressively
  (6h TTL, keyed by the exact query) in a module-scoped map that survives across
  requests in a warm process. In production this would move to a DB/edge cache;
  the interface stays identical.
*/

export interface YoutubeResult {
  videoId: string;
  title: string;
  channel: string;
  description: string;
  thumbnailUrl: string;
  publishedAt: string;
  url: string;
  durationSeconds?: number;
}

const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6h
type Entry = { at: number; results: YoutubeResult[] };
const g = globalThis as unknown as { __midoYtCache?: Map<string, Entry> };
const cache: Map<string, Entry> = (g.__midoYtCache ??= new Map());

function cacheKey(query: string, max: number) {
  return `${query.toLowerCase().trim()}::${max}`;
}

/**
 * Search YouTube for football-study footage. Cached. Returns [] when the key is
 * missing or the API errors — callers must treat an empty list as "no results",
 * never as an error state.
 */
export async function searchYoutube(query: string, max = 6): Promise<YoutubeResult[]> {
  if (!features.youtube) return [];
  const key = cacheKey(query, max);
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.results;

  try {
    const params = new URLSearchParams({
      part: "snippet",
      q: query,
      type: "video",
      maxResults: String(max),
      videoEmbeddable: "true",
      safeSearch: "moderate",
      relevanceLanguage: "en",
      key: env.youtubeKey,
    });
    const res = await fetch(`https://www.googleapis.com/youtube/v3/search?${params}`, {
      // Next server-side fetch; short revalidate as a second cache layer.
      next: { revalidate: 21600 },
    });
    if (!res.ok) return hit?.results ?? [];
    const json = (await res.json()) as {
      items?: {
        id: { videoId: string };
        snippet: {
          title: string;
          channelTitle: string;
          description: string;
          publishedAt: string;
          thumbnails: { medium?: { url: string }; high?: { url: string }; default?: { url: string } };
        };
      }[];
    };

    let results: YoutubeResult[] = (json.items ?? [])
      .filter((it) => it.id?.videoId)
      .map((it) => ({
        videoId: it.id.videoId,
        title: decodeEntities(it.snippet.title),
        channel: it.snippet.channelTitle,
        description: it.snippet.description,
        thumbnailUrl:
          it.snippet.thumbnails.high?.url ??
          it.snippet.thumbnails.medium?.url ??
          it.snippet.thumbnails.default?.url ??
          "",
        publishedAt: it.snippet.publishedAt,
        url: `https://www.youtube.com/watch?v=${it.id.videoId}`,
      }));

    // Enrich with duration (1 unit/call, batched) — lets us prefer real analysis
    // clips over 30-second shorts.
    results = await withDurations(results);

    cache.set(key, { at: Date.now(), results });
    return results;
  } catch {
    return hit?.results ?? [];
  }
}

/**
 * One video's duration, in seconds. Costs 1 quota unit against the
 * 10,000/day budget — negligible next to search's 100. Null when the
 * key is absent, the API declines, or the video hides its details;
 * callers treat null as "unknown", never as zero, because a video of
 * unknown length is not a video of no length.
 */
export async function youtubeDurationSeconds(videoId: string): Promise<number | null> {
  if (!features.youtube) return null;
  try {
    const params = new URLSearchParams({ part: "contentDetails", id: videoId, key: env.youtubeKey });
    const res = await fetch(`https://www.googleapis.com/youtube/v3/videos?${params}`, {
      next: { revalidate: 21600 },
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { items?: { contentDetails?: { duration?: string } }[] };
    const iso = json.items?.[0]?.contentDetails?.duration;
    if (!iso) return null;
    const seconds = parseIsoDuration(iso);
    return seconds !== undefined && seconds > 0 ? seconds : null;
  } catch {
    return null;
  }
}

async function withDurations(results: YoutubeResult[]): Promise<YoutubeResult[]> {
  if (results.length === 0) return results;
  try {
    const ids = results.map((r) => r.videoId).join(",");
    const params = new URLSearchParams({
      part: "contentDetails",
      id: ids,
      key: env.youtubeKey,
    });
    const res = await fetch(`https://www.googleapis.com/youtube/v3/videos?${params}`, {
      next: { revalidate: 21600 },
    });
    if (!res.ok) return results;
    const json = (await res.json()) as {
      items?: { id: string; contentDetails: { duration: string } }[];
    };
    const durById = new Map(
      (json.items ?? []).map((it) => [it.id, parseIsoDuration(it.contentDetails.duration)]),
    );
    return results.map((r) => ({ ...r, durationSeconds: durById.get(r.videoId) }));
  } catch {
    return results;
  }
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}
