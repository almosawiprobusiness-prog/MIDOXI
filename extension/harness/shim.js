/*
  chrome.* shim for the dev harness. Enough surface for popup.js, no
  more. Storage is per-tab session storage so scenarios stay isolated;
  the injected page-reader is answered from the query-string scenario.
*/
(() => {
  const params = new URLSearchParams(location.search);
  const page = params.get("page") ?? "watch";
  const seconds = Number(params.get("seconds") ?? 2057);
  const env = params.get("env") ?? "local";

  // ?vid= + ?title= model YouTube SPA navigation: each popup open reads
  // the page fresh, so "navigated to video B" is simply the next open
  // reporting B's id/title/clock.
  const VIDEO_ID = params.get("vid") ?? "dQw4w9WgXcQ";
  const TITLE = params.get("title") ?? "Harry Kane — Every Movement Pattern Explained";
  const SCENARIOS = {
    watch: {
      url: `https://www.youtube.com/watch?v=${VIDEO_ID}`,
      read: {
        href: `https://www.youtube.com/watch?v=${VIDEO_ID}`,
        seconds,
        paused: false,
        title: TITLE,
        channel: "Football IQ",
      },
    },
    shorts: {
      url: `https://www.youtube.com/shorts/${VIDEO_ID}`,
      read: {
        href: `https://www.youtube.com/shorts/${VIDEO_ID}`,
        seconds: Math.min(seconds, 45),
        paused: false,
        title: "Rodri scans before every touch",
        channel: "Tactics Shorts",
      },
    },
    none: { url: "https://en.wikipedia.org/wiki/Association_football", read: null },
    novideo: {
      url: `https://www.youtube.com/watch?v=${VIDEO_ID}`,
      read: { href: `https://www.youtube.com/watch?v=${VIDEO_ID}`, seconds: null, paused: true, title: "", channel: null },
    },
  };
  const scenario = SCENARIOS[page] ?? SCENARIOS.watch;

  // Seed the popup's stored environment choice before it boots.
  const store = { env };
  try {
    const kept = sessionStorage.getItem("harness-store");
    if (kept) Object.assign(store, JSON.parse(kept));
    store.env = env;
  } catch {}
  const persist = () => {
    try {
      sessionStorage.setItem("harness-store", JSON.stringify(store));
    } catch {}
  };

  // ?auth=out — answer the session check with a 401 so the popup's
  // signed-out view can be exercised without a signed-out server.
  // ?auth=offline — fail the fetch entirely.
  // ?fail=save — session succeeds but the capture POST fails, for the
  // pending-retry loop.
  if (params.get("fail") === "save") {
    const realFetch = window.fetch.bind(window);
    window.fetch = (url, init) => {
      if (String(url).includes("/api/extension/captures")) {
        return Promise.reject(new TypeError("harness: save blocked"));
      }
      return realFetch(url, init);
    };
  }

  const auth = params.get("auth");
  if (auth === "out" || auth === "offline") {
    const realFetch = window.fetch.bind(window);
    window.fetch = (url, init) => {
      if (String(url).includes("/api/extension/session")) {
        if (auth === "offline") return Promise.reject(new TypeError("harness: offline"));
        return Promise.resolve(new Response(JSON.stringify({ authenticated: false }), { status: 401 }));
      }
      if (auth === "offline" && String(url).includes("/api/extension/")) {
        return Promise.reject(new TypeError("harness: offline"));
      }
      return realFetch(url, init);
    };
  }

  window.chrome = {
    runtime: { getManifest: () => ({ version: "0.1.0-harness" }) },
    storage: {
      local: {
        get: async (key) => {
          if (typeof key === "string") return { [key]: store[key] };
          const out = {};
          for (const k of key) out[k] = store[k];
          return out;
        },
        set: async (obj) => {
          Object.assign(store, obj);
          persist();
        },
        remove: async (key) => {
          delete store[key];
          persist();
        },
      },
    },
    tabs: {
      query: async () => [{ id: 1, url: scenario.url, active: true }],
      create: async ({ url }) => {
        window.open(url, "_blank", "noopener");
      },
    },
    scripting: {
      executeScript: async ({ func }) => {
        if (scenario.read === null) throw new Error("harness: no injection on this page");
        // The timestamp-refresh injection returns a bare number.
        const src = String(func);
        if (!src.includes("href")) {
          return [{ result: scenario.read.seconds == null ? null : scenario.read.seconds + 11 }];
        }
        return [{ result: scenario.read }];
      },
    },
  };
})();
