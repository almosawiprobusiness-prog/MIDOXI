/*
  MIDO XI Capture — the popup.

  Free Mode architecture: the session decides a MODE, never whether the
  player may work. No account → LOCAL mode: capture straight into the
  on-device library. Signed in to MIDO XI → CONNECTED mode: goals load
  and saves go to the Player OS, with "save locally instead" as the
  fallback when the server cannot be reached. Capturing is never gated
  on a login, a network, or anything but a YouTube tab.

  Every piece of text from the network or the page goes through
  textContent — titles and API responses are data, never markup. The
  only innerHTML sink is the static icon set in lib/ui.ts.

  The state machine:

    loading → not-youtube | capture ⇄ library
    capture → saving → saved → (capture again)
                    ↘ failed (observation kept; retry, or keep it local)
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
import { clearDraft, readDraft, writeDraft } from "./lib/draft";
import { addToLibrary, clearLibrary, getFlag, libraryCount, listLibrary, setFlag, updateCapture } from "./lib/library";
import {
  asTrainIntent,
  connectForTrainingUrl,
  formatPriceCents,
  membershipUpgradeUrl,
  shouldShowSavedCta,
  trainingHandoffUrl,
} from "./lib/train-cta";
import { sendTelemetry } from "./lib/telemetry";
import { cryptoRandomId, formatLibraryMarkdown, toCaptureInput, type LocalCapture } from "./lib/library-core";
import { renderLibraryView } from "./library-view";
import { ENVIRONMENTS, EXTENSION_VERSION, activeEnv, apiBase, setActiveEnv, type EnvName } from "./lib/config";
import { downloadText, el, icon, openTab } from "./lib/ui";

type View =
  | { kind: "loading" }
  | { kind: "not-youtube" }
  | { kind: "capture" }
  | { kind: "library" }
  | { kind: "saved"; stampLabel: string; where: "mido" | "local"; openUrl?: string; count?: number; midoId?: string; localId?: string }
  /*
    The one conversion surface: "this lesson wants to become training,
    and that is MIDO XI Player". `back` restores exactly where the
    player was — the offer never consumes their place, let alone their
    moment. `localId` names the on-device lesson so the handoff INTENT
    can be remembered locally; it never leaves the device.
  */
  | { kind: "train-offer"; surface: "saved" | "library"; midoId?: string; localId?: string; back: View };

interface AppState {
  video: VideoContext | null;
  tabId: number | null;
  session: SessionState | null;
  mode: "connected" | "local";
  observation: string;
  goalId: string | null;
  category: string | null;
  clientKey: string;
  saving: boolean;
  formError: string | null;
  offerLocalFallback: boolean;
  allCategories: boolean;
  libCount: number;
  /** Last "Not now" on the training offer — cools the post-save CTA. */
  trainDismissedAt: string | null;
  /**
   * A lesson the player asked to train BEFORE they were entitled,
   * resolved from the stored handoff intent at boot. Non-null only
   * when connected + entitled and the moment still exists locally.
   */
  pendingIntent: LocalCapture | null;
}

const state: AppState = {
  video: null,
  tabId: null,
  session: null,
  mode: "local",
  observation: "",
  goalId: null,
  category: null,
  clientKey: cryptoRandomId(),
  saving: false,
  formError: null,
  offerLocalFallback: false,
  allCategories: false,
  libCount: 0,
  trainDismissedAt: null,
  pendingIntent: null,
};

const viewEl = document.getElementById("view") as HTMLElement;
const settingsEl = document.getElementById("settings") as HTMLElement;
const settingsToggle = document.getElementById("settings-toggle") as HTMLButtonElement;
const libraryToggle = document.getElementById("library-toggle") as HTMLButtonElement;
const modeBadge = document.getElementById("mode-badge") as HTMLElement;

/* ── boot ──────────────────────────────────────────────────── */

async function boot() {
  render({ kind: "loading" });
  const [page, session, count, trainDismissedAt] = await Promise.all([
    readCurrentPage(),
    fetchSession(),
    libraryCount(),
    getFlag<string>("trainCtaDismissedAt"),
  ]);
  state.session = session;
  state.mode = session.kind === "connected" ? "connected" : "local";
  state.libCount = count;
  state.trainDismissedAt = trainDismissedAt ?? null;

  /*
    The handoff intent resolves ONLY here, only when the promised
    outcome is deliverable: connected AND entitled. A free reconnect
    keeps the intent quietly for later; a deleted lesson clears it.
  */
  state.pendingIntent = null;
  if (session.kind === "connected" && session.entitled) {
    const intent = asTrainIntent(await getFlag("trainIntent"), Date.now());
    if (intent) {
      const lesson = (await listLibrary()).find((c) => c.id === intent.localId) ?? null;
      state.pendingIntent = lesson;
      if (!lesson) await setFlag("trainIntent", null);
    }
  }
  syncHeader();

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

function syncHeader() {
  modeBadge.textContent = state.mode === "local" ? "Local" : "";
  modeBadge.hidden = state.mode !== "local";
  libraryToggle.hidden = false;
  libraryToggle.setAttribute(
    "aria-label",
    state.libCount > 0 ? `My moments (${state.libCount})` : "My moments",
  );
  libraryToggle.title = state.libCount > 0 ? `My moments · ${state.libCount}` : "My moments";
}

/* ── settings ──────────────────────────────────────────────── */

let settingsOpen = false;

settingsToggle.addEventListener("click", () => {
  settingsOpen = !settingsOpen;
  settingsToggle.setAttribute("aria-expanded", String(settingsOpen));
  settingsEl.hidden = !settingsOpen;
  if (settingsOpen) void renderSettings();
});

libraryToggle.addEventListener("click", () => {
  settingsOpen = false;
  settingsEl.hidden = true;
  render({ kind: "library" });
});

async function renderSettings() {
  const env = await activeEnv();
  const base = await apiBase();
  settingsEl.replaceChildren();

  /* account — the one MIDO XI connect point; explanatory, not pushy */
  const account = el("div", { class: "settings-row" });
  account.append(el("span", { class: "label-tech" }, "Account"));
  if (state.session?.kind === "connected") {
    account.append(el("span", { class: "value" }, state.session.name ?? "Connected to MIDO XI"));
  } else {
    const connect = el("button", { class: "settings-connect", type: "button" }, "Connect MIDO XI");
    connect.addEventListener("click", () => openTab(`${base}/login?next=/app`));
    account.append(connect);
  }
  settingsEl.append(account);

  if (state.session?.kind !== "connected") {
    settingsEl.append(
      el(
        "p",
        { class: "settings-note" },
        "Local mode — moments save to this device. MIDO XI connects them to your goals, studies and development.",
      ),
    );
  }

  /* data */
  const data = el("div", { class: "settings-row" });
  data.append(el("span", { class: "label-tech" }, "Data"));
  const dataActions = el("div", { class: "settings-actions" });
  const exp = el("button", { class: "settings-connect", type: "button" }, "Export library");
  exp.addEventListener("click", async () => {
    const all = await listLibrary();
    downloadText(`mido-xi-capture-${new Date().toISOString().slice(0, 10)}.md`, formatLibraryMarkdown(all), "text/markdown");
  });
  dataActions.append(exp);
  data.append(dataActions);
  settingsEl.append(data);

  /* clear — two-step arm, states the count, never one click */
  const clearRow = el("div", { class: "settings-row" });
  clearRow.append(el("span", { class: "label-tech" }, ""));
  const clear = el("button", { class: "settings-danger", type: "button" }, "Clear local library…");
  let armed = false;
  clear.addEventListener("click", async () => {
    if (!armed) {
      const n = await libraryCount();
      if (n === 0) {
        clear.textContent = "Library is already empty";
        setTimeout(() => (clear.textContent = "Clear local library…"), 1500);
        return;
      }
      armed = true;
      clear.classList.add("armed");
      clear.textContent = `Delete all ${n} moments — click again to confirm`;
      setTimeout(() => {
        armed = false;
        clear.classList.remove("armed");
        clear.textContent = "Clear local library…";
      }, 5000);
      return;
    }
    await clearLibrary();
    state.libCount = 0;
    syncHeader();
    armed = false;
    clear.classList.remove("armed");
    clear.textContent = "Library cleared";
    setTimeout(() => (clear.textContent = "Clear local library…"), 1500);
  });
  clearRow.append(clear);
  settingsEl.append(clearRow);

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
  links.append(el("span", { class: "label-tech" }, "Privacy"));
  const privacy = el("a", { href: "#" }, "What Capture accesses");
  privacy.addEventListener("click", (e) => {
    e.preventDefault();
    openTab(`${base}/privacy`);
  });
  links.append(privacy);

  const version = el("div", { class: "settings-row" });
  version.append(el("span", { class: "label-tech" }, "Version"));
  version.append(el("span", { class: "value data-mono" }, EXTENSION_VERSION));

  settingsEl.append(envRow, shortcut, links, version);
}

/* ── views ─────────────────────────────────────────────────── */

function render(view: View): void {
  viewEl.replaceChildren();
  switch (view.kind) {
    case "loading":
      viewEl.append(el("div", { class: "spinner", role: "status", "aria-label": "Loading" }));
      return;
    case "not-youtube":
      return renderNotYoutube();
    case "capture":
      return renderCapture();
    case "library":
      void renderLibraryView(viewEl, {
        connected: state.mode === "connected",
        entitled: state.session?.kind === "connected" && state.session.entitled,
        appUrl: state.session?.kind === "connected" ? state.session.appUrl : null,
        onTrainLocked: ({ midoId, localId }) =>
          render({ kind: "train-offer", surface: "library", midoId, localId, back: { kind: "library" } }),
        onBack: async () => {
          state.libCount = await libraryCount();
          syncHeader();
          render(state.video ? { kind: "capture" } : { kind: "not-youtube" });
        },
      });
      return;
    case "saved":
      return renderSaved(view);
    case "train-offer":
      return renderTrainOffer(view);
  }
}

function renderNotYoutube() {
  if (state.pendingIntent) viewEl.append(intentBanner(state.pendingIntent));
  const wrap = el("div", { class: "state panel rise-in" });
  const tile = el("div", { class: "state-icon" });
  tile.append(icon("play"));
  wrap.append(
    tile,
    el("h2", {}, "MIDO XI Capture"),
    el("p", {}, "Open football on any site — YouTube, sport.video, Veo, your club’s stream — and capture the moments that matter."),
  );
  const actions = el("div", { class: "actions" });
  const yt = el("button", { class: "btn-primary", type: "button" }, "Open YouTube");
  yt.addEventListener("click", () => openTab("https://www.youtube.com"));
  actions.append(yt);
  if (state.libCount > 0) {
    const lib = el("button", { class: "btn-ghost", type: "button" }, `My moments · ${state.libCount}`);
    lib.addEventListener("click", () => render({ kind: "library" }));
    actions.append(lib);
  }
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
    thumbnailUrl: state.video.thumbnailUrl || null,
    sourceType: state.video.sourceType,
    timestampSeconds: state.video.seconds,
    observation: state.observation.trim(),
    category: (state.category as CaptureInput["category"]) ?? null,
    goalId: state.mode === "connected" ? state.goalId : null,
    clientKey: state.clientKey,
  };
}

function renderCapture(): void {
  if (!state.video) return render({ kind: "not-youtube" });
  const video = state.video;
  const session = state.session;
  const connected = state.mode === "connected";
  const wrap = el("div", { class: "rise-in" });

  if (state.pendingIntent) wrap.append(intentBanner(state.pendingIntent));

  if (session?.kind === "connected" && session.demo) {
    const note = el("div", { class: "demo-note" });
    note.append(el("span", { class: "demo-dot" }), el("span", {}, "Demo MIDO XI — captures are not kept."));
    wrap.append(note);
  }

  /* video card */
  const card = el("div", { class: "video-card panel" });
  // Listener BEFORE src: a fast 404 must not beat the handler and leave
  // a broken-image box in the card.
  const thumb = el("img", { class: "video-thumb", alt: "" });
  thumb.addEventListener("error", () => thumb.remove());
  if (video.thumbnailUrl) thumb.src = video.thumbnailUrl;
  else thumb.remove(); // web captures carry no thumbnail — no broken box
  const meta = el("div", { class: "video-meta" });
  meta.append(el("div", { class: "label-tech video-eyebrow" }, "Current moment"));
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

  /* error banner (+ optional local fallback for connected failures) */
  if (state.formError) {
    const box = el("div", { class: "form-error", role: "alert" });
    box.append(el("span", {}, state.formError));
    if (state.offerLocalFallback) {
      const localBtn = el("button", { class: "form-error-action", type: "button" }, "Save locally instead");
      localBtn.addEventListener("click", () => void saveLocal());
      box.append(localBtn);
    }
    wrap.append(box);
  }

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

  const speech = voiceButton(textarea);
  if (speech) headRight.prepend(speech);
  wrap.append(obsSection);

  /* goals — connected mode only; local mode shows nothing fake */
  if (connected) {
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
  }

  /* category */
  const catSection = el("div", { class: "section" });
  const catHead = el("div", { class: "section-head" });
  catHead.append(el("span", { class: "label-tech" }, "Category"));
  catSection.append(catHead);
  const catChips = el("div", { class: "chips", role: "group", "aria-label": "Football category" });
  const selectedHidden = CAPTURE_CATEGORIES.slice(8).some((c) => c.value === state.category);
  const shown = state.allCategories || selectedHidden ? CAPTURE_CATEGORIES : CAPTURE_CATEGORIES.slice(0, 8);
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
  const save = el("button", { class: "btn-primary", type: "button" }, connected ? "Save to MIDO" : "Save moment");
  save.addEventListener("click", () => (connected ? void submitConnected(save) : void saveLocal(save)));
  const row = el("div", { class: "actions-row" });
  if (connected) {
    const openMido = el("button", { class: "btn-ghost", type: "button" }, "Open MIDO XI");
    openMido.addEventListener("click", async () => {
      const url = session?.kind === "connected" ? session.appUrl : await apiBase();
      openTab(`${url}/app`);
    });
    row.append(openMido);
  } else {
    // The one quiet nudge in the capture flow — explanatory, skippable.
    const connect = el("button", { class: "connect-link", type: "button" }, "Connect MIDO XI");
    connect.title = "Link moments to your goals, studies and development";
    connect.addEventListener("click", async () => openTab(`${await apiBase()}/login?next=/app`));
    row.append(connect);
  }
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

/* ── saving ────────────────────────────────────────────────── */

function validate(): CaptureInput | null {
  const input = buildInput();
  if (!input) return null;
  const issue = captureIssue(input);
  if (issue) {
    state.formError = issue.message;
    state.offerLocalFallback = false;
    render({ kind: "capture" });
    return null;
  }
  return input;
}

function resetAfterSave(): { stampLabel: string } {
  const stampLabel = formatTimestamp(state.video?.seconds ?? 0);
  state.observation = "";
  state.goalId = null;
  state.category = null;
  state.formError = null;
  state.offerLocalFallback = false;
  state.clientKey = cryptoRandomId();
  return { stampLabel };
}

/** Free Mode's save: straight into the on-device library. No network. */
async function saveLocal(button?: HTMLButtonElement): Promise<void> {
  if (state.saving) return;
  const input = validate();
  if (!input || !state.video) return;

  state.saving = true;
  if (button) {
    button.disabled = true;
    button.textContent = "Saving…";
  }

  const capture: LocalCapture = {
    id: input.clientKey ?? cryptoRandomId(),
    videoId: input.videoId,
    sourceUrl: input.sourceUrl,
    videoTitle: input.videoTitle,
    channelName: input.channelName ?? null,
    thumbnailUrl: input.thumbnailUrl ?? null,
    timestampSeconds: input.timestampSeconds,
    observation: input.observation,
    category: input.category ?? null,
    createdAt: new Date().toISOString(),
    updatedAt: null,
    syncState: "local",
    origin: "chrome_extension",
    sourceType: input.sourceType ?? "youtube",
  };
  const result = await addToLibrary(capture);
  state.saving = false;

  if (!result.ok) {
    // The text is untouched in the textarea and the draft; say why.
    state.formError =
      result.reason === "full"
        ? "Your library is full (2000 moments). Export it, then clear space."
        : "Couldn't write to this device's storage. Your text is kept here — try again.";
    state.offerLocalFallback = false;
    render({ kind: "capture" });
    return;
  }

  await clearDraft();
  state.libCount = result.count;
  syncHeader();
  const { stampLabel } = resetAfterSave();
  render({ kind: "saved", where: "local", stampLabel, count: result.count, localId: capture.id });
}

/** Connected save: to MIDO XI, with the library as the safety net. */
async function submitConnected(button: HTMLButtonElement): Promise<void> {
  if (state.saving) return;
  const input = validate();
  if (!input) return;

  state.saving = true;
  state.formError = null;
  state.offerLocalFallback = false;
  button.disabled = true;
  button.textContent = "Saving…";

  const result = await postCapture(input);
  state.saving = false;

  if (result.kind === "saved") {
    await clearDraft();
    const { stampLabel } = resetAfterSave();
    render({ kind: "saved", where: "mido", stampLabel, openUrl: result.openUrl, midoId: result.id });
    return;
  }

  if (result.kind === "rejected") {
    // Refused as invalid — retrying unchanged cannot succeed, and the
    // text stays in the textarea and the draft.
    state.formError = result.message;
    state.offerLocalFallback = false;
    render({ kind: "capture" });
    return;
  }

  // signed-out / offline / server error: nothing is lost — offer the
  // library, which is exactly what Free Mode uses on purpose.
  state.formError =
    result.kind === "signed-out"
      ? "Your MIDO XI session expired. Reconnect — or keep the moment on this device."
      : result.kind === "offline"
        ? "MIDO XI is unreachable. Your moment can save to this device instead."
        : `${result.message} Your moment can save to this device instead.`;
  state.offerLocalFallback = true;
  render({ kind: "capture" });
}

function renderSaved(view: Extract<View, { kind: "saved" }>): void {
  const wrap = el("div", { class: "state panel rise-in" });
  const tile = el("div", { class: "state-icon ok" });
  tile.append(icon("check"));
  wrap.append(tile, el("h2", {}, "Saved"));
  wrap.append(el("div", { class: "saved-stamp stat-figure" }, view.stampLabel));

  if (view.where === "mido") {
    wrap.append(el("p", {}, "Added to your Player OS."));
  } else if (view.count === 1) {
    wrap.append(el("p", {}, "Your first moment is in your library."));
  } else if (view.count === 10) {
    wrap.append(el("p", {}, "10 moments — you're building a real study library. MIDO XI can connect them to your development goals."));
  } else {
    wrap.append(el("p", {}, "Added to your library on this device."));
  }

  /*
    THE conversion surface. "I noticed something important" is the
    moment "how do I train this?" is real — the CTA lives here, after
    the save is banked, and nowhere louder. Entitled players get a
    capability; everyone else gets one restrained offer that a "Not
    now" quiets for a week. A connected-mode save that fell back to
    local (server unreachable) skips it: the bridge it advertises is
    down.
  */
  const offerHere = view.where === "mido" || state.mode === "local";
  if (
    offerHere &&
    shouldShowSavedCta({
      entitled: state.session?.kind === "connected" && state.session.entitled,
      mode: state.mode,
      savedCount: view.count ?? state.libCount,
      dismissedAt: state.trainDismissedAt,
      nowMs: Date.now(),
    })
  ) {
    wrap.append(trainCtaBlock({ surface: "saved", midoId: view.midoId, localId: view.localId, back: view }));
  }

  const actions = el("div", { class: "actions" });
  if (view.where === "mido" && view.openUrl) {
    const open = el("button", { class: "btn-outline", type: "button" });
    open.append(document.createTextNode("View in MIDO"), icon("link"));
    open.addEventListener("click", () => openTab(view.openUrl as string));
    actions.append(open);
  } else {
    const lib = el("button", { class: "btn-outline", type: "button" }, "View library");
    lib.addEventListener("click", () => render({ kind: "library" }));
    actions.append(lib);
  }
  const again = el("button", { class: "btn-ghost", type: "button" }, "Capture another moment");
  again.addEventListener("click", async () => {
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
  actions.append(again);
  wrap.append(actions);
  viewEl.append(wrap);
}

/* ── the Capture → Training bridge ─────────────────────────── */

/**
 * The compact CTA. One button, one line of copy, styled like every
 * other panel — no modal, no countdown, no interruption. Entitled
 * players go straight to MIDO XI Training with this lesson loaded;
 * everyone else sees the offer view.
 */
function trainCtaBlock(opts: { surface: "saved" | "library"; midoId?: string; localId?: string; back: View }): HTMLElement {
  const connected = state.mode === "connected";
  const entitled = state.session?.kind === "connected" && state.session.entitled;
  if (connected) sendTelemetry("capture_training_cta_shown", { surface: opts.surface, entitled });

  const box = el("div", { class: "train-cta panel" });
  const head = el("div", { class: "label-tech train-cta-eyebrow" }, entitled ? "From this lesson" : "Next step");
  const btn = el("button", { class: "train-cta-btn", type: "button" });
  btn.append(icon("target"), document.createTextNode("Build a training session"));
  const sub = el("p", { class: "train-cta-sub" }, "Turn this lesson into a session built around your game.");
  btn.addEventListener("click", () => {
    if (connected) sendTelemetry("capture_training_cta_clicked", { surface: opts.surface, entitled });
    if (entitled && opts.midoId && state.session?.kind === "connected") {
      openTab(trainingHandoffUrl(state.session.appUrl, opts.midoId));
      return;
    }
    render({ kind: "train-offer", surface: opts.surface, midoId: opts.midoId, localId: opts.localId, back: opts.back });
  });
  box.append(head, btn, sub);
  return box;
}

/** Remember WHICH local lesson asked to be trained — locally, only. */
async function rememberTrainIntent(localId: string): Promise<void> {
  await setFlag("trainIntent", { localId, savedAt: new Date().toISOString() });
}

/**
 * The kept promise. A player who pressed BUILD A TRAINING SESSION
 * before they were entitled comes back to exactly that lesson: one
 * explicit "Use this lesson" imports the single Moment and opens
 * Training with its server id. Failure leaves the local copy — and the
 * intent — untouched, so retry is always possible.
 */
function intentBanner(lesson: LocalCapture): HTMLElement {
  const session = state.session;
  const box = el("div", { class: "train-intent panel" });
  box.append(el("div", { class: "label-tech train-cta-eyebrow" }, "Your saved lesson"));
  const title = el("div", { class: "train-intent-title" }, lesson.videoTitle);
  title.append(el("span", { class: "data-mono train-intent-stamp" }, ` · ${formatTimestamp(lesson.timestampSeconds)}`));
  box.append(title);
  box.append(el("p", { class: "train-cta-sub" }, "Ready to turn into a training session."));
  const err = el("p", { class: "train-intent-err" });
  err.hidden = true;
  const row = el("div", { class: "train-intent-row" });
  const use = el("button", { class: "train-cta-btn", type: "button" }, "Use this lesson");
  use.addEventListener("click", async () => {
    if (session?.kind !== "connected") return;
    sendTelemetry("capture_training_cta_clicked", { surface: "intent", entitled: true });
    use.disabled = true;
    use.textContent = "Importing…";
    // Already in MIDO (imported some other way)? Just deliver.
    if (lesson.syncState === "synced" && lesson.midoId) {
      await setFlag("trainIntent", null);
      state.pendingIntent = null;
      openTab(trainingHandoffUrl(session.appUrl, lesson.midoId));
      box.remove();
      return;
    }
    const result = await postCapture(toCaptureInput(lesson), "import");
    if (result.kind === "saved") {
      await updateCapture(lesson.id, { syncState: "synced", midoId: result.id });
      await setFlag("trainIntent", null);
      state.pendingIntent = null;
      openTab(trainingHandoffUrl(session.appUrl, result.id));
      box.remove();
      return;
    }
    use.disabled = false;
    use.textContent = "Use this lesson";
    err.textContent = "Couldn't import this lesson. Your local copy is safe — try again.";
    err.hidden = false;
  });
  const dismiss = el("button", { class: "btn-ghost lib-mini", type: "button" }, "Dismiss");
  dismiss.addEventListener("click", async () => {
    await setFlag("trainIntent", null);
    state.pendingIntent = null;
    box.remove();
  });
  row.append(use, dismiss);
  box.append(err, row);
  return box;
}

/**
 * The offer itself — the honest version of a paywall. Connected-free
 * sees the canonical price and an unlock button; Free Mode sees an
 * explanation and a connect button, with its local moment explicitly
 * untouched. "Not now" quiets the automatic post-save CTA for a week
 * and returns the player exactly where they were.
 */
function renderTrainOffer(view: Extract<View, { kind: "train-offer" }>): void {
  const session = state.session;
  const connected = state.mode === "connected" && session?.kind === "connected";
  if (connected) sendTelemetry("capture_training_upgrade_viewed", { surface: view.surface });

  const wrap = el("div", { class: "state panel rise-in train-offer" });
  const tile = el("div", { class: "state-icon" });
  tile.append(icon("target"));
  wrap.append(tile);

  const actions = el("div", { class: "actions" });

  if (state.mode === "connected" && session?.kind === "connected") {
    wrap.append(
      el("h2", {}, "You saw the lesson. Now train it."),
      el(
        "p",
        {},
        "Your lesson is saved. MIDO XI Player can turn it into a personalized training session using your position, development goals, studies and recent work.",
      ),
    );
    const pricing = session.pricing;
    if (pricing) {
      const priceRow = el("div", { class: "train-price" });
      priceRow.append(
        el("span", { class: "stat-figure train-price-figure" }, formatPriceCents(pricing.monthlyCents)),
        el("span", { class: "train-price-unit" }, "/month"),
      );
      wrap.append(priceRow);
      wrap.append(el("p", { class: "train-price-alt" }, `or ${formatPriceCents(pricing.annualCents)}/year`));
    }
    const unlock = el("button", { class: "btn-primary", type: "button" }, "Unlock MIDO XI");
    unlock.addEventListener("click", async () => {
      // A moment that lives only on this device can't ride the checkout
      // return URL — remember it locally so the entitled reconnect can
      // offer exactly this lesson. Ids already in MIDO ride the URL.
      if (!view.midoId && view.localId) await rememberTrainIntent(view.localId);
      openTab(membershipUpgradeUrl(session.appUrl, view.midoId));
    });
    actions.append(unlock);
  } else {
    wrap.append(
      el("h2", {}, "Build a training session"),
      el(
        "p",
        {},
        "Your moment is saved on this device — nothing has been uploaded. Turning a lesson into a session built around your position, goals and development history is MIDO XI Player.",
      ),
    );
    const connect = el("button", { class: "btn-primary", type: "button" }, "Continue to MIDO XI");
    connect.addEventListener("click", async () => {
      // The lesson stays on this device; only its LOCAL id is kept, so
      // the entitled return can offer "Use this lesson" explicitly.
      if (view.localId) await rememberTrainIntent(view.localId);
      openTab(connectForTrainingUrl(await apiBase()));
    });
    actions.append(connect);
  }

  const notNow = el("button", { class: "btn-ghost", type: "button" }, "Not now");
  notNow.addEventListener("click", async () => {
    const iso = new Date().toISOString();
    state.trainDismissedAt = iso;
    await setFlag("trainCtaDismissedAt", iso);
    render(view.back);
  });
  actions.append(notNow);
  wrap.append(actions);
  viewEl.append(wrap);
}

void boot();
