/*
  Reading the moment off the YouTube page.

  There is deliberately NO content script and NO youtube.com host
  permission. Clicking the extension grants activeTab for that one tab,
  and chrome.scripting injects readPlayerState for one synchronous read
  of the live player. Nothing observes the page before the click,
  nothing stays behind after it, and SPA navigation cannot serve stale
  metadata because every capture reads fresh — the failure mode a
  persistent content script would have to defend against simply does
  not exist here.
*/
import { youtubeIdFromUrl } from "../../../lib/data/capture-types";

export interface VideoContext {
  videoId: string;
  url: string;
  title: string;
  channel: string | null;
  seconds: number;
  paused: boolean;
  thumbnailUrl: string;
  isShorts: boolean;
}

export type PageRead =
  | { kind: "video"; context: VideoContext; tabId: number }
  | { kind: "not-youtube" }
  | { kind: "no-video" }
  | { kind: "no-tab" };

/*
  Runs INSIDE the YouTube page (isolated world). Must stay entirely
  self-contained — chrome.scripting serialises the function, so nothing
  outside its own body exists where it runs. DOM only; page JS
  variables are out of reach and out of bounds.
*/
function readPlayerState() {
  const videos = Array.from(document.querySelectorAll("video"));
  // Shorts preload several <video> elements; the one actually playing
  // (or the one that has played) is the moment being captured.
  const active =
    videos.find((v) => !v.paused && v.currentTime > 0) ??
    videos.find((v) => v.currentTime > 0) ??
    videos[0] ??
    null;

  const titleEl =
    document.querySelector("h1.ytd-watch-metadata yt-formatted-string") ??
    document.querySelector("h1.title yt-formatted-string") ??
    document.querySelector("ytd-reel-player-header-renderer h2");
  const pageTitle = document.title.replace(/ - YouTube$/, "").trim();

  const channelEl =
    document.querySelector("ytd-channel-name#channel-name a") ??
    document.querySelector("#owner ytd-channel-name a") ??
    document.querySelector("ytd-reel-player-header-renderer ytd-channel-name a");

  return {
    href: location.href,
    seconds: active ? active.currentTime : null,
    paused: active ? active.paused : true,
    title: (titleEl?.textContent ?? "").trim() || pageTitle,
    channel: (channelEl?.textContent ?? "").trim() || null,
  };
}

function isYoutubeVideoUrl(url: string): boolean {
  try {
    const u = new URL(url);
    if (!/(^|\.)youtube\.com$/.test(u.hostname) && u.hostname !== "youtu.be") return false;
    return youtubeIdFromUrl(url) !== null;
  } catch {
    return false;
  }
}

export async function readCurrentPage(): Promise<PageRead> {
  let tab: chrome.tabs.Tab | undefined;
  try {
    [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  } catch {
    return { kind: "no-tab" };
  }
  if (!tab?.id || !tab.url) return { kind: "no-tab" };
  if (!isYoutubeVideoUrl(tab.url)) return { kind: "not-youtube" };

  let result: ReturnType<typeof readPlayerState> | null = null;
  try {
    const [injection] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: readPlayerState,
    });
    result = (injection?.result as ReturnType<typeof readPlayerState>) ?? null;
  } catch {
    return { kind: "no-video" };
  }
  if (!result) return { kind: "no-video" };

  // The URL from the PAGE, not the tab record: after SPA navigation the
  // page's location is the truth the player state was read against.
  const url = typeof result.href === "string" ? result.href : tab.url;
  const videoId = youtubeIdFromUrl(url);
  if (!videoId) return { kind: "not-youtube" };
  if (result.seconds == null) return { kind: "no-video" };

  const title = (result.title || "Untitled video").slice(0, 300);
  return {
    kind: "video",
    tabId: tab.id,
    context: {
      videoId,
      url,
      title,
      channel: result.channel ? result.channel.slice(0, 200) : null,
      seconds: Math.max(0, Math.floor(result.seconds)),
      paused: Boolean(result.paused),
      thumbnailUrl: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
      isShorts: url.includes("/shorts/"),
    },
  };
}

/** Re-read just the clock — the "refresh timestamp" affordance. */
export async function rereadSeconds(tabId: number): Promise<number | null> {
  try {
    const [injection] = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => {
        const videos = Array.from(document.querySelectorAll("video"));
        const active =
          videos.find((v) => !v.paused && v.currentTime > 0) ??
          videos.find((v) => v.currentTime > 0) ??
          videos[0];
        return active ? active.currentTime : null;
      },
    });
    const s = injection?.result;
    return typeof s === "number" && Number.isFinite(s) ? Math.max(0, Math.floor(s)) : null;
  } catch {
    return null;
  }
}
