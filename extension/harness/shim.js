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

  // ?seed=promo — a curated library + prefilled draft, for store
  // screenshots. Content is realistic and invented; no real accounts.
  if (params.get("seed") === "promo") {
    const day = 86400000;
    const mk = (id, videoId, title, channel, secs, obs, cat, ageMs) => ({
      id, videoId,
      sourceUrl: `https://www.youtube.com/watch?v=${videoId}`,
      videoTitle: title, channelName: channel,
      thumbnailUrl: null,
      timestampSeconds: secs, observation: obs, category: cat,
      createdAt: new Date(Date.now() - ageMs).toISOString(),
      updatedAt: null, syncState: "local", origin: "chrome_extension",
    });
    // Real, public videos so thumbnails resolve; observations invented.
    store.libraryV = 1;
    store.library = [
      mk("p1", "bcAEk_kUktc", "HOW Hansi Flick UNLOCKED Raphinha?", "Pythagoras in Boots", 314,
        "Raphinha delays his movement until the defender commits centrally, then attacks the space behind.", "movement", 3600000),
      mk("p2", "UC0tvvxTtds", "How Rodri and Busquets Make the Game Look Slow", "Football Mind Gym", 1122,
        "Scans both shoulders twice before receiving and already knows the next passing lane.", "scanning", day),
      mk("p3", "QRGS3oKJPZI", "How Top Strikers Always Find Space | Haaland, Mbappé", "ForPro", 245,
        "Checks away from the centre-back first, waits for his head to turn, then attacks the blindside.", "finishing", day + 7200000),
      mk("p4", "KMQWMccF83U", "What are pressing traps and pressing triggers?", "Tifo Football", 458,
        "The press starts on the heavy first touch, never on the pass — the whole line steps together.", "pressing", 2 * day),
    ];
    store.library.forEach((c) => (c.thumbnailUrl = `https://i.ytimg.com/vi/${c.videoId}/hqdefault.jpg`));
    store.draft = {
      videoId: VIDEO_ID,
      observation: "Checks away first, waits for the CB to look at the ball, then attacks the blindside.",
      goalId: null,
      category: "movement",
      savedAt: Date.now(),
    };
  }
  try {
    // Promo seeds are authoritative; otherwise prior state persists.
    if (params.get("seed") !== "promo") {
      const kept = sessionStorage.getItem("harness-store");
      if (kept) Object.assign(store, JSON.parse(kept));
      store.env = env;
    }
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

  // ?auth=paid | ?auth=free — a fake CONNECTED session (entitled or
  // not), plus canned capture/telemetry responses, so the Capture →
  // Training surfaces can be exercised without a signed-in dev server.
  if (auth === "paid" || auth === "free") {
    const realFetch = window.fetch.bind(window);
    const json = (body) =>
      Promise.resolve(
        new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } }),
      );
    window.fetch = (url, init) => {
      const u = String(url);
      if (u.includes("/api/extension/session")) {
        return json({
          authenticated: true,
          user: { name: "Harness Player" },
          goals: [{ id: "g1", title: "Sharper first touch", category: "receiving" }],
          appUrl: "http://localhost:3000/harness",
          entitled: auth === "paid",
          pricing: { monthlyCents: 999, annualCents: 8900 },
        });
      }
      if (u.includes("/api/extension/captures")) {
        // ?fail=save applies in connected scenarios too — the import-
        // failure recovery paths need a server that says no.
        if (params.get("fail") === "save") {
          return Promise.reject(new TypeError("harness: save blocked"));
        }
        return json({
          ok: true,
          id: "3f2504e0-4f89-41d3-9a0c-0305e82c3301",
          deduped: false,
          openUrl: "http://localhost:3000/harness/harness.html#moment",
        });
      }
      if (u.includes("/api/extension/telemetry")) {
        console.log("[harness] telemetry:", init && init.body);
        return json({ ok: true });
      }
      return realFetch(url, init);
    };
  }

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
