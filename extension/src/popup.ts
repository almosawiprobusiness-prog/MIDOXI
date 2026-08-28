/*
  MIDO XI Capture — the popup.

  One screen, five states, no framework. Every piece of text that came
  from the network or the page goes through textContent — YouTube
  titles and API responses are data, never markup. The only innerHTML
  in this file takes the static icon constants below.

  The state machine:

    loading → not-youtube | auth-required | offline | error | capture
    capture → saving → saved → (capture again)
                    ↘ failed (observation kept, retry offered)
*/
import {
  CAPTURE_CATEGORIES,
  OBSERVATION_MAX_CHARS,
  captureIssue,
  formatTimestamp,
  type CaptureInput,
} from "../../lib/data/capture-types";
import { fetchSession, postCapture, type SessionState } from "./lib/api";
import { readCurrentPage, rereadSeconds, type VideoContext } from "./lib/page-reader";
import {
  clearDraft,
  listPending,
  pushPending,
  readDraft,
  removePending,
  writeDraft,
} from "./lib/draft";
import { ENVIRONMENTS, EXTENSION_VERSION, activeEnv, apiBase, setActiveEnv, type EnvName } from "./lib/config";

/* Static SVG icons (lucide paths, stroke 2, matching the app). */
const ICONS = {
  play: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="6 3 20 12 6 21 6 3"/></svg>',
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>',
  refresh: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/></svg>',
  mic: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="22"/></svg>',
  offline: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="2" x2="22" y1="2" y2="22"/><path d="M8.5 16.5a5 5 0 0 1 7 0"/><path d="M2 8.82a15 15 0 0 1 4.17-2.65"/><path d="M10.66 5c4.01-.36 8.14.9 11.34 3.76"/><path d="M16.85 11.25a10 10 0 0 1 2.22 1.68"/><path d="M5 13a10 10 0 0 1 5.24-2.76"/><line x1="12" x2="12.01" y1="20" y2="20"/></svg>',
  link: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 7h10v10"/><path d="M7 17 17 7"/></svg>',
};

type View =
  | { kind: "loading" }
  | { kind: "not-youtube" }
  | { kind: "auth-required"; sessionExpired?: boolean }
  | { kind: "offline" }
  | { kind: "error"; message: string }
  | { kind: "capture" }
  | { kind: "saved"; stampLabel: string; openUrl: string };

interface AppState {
  video: VideoContext | null;
  tabId: number | null;
  session: SessionState | null;
  observation: string;
  goalId: string | null;
  category: string | null;
  clientKey: string;
  saving: boolean;
  formError: string | null;
  allCategories: boolean;
  pendingCount: number;
}

const state: AppState = {
  video: null,
  tabId: null,
  session: null,
  observation: "",
  goalId: null,
  category: null,
  clientKey: crypto.randomUUID(),
  saving: false,
  formError: null,
  allCategories: false,
  pendingCount: 0,
};

const viewEl = document.getElementById("view") as HTMLElement;
const pendingStrip = document.getElementById("pending-strip") as HTMLElement;
const settingsEl = document.getElementById("settings") as HTMLElement;
const settingsToggle = document.getElementById("settings-toggle") as HTMLButtonElement;

/* ── tiny DOM helpers — text is always textContent ─────────── */

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Record<string, string> = {},
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  if (text !== undefined) node.textContent = text;
  return node;
}

function icon(name: keyof typeof ICONS): HTMLElement {
  const span = el("span");
  span.innerHTML = ICONS[name]; // static constants only — see header
  const svg = span.firstElementChild as unknown as HTMLElement;
  svg.setAttribute("aria-hidden", "true");
  return svg;
}

function openTab(url: string) {
  void chrome.tabs.create({ url });
}

/* ── boot ──────────────────────────────────────────────────── */

async function boot() {
  render({ kind: "loading" });
  const [page, session, pending] = await Promise.all([
    readCurrentPage(),
    fetchSession(),
    listPending(),
  ]);
  state.session = session;
  state.pendingCount = pending.length;
  renderPendingStrip();

  if (session.kind === "offline") return render({ kind: "offline" });
  if (session.kind === "error") return render({ kind: "error", message: session.message });
  if (session.kind === "signed-out") return render({ kind: "auth-required" });

  if (page.kind !== "video") return render({ kind: "not-youtube" });

  state.video = page.context;
  state.tabId = page.tabId;

  const draft = await readDraft(page.context.videoId);
  if (draft) {
    state.observation = draft.observation;
    state.goalId = draft.goalId;
    state.category = draft.category;
  }
  render({ kind: "capture" });
}

/* ── pending strip ─────────────────────────────────────────── */

function renderPendingStrip() {
  pendingStrip.replaceChildren();
  if (state.pendingCount < 1) {
    pendingStrip.hidden = true;
    return;
  }
  pendingStrip.hidden = false;
  const bar = el("div", { class: "pending" });
  bar.append(
    el("span", {}, state.pendingCount === 1 ? "1 unsaved moment" : `${state.pendingCount} unsaved moments`),
  );
  const retry = el("button", { type: "button" }, "Retry");
  retry.addEventListener("click", () => void retryPending(retry));
  bar.append(retry);
  pendingStrip.append(bar);
}

async function retryPending(button: HTMLButtonElement) {
  button.disabled = true;
  button.textContent = "Retrying…";
  const pending = await listPending();
  let remaining = pending.length;
  for (const item of pending) {
    const result = await postCapture(item);
    if (result.kind === "saved") {
      await removePending(item.clientKey);
      remaining -= 1;
    } else if (result.kind === "rejected") {
      // The server refused it outright; keeping it would strand the
      // strip at N forever. It stays only for retryable failures.
      await removePending(item.clientKey);
      remaining -= 1;
    }
  }
  state.pendingCount = remaining;
  renderPendingStrip();
}

/* ── settings ──────────────────────────────────────────────── */

let settingsOpen = false;

settingsToggle.addEventListener("click", () => {
  settingsOpen = !settingsOpen;
  settingsToggle.setAttribute("aria-expanded", String(settingsOpen));
  settingsEl.hidden = !settingsOpen;
  if (settingsOpen) void renderSettings();
});

async function renderSettings() {
  const env = await activeEnv();
  const base = await apiBase();
  settingsEl.replaceChildren();

  const account = el("div", { class: "settings-row" });
  account.append(el("span", { class: "label-tech" }, "Account"));
  const name =
    state.session?.kind === "connected"
      ? state.session.name ?? "Connected"
      : "Not connected";
  account.append(el("span", { class: "value" }, name));

  const envRow = el("div", { class: "settings-row" });
  envRow.append(el("span", { class: "label-tech" }, "Environment"));
  const select = el("select");
  for (const [key, cfg] of Object.entries(ENVIRONMENTS)) {
    const opt = el("option", { value: key }, cfg.label);
    if (key === env) opt.selected = true;
    select.append(opt);
  }
  select.addEventListener("change", async () => {
    await setActiveEnv(select.value as EnvName);
    settingsOpen = false;
    settingsEl.hidden = true;
    void boot();
  });
  envRow.append(select);

  const shortcut = el("div", { class: "settings-row" });
  shortcut.append(el("span", { class: "label-tech" }, "Shortcut"));
  shortcut.append(el("span", { class: "value data-mono" }, "Alt+Shift+M · chrome://extensions/shortcuts"));

  const links = el("div", { class: "settings-row" });
  links.append(el("span", { class: "label-tech" }, "MIDO XI"));
  const open = el("a", { href: "#" }, "Open the Player OS");
  open.addEventListener("click", (e) => {
    e.preventDefault();
    openTab(`${base}/app`);
  });
  links.append(open);

  const version = el("div", { class: "settings-row" });
  version.append(el("span", { class: "label-tech" }, "Version"));
  version.append(el("span", { class: "value data-mono" }, EXTENSION_VERSION));

  settingsEl.append(account, envRow, shortcut, links, version);
}

/* ── views ─────────────────────────────────────────────────── */

function render(view: View): void {
  viewEl.replaceChildren();
  switch (view.kind) {
    case "loading":
      viewEl.append(el("div", { class: "spinner", role: "status", "aria-label": "Loading" }));
      return;
    case "not-youtube":
      return renderSimpleState({
        icon: "play",
        title: "MIDO XI Capture",
        body: "Open a YouTube football video and capture the moments that matter.",
        actions: [
          { label: "Open YouTube", primary: true, onClick: () => openTab("https://www.youtube.com") },
          { label: "Open MIDO XI", onClick: async () => openTab(`${await apiBase()}/app`) },
        ],
      });
    case "auth-required":
      return renderAuth(view.sessionExpired === true);
    case "offline":
      return renderSimpleState({
        icon: "offline",
        title: "MIDO XI is unreachable",
        body: "Your observation stays on this device until the connection returns — nothing is lost.",
        actions: [{ label: "Try again", primary: true, onClick: () => void boot() }],
      });
    case "error":
      return renderSimpleState({
        icon: "offline",
        title: "Something went wrong",
        body: view.message,
        actions: [{ label: "Try again", primary: true, onClick: () => void boot() }],
      });
    case "capture":
      return renderCapture();
    case "saved":
      return renderSaved(view.stampLabel, view.openUrl);
  }
}

function renderSimpleState(cfg: {
  icon: keyof typeof ICONS;
  iconOk?: boolean;
  title: string;
  body: string;
  actions: { label: string; primary?: boolean; onClick: () => void }[];
}) {
  const wrap = el("div", { class: "state panel rise-in" });
  const tile = el("div", { class: `state-icon${cfg.iconOk ? " ok" : ""}` });
  tile.append(icon(cfg.icon));
  wrap.append(tile, el("h2", {}, cfg.title), el("p", {}, cfg.body));
  const actions = el("div", { class: "actions" });
  for (const a of cfg.actions) {
    const btn = el("button", { class: a.primary ? "btn-primary" : "btn-ghost", type: "button" }, a.label);
    btn.addEventListener("click", a.onClick);
    actions.append(btn);
  }
  wrap.append(actions);
  viewEl.append(wrap);
}

function renderAuth(expired: boolean) {
  const wrap = el("div", { class: "state panel rise-in" });
  const tile = el("div", { class: "state-icon" });
  tile.append(icon("play"));
  wrap.append(tile, el("h2", {}, expired ? "Session expired" : "MIDO XI Capture"));
  if (expired) {
    wrap.append(el("p", {}, "Sign back in to MIDO XI — your observation is kept on this device."));
  } else {
    wrap.append(el("p", {}, "Save football moments directly to your Player OS."));
    const steps = el("p", { class: "hint" });
    steps.textContent =
      "Watch football on YouTube. Spot something worth remembering. Capture it with MIDO.";
    wrap.append(steps);
  }
  const actions = el("div", { class: "actions" });
  const connect = el("button", { class: "btn-primary", type: "button" }, expired ? "Reconnect" : "Connect MIDO XI");
  connect.addEventListener("click", async () => {
    openTab(`${await apiBase()}/login?next=/app`);
  });
  const check = el("button", { class: "btn-ghost", type: "button" }, "I've signed in — check again");
  check.addEventListener("click", () => void boot());
  actions.append(connect, check);
  wrap.append(actions);
  viewEl.append(wrap);
}

/* ── the capture view ──────────────────────────────────────── */

function persistDraft() {
  if (!state.video) return;
  void writeDraft({
    videoId: state.video.videoId,
    observation: state.observation,
    goalId: state.goalId,
    category: state.category,
    savedAt: Date.now(),
  });
}

function buildInput(): CaptureInput | null {
  if (!state.video) return null;
  return {
    videoId: state.video.videoId,
    sourceUrl: state.video.url,
    videoTitle: state.video.title,
    channelName: state.video.channel,
    thumbnailUrl: state.video.thumbnailUrl,
    timestampSeconds: state.video.seconds,
    observation: state.observation.trim(),
    category: (state.category as CaptureInput["category"]) ?? null,
    goalId: state.goalId,
    clientKey: state.clientKey,
  };
}

function renderCapture(): void {
  if (!state.video) return render({ kind: "error", message: "No video detected." });
  const video = state.video;
  const session = state.session;
  const wrap = el("div", { class: "rise-in" });

  if (session?.kind === "connected" && session.demo) {
    const note = el("div", { class: "demo-note" });
    note.append(el("span", { class: "demo-dot" }), el("span", {}, "Demo MIDO XI — captures are not kept."));
    wrap.append(note);
  }

  /* video card */
  const card = el("div", { class: "video-card panel" });
  const thumb = el("img", {
    class: "video-thumb",
    alt: "",
    src: video.thumbnailUrl,
  });
  thumb.addEventListener("error", () => thumb.remove());
  const meta = el("div", { class: "video-meta" });
  meta.append(el("div", { class: "video-title" }, video.title));
  if (video.channel) meta.append(el("div", { class: "video-channel" }, video.channel));
  const stampRow = el("div", { class: "stamp-row" });
  const stamp = el("span", { class: "stamp stat-figure" }, formatTimestamp(video.seconds));
  const refresh = el("button", {
    class: "stamp-refresh",
    type: "button",
    title: "Update to the player's current time",
    "aria-label": "Update timestamp",
  });
  refresh.append(icon("refresh"));
  refresh.addEventListener("click", async () => {
    if (state.tabId == null) return;
    const s = await rereadSeconds(state.tabId);
    if (s != null) {
      video.seconds = s;
      stamp.textContent = formatTimestamp(s);
    }
  });
  stampRow.append(stamp, refresh);
  meta.append(stampRow);
  card.append(thumb, meta);
  wrap.append(card);

  /* error banner */
  if (state.formError) wrap.append(el("div", { class: "form-error", role: "alert" }, state.formError));

  /* observation */
  const obsSection = el("div", { class: "section" });
  const obsHead = el("div", { class: "section-head" });
  obsHead.append(el("label", { class: "label-tech", for: "observation" }, "What did you notice?"));
  const headRight = el("div", { style: "display:flex;align-items:center;gap:8px" });
  const count = el("span", { class: "char-count" });
  const syncCount = () => {
    const n = state.observation.length;
    count.textContent = n > OBSERVATION_MAX_CHARS - 200 ? `${n}/${OBSERVATION_MAX_CHARS}` : "";
    count.classList.toggle("warn", n >= OBSERVATION_MAX_CHARS);
  };
  headRight.append(count);
  obsHead.append(headRight);

  const textarea = el("textarea", {
    id: "observation",
    maxlength: String(OBSERVATION_MAX_CHARS),
    placeholder: "e.g. Checks away first, waits for the CB to look at the ball, then attacks his blindside.",
  });
  textarea.value = state.observation;
  textarea.addEventListener("input", () => {
    state.observation = textarea.value;
    state.formError = null;
    syncCount();
    persistDraft();
  });
  syncCount();
  obsSection.append(obsHead, textarea);

  /* voice — optional, feature-detected, transcription only */
  const speech = voiceButton(textarea);
  if (speech) headRight.prepend(speech);
  wrap.append(obsSection);

  /* goals */
  const goals = session?.kind === "connected" ? session.goals : [];
  const goalSection = el("div", { class: "section" });
  const goalHead = el("div", { class: "section-head" });
  goalHead.append(el("span", { class: "label-tech" }, "Connect to development"));
  goalSection.append(goalHead);
  if (goals.length === 0) {
    goalSection.append(el("p", { class: "hint" }, "No active goals — this capture saves on its own."));
  } else {
    const chips = el("div", { class: "chips", role: "group", "aria-label": "Development goals" });
    for (const goal of goals) {
      const chip = el("button", {
        class: "chip-select",
        type: "button",
        "aria-pressed": String(state.goalId === goal.id),
      });
      chip.append(document.createTextNode(goal.title));
      if (goal.category) chip.append(el("span", { class: "goal-cat" }, goal.category));
      chip.addEventListener("click", () => {
        state.goalId = state.goalId === goal.id ? null : goal.id;
        for (const c of chips.children) c.setAttribute("aria-pressed", "false");
        chip.setAttribute("aria-pressed", String(state.goalId === goal.id));
        persistDraft();
      });
      chips.append(chip);
    }
    goalSection.append(chips);
  }
  wrap.append(goalSection);

  /* category */
  const catSection = el("div", { class: "section" });
  const catHead = el("div", { class: "section-head" });
  catHead.append(el("span", { class: "label-tech" }, "Category"));
  catSection.append(catHead);
  const catChips = el("div", { class: "chips", role: "group", "aria-label": "Football category" });
  const visible = state.allCategories ? CAPTURE_CATEGORIES : CAPTURE_CATEGORIES.slice(0, 8);
  const selectedHidden = CAPTURE_CATEGORIES.slice(8).some((c) => c.value === state.category);
  const shown = state.allCategories || selectedHidden ? CAPTURE_CATEGORIES : visible;
  for (const cat of shown) {
    const chip = el(
      "button",
      { class: "chip-select", type: "button", "aria-pressed": String(state.category === cat.value) },
      cat.label,
    );
    chip.addEventListener("click", () => {
      state.category = state.category === cat.value ? null : cat.value;
      for (const c of catChips.querySelectorAll(".chip-select")) c.setAttribute("aria-pressed", "false");
      chip.setAttribute("aria-pressed", String(state.category === cat.value));
      persistDraft();
    });
    catChips.append(chip);
  }
  if (!state.allCategories && !selectedHidden) {
    const more = el("button", { class: "chip-more", type: "button" }, "+ More");
    more.addEventListener("click", () => {
      state.allCategories = true;
      render({ kind: "capture" });
    });
    catChips.append(more);
  }
  catSection.append(catChips);
  wrap.append(catSection);

  /* actions */
  const actions = el("div", { class: "actions" });
  const save = el("button", { class: "btn-primary", type: "button" }, "Save to MIDO");
  save.addEventListener("click", () => void submit(save));
  const openMido = el("button", { class: "btn-ghost", type: "button" }, "Open MIDO XI");
  openMido.addEventListener("click", async () => {
    const url = state.session?.kind === "connected" ? state.session.appUrl : await apiBase();
    openTab(`${url}/app`);
  });
  const row = el("div", { class: "actions-row" });
  row.append(openMido);
  actions.append(save, row);
  wrap.append(actions);

  viewEl.append(wrap);
  textarea.focus();
}

function voiceButton(textarea: HTMLTextAreaElement): HTMLButtonElement | null {
  const w = window as unknown as {
    webkitSpeechRecognition?: new () => {
      lang: string;
      interimResults: boolean;
      continuous: boolean;
      onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
      onend: (() => void) | null;
      onerror: (() => void) | null;
      start: () => void;
      stop: () => void;
    };
  };
  const Ctor = w.webkitSpeechRecognition;
  if (!Ctor) return null;

  const btn = el("button", {
    class: "icon-btn",
    type: "button",
    title: "Speak your observation",
    "aria-label": "Speak your observation",
    "aria-pressed": "false",
    style: "width:26px;height:26px",
  });
  btn.append(icon("mic"));

  let rec: InstanceType<typeof Ctor> | null = null;
  let listening = false;

  const stop = () => {
    listening = false;
    btn.setAttribute("aria-pressed", "false");
    try {
      rec?.stop();
    } catch {
      // Already stopped.
    }
  };

  btn.addEventListener("click", () => {
    if (listening) return stop();
    try {
      rec = new Ctor();
      rec.lang = "en-GB";
      rec.continuous = false;
      rec.interimResults = false;
      rec.onresult = (e) => {
        const finals: string[] = [];
        for (let i = 0; i < e.results.length; i++) {
          const r = e.results[i];
          if (r.isFinal && r[0]) finals.push(r[0].transcript);
        }
        if (finals.length) {
          const joined = finals.join(" ").trim();
          const existing = textarea.value.trim();
          textarea.value = (existing ? existing + " " : "") + joined;
          textarea.dispatchEvent(new Event("input"));
        }
      };
      rec.onend = stop;
      rec.onerror = stop;
      rec.start();
      listening = true;
      btn.setAttribute("aria-pressed", "true");
    } catch {
      stop();
    }
  });

  return btn;
}

/* ── save ──────────────────────────────────────────────────── */

async function submit(button: HTMLButtonElement) {
  if (state.saving) return;
  const input = buildInput();
  if (!input) return;

  const issue = captureIssue(input);
  if (issue) {
    state.formError = issue.message;
    render({ kind: "capture" });
    return;
  }

  state.saving = true;
  state.formError = null;
  button.disabled = true;
  button.textContent = "Saving…";

  const result = await postCapture(input);
  state.saving = false;

  if (result.kind === "saved") {
    await clearDraft();
    await removePending(input.clientKey);
    state.pendingCount = (await listPending()).length;
    renderPendingStrip();
    const stampLabel = formatTimestamp(input.timestampSeconds);
    state.observation = "";
    state.goalId = null;
    state.category = null;
    state.clientKey = crypto.randomUUID();
    render({ kind: "saved", stampLabel, openUrl: result.openUrl });
    return;
  }

  if (result.kind === "signed-out") {
    await pushPending(input);
    state.pendingCount = (await listPending()).length;
    renderPendingStrip();
    render({ kind: "auth-required", sessionExpired: true });
    return;
  }

  if (result.kind === "rejected") {
    // The server refused this capture as invalid; a retry of the same
    // payload cannot succeed, so it does not join the pending queue.
    // The text stays in the textarea and the draft.
    state.formError = result.message;
    render({ kind: "capture" });
    return;
  }

  // offline / server error — keep the capture, offer retry.
  await pushPending(input);
  state.pendingCount = (await listPending()).length;
  renderPendingStrip();
  state.formError =
    result.kind === "offline"
      ? "MIDO XI is unreachable. Your moment is kept on this device — retry when you're back online."
      : `${result.message} Your moment is kept on this device.`;
  render({ kind: "capture" });
}

function renderSaved(stampLabel: string, openUrl: string) {
  const wrap = el("div", { class: "state panel rise-in" });
  const tile = el("div", { class: "state-icon ok" });
  tile.append(icon("check"));
  wrap.append(tile, el("h2", {}, "Saved"));
  wrap.append(el("div", { class: "saved-stamp stat-figure" }, stampLabel));
  wrap.append(el("p", {}, "Added to your Player OS."));
  const actions = el("div", { class: "actions" });
  const view = el("button", { class: "btn-outline", type: "button" });
  view.append(document.createTextNode("View in MIDO"), icon("link"));
  view.addEventListener("click", () => openTab(openUrl));
  const again = el("button", { class: "btn-ghost", type: "button" }, "Capture another moment");
  again.addEventListener("click", async () => {
    // Fresh clock, same video — or whatever the tab shows now.
    render({ kind: "loading" });
    const page = await readCurrentPage();
    if (page.kind === "video") {
      state.video = page.context;
      state.tabId = page.tabId;
      render({ kind: "capture" });
    } else {
      render({ kind: "not-youtube" });
    }
  });
  actions.append(view, again);
  wrap.append(actions);
  viewEl.append(wrap);
}

void boot();
