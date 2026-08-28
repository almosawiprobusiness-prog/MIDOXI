/*
  MY MOMENTS — the local capture library.

  Free Mode's second half: finding what you saved. One scrolling list
  with immediate client-side search, category chips built from what the
  library actually contains, per-moment watch/copy/edit/delete (with
  undo), Markdown/JSON export, and — when MIDO XI is connected — an
  explicit, idempotent import of local moments. Nothing uploads without
  the player pressing the button that says so.
*/
import {
  CAPTURE_CATEGORIES,
  OBSERVATION_MAX_CHARS,
  captureCategoryLabel,
  formatTimestamp,
  timestampedYoutubeUrl,
  type CaptureCategory,
} from "../../lib/data/capture-types";
import {
  dateLabel,
  filterCaptures,
  formatCaptureText,
  formatLibraryJson,
  formatLibraryMarkdown,
  pendingImport,
  toCaptureInput,
  type LocalCapture,
} from "./lib/library-core";
import {
  getFlag,
  listLibrary,
  removeFromLibrary,
  restoreToLibrary,
  setFlag,
  updateCapture,
} from "./lib/library";
import { postCapture } from "./lib/api";
import { copyText, downloadText, el, icon, openTab } from "./lib/ui";

export interface LibraryDeps {
  connected: boolean;
  onBack: () => void;
}

interface ViewState {
  all: LocalCapture[];
  text: string;
  category: CaptureCategory | null;
  editingId: string | null;
  undo: { capture: LocalCapture; timer: number } | null;
  importNote: string | null;
  importing: boolean;
}

export async function renderLibraryView(container: HTMLElement, deps: LibraryDeps): Promise<void> {
  const state: ViewState = {
    all: await listLibrary(),
    text: "",
    category: null,
    editingId: null,
    undo: null,
    importNote: null,
    importing: false,
  };

  let dismissed = (await getFlag<string>("importDismissedAt")) ?? "";

  function paint(): void {
    container.replaceChildren();
    const wrap = el("div", { class: "rise-in" });

    /* header */
    const head = el("div", { class: "lib-head" });
    const back = el("button", { class: "icon-btn", type: "button", "aria-label": "Back to capture" });
    back.append(icon("back"));
    back.addEventListener("click", deps.onBack);
    const title = el("div");
    title.append(el("div", { class: "label-tech" }, `My moments · ${state.all.length}`));
    const exportRow = el("div", { class: "lib-export" });
    if (state.all.length > 0) {
      const md = el("button", { class: "btn-ghost lib-export-btn", type: "button", title: "Download your library as Markdown" });
      md.append(icon("download"), document.createTextNode("Export .md"));
      md.addEventListener("click", () => {
        downloadText(`mido-xi-capture-${new Date().toISOString().slice(0, 10)}.md`, formatLibraryMarkdown(state.all), "text/markdown");
        flash(md, "Exported");
      });
      const json = el("button", { class: "lib-json", type: "button", title: "Download as JSON (backup)" }, "json");
      json.addEventListener("click", () => {
        downloadText(`mido-xi-capture-${new Date().toISOString().slice(0, 10)}.json`, formatLibraryJson(state.all), "application/json");
      });
      exportRow.append(md, json);
    }
    head.append(back, title, exportRow);
    wrap.append(head);

    /* import banner — connected + local moments awaiting */
    const pending = pendingImport(state.all);
    const newestPending = pending[0]?.createdAt ?? "";
    if (deps.connected && pending.length > 0 && (state.importNote !== null || newestPending > dismissed)) {
      wrap.append(importBanner(pending));
    } else if (state.importNote) {
      wrap.append(el("p", { class: "lib-import-note" }, state.importNote));
    }

    /* search */
    if (state.all.length > 0) {
      const searchRow = el("div", { class: "lib-search" });
      searchRow.append(icon("search"));
      const input = el("input", {
        type: "search",
        placeholder: "Search moments…",
        "aria-label": "Search moments",
        value: state.text,
      });
      input.addEventListener("input", () => {
        state.text = input.value;
        paintList();
      });
      searchRow.append(input);
      wrap.append(searchRow);

      /* category chips from what exists */
      const present = CAPTURE_CATEGORIES.filter((c) => state.all.some((m) => m.category === c.value));
      if (present.length > 0) {
        const chips = el("div", { class: "chips lib-filter", role: "group", "aria-label": "Filter by category" });
        const allChip = el("button", { class: "chip-select", type: "button", "aria-pressed": String(state.category === null) }, "All");
        allChip.addEventListener("click", () => {
          state.category = null;
          paint();
        });
        chips.append(allChip);
        for (const c of present) {
          const chip = el("button", { class: "chip-select", type: "button", "aria-pressed": String(state.category === c.value) }, c.label);
          chip.addEventListener("click", () => {
            state.category = state.category === c.value ? null : c.value;
            paint();
          });
          chips.append(chip);
        }
        wrap.append(chips);
      }
    }

    /* list */
    const list = el("div", { class: "lib-list", id: "lib-list" });
    wrap.append(list);

    /* undo bar */
    if (state.undo) {
      const bar = el("div", { class: "lib-undo" });
      bar.append(el("span", {}, "Moment deleted"));
      const undoBtn = el("button", { type: "button" }, "Undo");
      undoBtn.addEventListener("click", async () => {
        if (!state.undo) return;
        clearTimeout(state.undo.timer);
        await restoreToLibrary(state.undo.capture);
        state.undo = null;
        state.all = await listLibrary();
        paint();
      });
      bar.append(undoBtn);
      wrap.append(bar);
    }

    container.append(wrap);
    paintList();
  }

  function paintList(): void {
    const list = container.querySelector<HTMLElement>("#lib-list");
    if (!list) return;
    list.replaceChildren();

    if (state.all.length === 0) {
      const empty = el("div", { class: "state panel" });
      const tile = el("div", { class: "state-icon" });
      tile.append(icon("library"));
      empty.append(
        tile,
        el("h2", {}, "No moments yet"),
        el("p", {}, "Watch football. Notice something. Capture it."),
      );
      const actions = el("div", { class: "actions" });
      const backBtn = el("button", { class: "btn-ghost", type: "button" }, "Return to video");
      backBtn.addEventListener("click", deps.onBack);
      actions.append(backBtn);
      empty.append(actions);
      list.append(empty);
      return;
    }

    const shown = filterCaptures(state.all, { text: state.text, category: state.category });
    if (shown.length === 0) {
      list.append(el("p", { class: "hint lib-none" }, "Nothing matches that search."));
      return;
    }
    for (const c of shown) list.append(card(c));
  }

  function card(c: LocalCapture): HTMLElement {
    const row = el("article", { class: "panel lib-card" });

    const top = el("div", { class: "lib-card-top" });
    if (c.thumbnailUrl) {
      const thumbBtn = el("button", { class: "lib-thumb", type: "button", "aria-label": `Watch ${c.videoTitle} at ${formatTimestamp(c.timestampSeconds)}` });
      const img = el("img", { src: c.thumbnailUrl, alt: "" });
      img.addEventListener("error", () => thumbBtn.remove());
      thumbBtn.append(img);
      thumbBtn.addEventListener("click", () => openTab(timestampedYoutubeUrl(c.videoId, c.timestampSeconds)));
      top.append(thumbBtn);
    }
    const meta = el("div", { class: "lib-meta" });
    const titleRow = el("div", { class: "lib-title-row" });
    titleRow.append(el("span", { class: "lib-title" }, c.videoTitle));
    titleRow.append(el("span", { class: "data-mono lib-stamp" }, formatTimestamp(c.timestampSeconds)));
    meta.append(titleRow);
    const sub = el("div", { class: "lib-sub" });
    sub.append(el("span", {}, dateLabel(c.createdAt)));
    if (c.channelName) sub.append(el("span", {}, c.channelName));
    meta.append(sub);
    top.append(meta);
    row.append(top);

    /* observation — read or edit */
    if (state.editingId === c.id) {
      const ta = el("textarea", { class: "lib-edit", maxlength: String(OBSERVATION_MAX_CHARS) });
      ta.value = c.observation;
      const editRow = el("div", { class: "lib-edit-row" });
      const save = el("button", { class: "btn-outline lib-mini", type: "button" }, "Save");
      save.addEventListener("click", async () => {
        const text = ta.value.trim();
        if (!text) return;
        await updateCapture(c.id, { observation: text });
        state.editingId = null;
        state.all = await listLibrary();
        paint();
      });
      const cancel = el("button", { class: "btn-ghost lib-mini", type: "button" }, "Cancel");
      cancel.addEventListener("click", () => {
        state.editingId = null;
        paint();
      });
      editRow.append(save, cancel);
      row.append(ta, editRow);
    } else {
      row.append(el("p", { class: "lib-obs" }, `“${c.observation}”`));
    }

    /* chips + actions */
    const foot = el("div", { class: "lib-foot" });
    if (c.category) foot.append(el("span", { class: "chip" }, captureCategoryLabel(c.category)));
    if (c.syncState === "synced") foot.append(el("span", { class: "chip chip-signal" }, "In MIDO"));

    const actions = el("div", { class: "lib-actions" });
    const watch = el("button", { class: "lib-act lib-act-watch", type: "button" }, "Watch");
    watch.addEventListener("click", () => openTab(timestampedYoutubeUrl(c.videoId, c.timestampSeconds)));
    const copy = el("button", { class: "lib-act", type: "button", title: "Copy formatted note", "aria-label": "Copy" });
    copy.append(icon("copy"));
    copy.addEventListener("click", async () => {
      if (await copyText(formatCaptureText(c))) flash(copy, null, "check");
    });
    const edit = el("button", { class: "lib-act", type: "button", title: "Edit observation", "aria-label": "Edit" });
    edit.append(icon("pencil"));
    edit.addEventListener("click", () => {
      state.editingId = c.id;
      paint();
    });
    const del = el("button", { class: "lib-act lib-act-del", type: "button", title: "Delete moment", "aria-label": "Delete" });
    del.append(icon("trash"));
    del.addEventListener("click", async () => {
      const gone = await removeFromLibrary(c.id);
      if (!gone) return;
      if (state.undo) clearTimeout(state.undo.timer);
      state.undo = {
        capture: gone,
        timer: window.setTimeout(() => {
          state.undo = null;
          paint();
        }, 6000),
      };
      state.all = await listLibrary();
      paint();
    });
    actions.append(watch, copy, edit, del);
    foot.append(actions);
    row.append(foot);
    return row;
  }

  function importBanner(pending: LocalCapture[]): HTMLElement {
    const box = el("div", { class: "lib-import panel" });
    if (state.importNote) {
      box.append(el("p", { class: "lib-import-note" }, state.importNote));
    } else {
      box.append(
        el("div", { class: "label-tech" }, `${pending.length} local moment${pending.length === 1 ? "" : "s"}`),
        el("p", {}, "Import them into your MIDO XI library? They also stay on this device."),
      );
    }
    const row = el("div", { class: "lib-import-row" });
    const go = el("button", { class: "btn-outline lib-mini", type: "button" }, state.importing ? "Importing…" : `Import ${pending.length}`);
    go.disabled = state.importing;
    go.addEventListener("click", () => void runImport(go));
    const keep = el("button", { class: "btn-ghost lib-mini", type: "button" }, "Keep local");
    keep.addEventListener("click", async () => {
      // Dismissal is sticky until a NEWER local moment appears — the
      // banner respects the choice without hiding future work.
      await setFlag("importDismissedAt", new Date().toISOString());
      dismissed = new Date().toISOString();
      state.importNote = null;
      paint();
    });
    if (!state.importNote) row.append(go, keep);
    box.append(row);
    return box;
  }

  async function runImport(button: HTMLButtonElement): Promise<void> {
    if (state.importing) return;
    state.importing = true;
    button.disabled = true;
    const pending = pendingImport(state.all);
    let imported = 0;
    let failed = 0;
    let i = 0;
    for (const c of pending) {
      i += 1;
      button.textContent = `Importing ${i}/${pending.length}…`;
      const result = await postCapture(toCaptureInput(c), "import");
      if (result.kind === "saved") {
        await updateCapture(c.id, { syncState: "synced", midoId: result.id });
        imported += 1;
      } else {
        failed += 1;
        if (result.kind === "offline" || result.kind === "signed-out") break; // no point continuing
      }
    }
    const skipped = pending.length - imported - failed;
    state.importing = false;
    state.importNote =
      failed + skipped === 0
        ? `${imported} imported — every local moment is now in MIDO XI.`
        : `${imported} imported · ${failed + skipped} could not be imported — they stay safely local.`;
    await setFlag("importDismissedAt", new Date().toISOString());
    state.all = await listLibrary();
    paint();
  }

  /** Brief success feedback on a button without losing its handler. */
  function flash(button: HTMLButtonElement, text: string | null, iconName?: "check"): void {
    const prior = Array.from(button.childNodes);
    button.replaceChildren();
    if (iconName) button.append(icon(iconName));
    if (text) button.append(document.createTextNode(text));
    button.classList.add("lib-flash");
    setTimeout(() => {
      button.replaceChildren(...prior);
      button.classList.remove("lib-flash");
    }, 1200);
  }

  paint();
}
